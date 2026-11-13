import { lerFonteCache, gravarFonteCache, chaveDePlaca } from './fonte-cache'
import { inicioDoDiaBrasilia, AVISO_PARCEIROS, type Http } from './parceiro-leilao'
import { cfgHistorico, FONTE_CACHE_HISTORICO, FONTE_CUSTO_HISTORICO, type CfgHistorico } from './parceiro-historico-env'
import { emVoo } from './tarefas-em-voo'
import { parsearRespostaHistorico, type HistoricoVeicular } from '../../shared/historico-veicular'
import { fonteNoPlano } from '../../shared/planos'

// Vehicle history partner (second partner base), Cesar 13/11/2026: owners,
// previous use, insurance and the partner part of the auction section, in the
// Completa report only. Slow source of the 2.0 report. The call starts
// together with the paid query (iniciarHistoricoVeicular, it needs only the
// plate); the snapshot assembly takes the result when it is already here
// (historicoProntoParaSnapshot), the step right after the delivery writes it
// when it comes later (completarHistoricoVeicularDepois, same call, never a
// second one) and the premium_jobs queue is the fallback for failure, ceiling
// or delay (fonte 'historico_veicular').
//
// Rules:
//  - off by default: NUXT_PARCEIRO_HISTORICO_LIGADO=on plus the key turn it on.
//    While on, the auction partner (parceiro-leilao.ts) is never called;
//    turning this off brings that one back through its own switch;
//  - the raw answer (name and CPF/CNPJ of every owner) goes ONLY to
//    parceiro_historico_chamadas (RLS on, no policy: server only), one row per
//    attempt, cache hit included. Snapshot, cache, report JSON, screen, e-mail
//    and logs only ever see the clean block (shared/historico-veicular.ts);
//  - fonte_cache by plate for 30 days with the CLEAN block: a valid cache entry
//    neither calls nor pays (second order of the same plate);
//  - one paid call per order: lock per order plus a unique index in the table;
//    an order that already has a paid row reuses it;
//  - daily ceiling NUXT_PARCEIRO_HISTORICO_TETO_DIA (60): reached, the report
//    goes on without the source and ONE alert goes out per day;
//  - cost in premium_custos for every call (custo_debitado; 1,90 reserve when
//    the answer does not say; 0 on error).

export const TIMEOUT_HISTORICO_MS = 60_000
export const PRECO_RESERVA_CENTAVOS = 190
/** Lock lease per order: longer than one call with the timeout. */
export const LOCK_HISTORICO_S = 90
/** How many seconds the one without the lock waits for the other call. */
export const ESPERA_LOCK_VOLTAS_HISTORICO = 20

async function comTimeout<T>(ms: number, fn: (s: AbortSignal) => Promise<T>): Promise<T> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try { return await fn(c.signal) } finally { clearTimeout(t) }
}

export interface ChamadaHistorico {
  http: number | null
  ms: number
  bruto: any
  bloco: HistoricoVeicular | null
  cobrada: boolean
  custoCentavos: number
  idConsulta: string | null
  erro: string | null
}

/** One call to the partner. Never throws. */
export async function chamarHistorico(cfg: CfgHistorico, placa: string, http: Http): Promise<ChamadaHistorico> {
  const t0 = Date.now()
  const vazio: ChamadaHistorico = { http: null, ms: 0, bruto: null, bloco: null, cobrada: false, custoCentavos: 0, idConsulta: null, erro: null }
  try {
    const r = await comTimeout(TIMEOUT_HISTORICO_MS, (signal) => http(`${cfg.base}/v1/e20?query=${encodeURIComponent(placa)}`, {
      method: 'GET', headers: { 'x-api-key': cfg.chave, Accept: 'application/json' }, signal,
    }))
    const corpo = await r.text()
    let bruto: any = corpo
    try { bruto = JSON.parse(corpo) } catch { /* keeps the text */ }
    const json = bruto && typeof bruto === 'object'
    const sucesso = r.status === 200 && json && bruto.success === true
    const debitado = Number(json ? bruto.custo_debitado : NaN)
    const cobrada = r.status === 200 && (sucesso || (Number.isFinite(debitado) && debitado > 0))
    const bloco = sucesso ? parsearRespostaHistorico(bruto) : null
    const id = json ? String(bruto.queryId ?? '').trim().slice(0, 80) : ''
    return {
      http: r.status,
      ms: Date.now() - t0,
      bruto,
      bloco,
      cobrada,
      custoCentavos: cobrada ? (Number.isFinite(debitado) && debitado > 0 ? Math.round(debitado * 100) : PRECO_RESERVA_CENTAVOS) : 0,
      idConsulta: id || null,
      // Error text without the body: it can carry personal data.
      erro: bloco ? null : r.status !== 200 ? `HTTP ${r.status}` : sucesso ? 'resposta sem dados' : 'resposta sem sucesso',
    }
  } catch (e: any) {
    return { ...vazio, ms: Date.now() - t0, erro: e?.name === 'AbortError' ? `timeout ${TIMEOUT_HISTORICO_MS} ms` : String(e?.message || e).slice(0, 160) }
  }
}

/** Balance, credit or quota answer: alert right away. */
export function ehSaldoOuLimiteHistorico(c: Pick<ChamadaHistorico, 'http' | 'bruto'>): boolean {
  if (c.http == null || ![400, 402, 403, 429].includes(c.http)) return false
  const s = (typeof c.bruto === 'string' ? c.bruto : JSON.stringify(c.bruto || '')).normalize('NFD').replace(/[̀-ͯ]/g, '')
  return /saldo|limite|credito|franquia|insuficiente|quota|cota/i.test(s)
}

// ---------------------------------------------------------------- database

export interface LinhaHistorico {
  pedido_id: string | null
  placa: string | null
  http_status: number | null
  sucesso: boolean
  cobrada: boolean
  custo_centavos: number
  tempo_ms: number | null
  id_consulta_parceiro: string | null
  cache_hit: boolean
  motivo_erro: string | null
  resposta_bruta: any
}

const TABELA = 'parceiro_historico_chamadas'

/** 'duplicada' when the database blocked a second paid row of the same order. */
async function gravarLinha(sb: any, l: LinhaHistorico): Promise<'ok' | 'duplicada' | 'erro'> {
  try {
    const { error } = await sb.from(TABELA).insert(l)
    if (!error) return 'ok'
    // Partial unique index (pedido_id) where cobrada: the code let a second
    // paid call through. The vendor charged it, so the row goes in, marked.
    if (error.code === '23505' && l.cobrada) {
      await sb.from(TABELA).insert({ ...l, cobrada: false, motivo_erro: 'COBRANCA DUPLICADA: o banco barrou a 2a linha cobrada deste pedido (o fornecedor cobrou)' })
      return 'duplicada'
    }
    console.warn('[parceiro-historico] linha de auditoria falhou:', error.message)
    return 'erro'
  } catch (e: any) { console.warn('[parceiro-historico] linha de auditoria falhou:', e?.message || e); return 'erro' }
}

async function gravarCusto(sb: any, pedidoId: string | null, c: ChamadaHistorico): Promise<void> {
  try {
    await sb.from('premium_custos').insert({
      pedido_id: pedidoId, fonte: FONTE_CUSTO_HISTORICO, preco: c.custoCentavos / 100, code: c.http ?? 0,
      detalhe: c.cobrada ? `queryId ${c.idConsulta || '?'}` : `erro: ${String(c.erro || '').slice(0, 160)}`,
    })
  } catch { /* cost never breaks the report */ }
}

async function chamadasHoje(sb: any, agora: number): Promise<number> {
  const { count, error } = await sb.from(TABELA).select('id', { count: 'exact', head: true })
    .eq('cache_hit', false).gte('criado_em', inicioDoDiaBrasilia(agora))
  if (error) throw new Error(error.message)
  return Number(count) || 0
}

async function lerSnapshot(sb: any, id: string): Promise<any | null> {
  const { data } = await sb.from('pedidos_premium').select('relatorio_snapshot').eq('id', id).maybeSingle()
  const s = data?.relatorio_snapshot
  return s && typeof s === 'object' ? s : null
}

/**
 * Writes ONLY snapshot.historicoVeicular, reading the snapshot again right
 * before (other slow sources write there too). A failure never replaces a
 * block that is already ok.
 */
async function gravarNoSnapshot(sb: any, pedidoId: string, bloco: HistoricoVeicular): Promise<boolean> {
  const atual = await lerSnapshot(sb, pedidoId)
  if (!atual) return false
  if (atual.historicoVeicular?.status === 'ok' && bloco.status !== 'ok') return false
  const { error } = await sb.from('pedidos_premium').update({ relatorio_snapshot: { ...atual, historicoVeicular: bloco } }).eq('id', pedidoId)
  if (error) console.warn('[parceiro-historico] snapshot nao gravou:', error.message)
  return !error
}

// ---------------------------------------------------------------- orchestration

export interface DepsHistorico {
  cfg: CfgHistorico
  http?: Http
  alertar?: (assunto: string, texto: string) => Promise<unknown>
  agora?: number
  log?: (m: string) => void
  /** Pause between looks while another run of the same order calls (tests inject). */
  esperar?: (ms: number) => Promise<void>
  /** Identity of this run in the per-order lock (tests inject). */
  dono?: string
  /** Operator route: runs with the switch off (the key is still required). */
  ignorarChave?: boolean
}

export interface ResultadoHistorico {
  /** The block came with status ok (and, from completar, is in the snapshot). */
  ok: boolean
  /** Skipped without calling: off, outside the plan, no snapshot, already there, call in progress. */
  pulado?: string
  status?: 'ok' | 'falhou' | 'teto'
  cacheHit?: boolean
  cobrada?: boolean
  custoCentavos?: number
  /** HTTP status of the call (null without a call). */
  code?: number | null
  erro?: string | null
  tempoMs?: number
  bloco?: HistoricoVeicular | null
}

let alertaTetoDia: string | null = null
/** Tests only. */
export function _limparAlertaTetoHistorico() { alertaTetoDia = null }

/**
 * Gets the vehicle history of ONE order without touching its snapshot (it
 * may not exist yet: the call starts together with the paid query). Valid
 * clean cache, a paid answer of this order, or ONE call (lock per order,
 * daily ceiling). Leaves the raw answer in the restricted table, the cost in
 * premium_custos and the clean block in the cache. `bloco` comes for ok,
 * falhou and teto (the state the snapshot gets). Never throws.
 */
export async function buscarHistoricoVeicular(
  sb: any,
  pedido: { id: string; placa: string; plano?: string | null },
  deps: DepsHistorico,
): Promise<ResultadoHistorico> {
  const agora = deps.agora ?? Date.now()
  const quando = new Date(agora).toISOString()
  const log = deps.log ?? ((m: string) => console.info(m))
  const alertar = deps.alertar ?? (async (assunto: string, texto: string) => sendErrorEmail({ endpoint: '/premium/parceiro-historico', errorMessage: `${assunto}<br>${texto}`, paraTambem: [AVISO_PARCEIROS] }))
  const http: Http = deps.http ?? ((url, init) => fetch(url, init as any) as any)
  const ref = String(pedido.id || '-').slice(0, 8)
  const falhou = (x: Partial<ResultadoHistorico> = {}): ResultadoHistorico => ({ ok: false, status: 'falhou', bloco: { status: 'falhou', consultadoEm: quando }, ...x })
  try {
    if (!fonteNoPlano('historico_veicular', pedido.plano)) return { ok: false, pulado: 'fora do plano' }
    if (!deps.cfg.chave || (!deps.cfg.ligado && !deps.ignorarChave)) return { ok: false, pulado: 'desligado' }
    const placa = chaveDePlaca(pedido.placa)
    if (!placa) return { ok: false, pulado: 'sem placa' }

    // Already answered for this plate (valid cache) or paid for this order:
    // reuse it, no call and no charge.
    const reaproveitar = async (): Promise<ResultadoHistorico | null> => {
      const hit = await lerFonteCache<any>(sb, FONTE_CACHE_HISTORICO, placa, agora)
      if (hit?.payload?.status === 'ok') {
        const bloco: HistoricoVeicular = { ...hit.payload, consultadoEm: hit.consultadoEm }
        await gravarLinha(sb, { pedido_id: pedido.id, placa, http_status: null, sucesso: true, cobrada: false, custo_centavos: 0, tempo_ms: 0, id_consulta_parceiro: null, cache_hit: true, motivo_erro: null, resposta_bruta: null })
        log(`[parceiro-historico] cache pedido=${ref}`)
        return { ok: true, status: 'ok', cacheHit: true, cobrada: false, custoCentavos: 0, code: null, bloco }
      }
      const { data: paga } = await sb.from(TABELA).select('resposta_bruta,criado_em')
        .eq('pedido_id', pedido.id).eq('cobrada', true).order('criado_em', { ascending: false }).limit(1).maybeSingle()
      if (!paga) return null
      const doPedido = parsearRespostaHistorico(paga.resposta_bruta)
      // Paid but without usable data: calling again would pay again for the
      // same answer. The order stays without the source (the row is there to
      // be checked against the invoice).
      if (!doPedido) return falhou({ cobrada: false, custoCentavos: 0, code: null, erro: 'resposta paga sem dados' })
      await gravarFonteCache(sb, FONTE_CACHE_HISTORICO, placa, { ...doPedido, consultadoEm: null }, 'ok', agora)
      return { ok: true, status: 'ok', cacheHit: false, cobrada: false, custoCentavos: 0, code: null, bloco: { ...doPedido, consultadoEm: paga.criado_em ?? quando } }
    }
    const pronto = await reaproveitar()
    if (pronto) return pronto

    // Lock per order: early call, step after the delivery, queue job and
    // operator route never call together.
    const dono = deps.dono ?? `${process.pid}:${Math.random().toString(36).slice(2, 10)}`
    let pegou = false
    try {
      const { data, error } = await sb.rpc('job_lock_pegar', { p_nome: `historico:${pedido.id}`, p_dono: dono, p_segundos: LOCK_HISTORICO_S })
      if (error) throw new Error(error.message)
      pegou = data === true
    } catch (e: any) {
      log(`[parceiro-historico] sem lock do pedido=${ref} (${String(e?.message || e).slice(0, 80)}): nao chama`)
      return { ok: false, status: 'falhou', erro: 'sem lock' }
    }
    if (!pegou) {
      const esperar = deps.esperar ?? ((ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)))
      for (let i = 0; i < ESPERA_LOCK_VOLTAS_HISTORICO; i++) {
        await esperar(1000)
        const r = await reaproveitar()
        if (r) return r
      }
      log(`[parceiro-historico] pedido=${ref} com consulta em andamento em outra execucao: segue sem chamar`)
      return { ok: false, pulado: 'em andamento' }
    }
    const depois = await reaproveitar()
    if (depois) return depois

    // Daily ceiling.
    let feitas = 0
    try { feitas = await chamadasHoje(sb, agora) } catch (e: any) {
      log(`[parceiro-historico] sem contagem do teto (${String(e?.message || e).slice(0, 80)}): nao chama`)
      return { ok: false, status: 'falhou', erro: 'sem contagem do teto' }
    }
    if (feitas >= deps.cfg.tetoDia) {
      const dia = inicioDoDiaBrasilia(agora)
      if (alertaTetoDia !== dia) {
        alertaTetoDia = dia
        await Promise.resolve(alertar('BASE PARCEIRA DE HISTORICO: TETO DIARIO ATINGIDO', `${feitas} chamadas hoje (teto ${deps.cfg.tetoDia}). Os relatorios seguem sem a fonte; a fila tenta de novo depois.`)).catch(() => {})
      }
      log(`[parceiro-historico] teto diario atingido (${feitas}/${deps.cfg.tetoDia}) pedido=${ref}`)
      return { ok: false, status: 'teto', bloco: { status: 'teto', consultadoEm: quando } }
    }

    // The call.
    const c = await chamarHistorico(deps.cfg, placa, http)
    const gravou = await gravarLinha(sb, {
      pedido_id: pedido.id, placa, http_status: c.http, sucesso: !!c.bloco, cobrada: c.cobrada, custo_centavos: c.custoCentavos,
      tempo_ms: c.ms, id_consulta_parceiro: c.idConsulta, cache_hit: false, motivo_erro: c.erro, resposta_bruta: c.bruto ?? null,
    })
    if (gravou === 'duplicada') await Promise.resolve(alertar('BASE PARCEIRA DE HISTORICO: COBRANCA DUPLICADA', `Pedido ${pedido.id} foi cobrado de novo (queryId ${c.idConsulta || '?'}). O lock deveria ter barrado: investigar.`)).catch(() => {})
    await gravarCusto(sb, pedido.id, c)
    if (ehSaldoOuLimiteHistorico(c)) await Promise.resolve(alertar('BASE PARCEIRA DE HISTORICO: SALDO OU LIMITE', `HTTP ${c.http} ao consultar o pedido ${pedido.id}.`)).catch(() => {})
    log(`[parceiro-historico] pedido=${ref} http=${c.http ?? '-'} ${c.bloco ? 'ok' : `erro=${c.erro}`} cobrada=${c.cobrada} ${c.ms}ms`)
    const base = { cobrada: c.cobrada, custoCentavos: c.custoCentavos, code: c.http, tempoMs: c.ms, cacheHit: false }
    if (!c.bloco) return falhou({ erro: c.erro, ...base })
    // Cache gets the CLEAN block only (never the raw answer).
    await gravarFonteCache(sb, FONTE_CACHE_HISTORICO, placa, c.bloco, 'ok', agora)
    return { ok: true, status: 'ok', erro: null, bloco: { ...c.bloco, consultadoEm: quando }, ...base }
  } catch (e: any) {
    log(`[parceiro-historico] falhou (relatorio segue): ${String(e?.message || e).slice(0, 160)}`)
    return falhou({ erro: String(e?.message || e).slice(0, 160) })
  }
}

// ---------------------------------------------------------------- started with the paid query

interface EmVooHistorico { promessa: Promise<ResultadoHistorico>; resultado?: ResultadoHistorico }
const emVooHistorico = new Map<string, EmVooHistorico>()
/** How long a finished early call stays here for the delivery to take it. */
export const GUARDA_EM_VOO_MS = 15 * 60 * 1000
/** Tests only. */
export function _limparEmVooHistorico() { emVooHistorico.clear() }

/**
 * Starts the call together with the paid query (Cesar, 13/11/2026): it needs
 * only the plate and answers in about 10 s, so it is ready before the report.
 * Loose and fail-open: never holds the paid query nor the delivery. One per
 * order in this process. The result goes to the clean cache right away; the
 * snapshot assembly takes it when it is already here
 * (historicoProntoParaSnapshot) and the step right after the delivery writes
 * it when it arrives later (completarHistoricoVeicular). null = not started.
 */
export function iniciarHistoricoVeicular(
  sb: any,
  pedido: { id: string; placa: string; plano?: string | null },
  deps: Partial<DepsHistorico> = {},
): Promise<ResultadoHistorico> | null {
  try {
    const cfg = deps.cfg ?? cfgHistorico(useRuntimeConfig())
    if (!cfg.ligado || !pedido?.id || !fonteNoPlano('historico_veicular', pedido.plano)) return null
    const atual = emVooHistorico.get(pedido.id)
    if (atual) return atual.promessa
    const entrada: EmVooHistorico = { promessa: Promise.resolve({ ok: false }) }
    entrada.promessa = emVoo('historico-veicular', () => buscarHistoricoVeicular(sb, pedido, { ...deps, cfg }))
      .then((r): ResultadoHistorico => r ?? { ok: false, status: 'falhou', erro: 'nao rodou' })
      .then((r) => {
        entrada.resultado = r
        const t: any = setTimeout(() => { if (emVooHistorico.get(pedido.id) === entrada) emVooHistorico.delete(pedido.id) }, GUARDA_EM_VOO_MS)
        t?.unref?.()
        return r
      })
    emVooHistorico.set(pedido.id, entrada)
    return entrada.promessa
  } catch (e: any) {
    console.warn('[parceiro-historico] nao iniciou (relatorio segue):', e?.message || e)
    return null
  }
}

/**
 * For the snapshot assembly: the block only when it is already here (the
 * early call of this order finished in this process, or the clean cache has
 * the plate). Never waits and never calls. null = it comes later (step after
 * the delivery or the queue).
 */
export async function historicoProntoParaSnapshot(
  sb: any,
  pedido: { id?: string | null; placa: string },
  cfg: CfgHistorico = cfgHistorico(useRuntimeConfig()),
  agora = Date.now(),
): Promise<HistoricoVeicular | null> {
  try {
    const voo = pedido.id ? emVooHistorico.get(pedido.id) : undefined
    if (voo) return voo.resultado?.bloco ?? null
    if (!cfg.ligado) return null
    const hit = await lerFonteCache<any>(sb, FONTE_CACHE_HISTORICO, chaveDePlaca(pedido.placa), agora)
    return hit?.payload?.status === 'ok' ? { ...hit.payload, consultadoEm: hit.consultadoEm } : null
  } catch { return null }
}

/**
 * Brings the vehicle history of ONE order into its snapshot (step right after
 * the delivery, queue job, operator route). The call started with the paid
 * query, when it is in this process, is awaited and reused: never a second
 * call. When that call failed, only `retentar` (queue job, operator) calls
 * again. Writes only snapshot.historicoVeicular. Never throws.
 */
export async function completarHistoricoVeicular(
  sb: any,
  pedido: { id: string; placa: string; plano?: string | null },
  deps: DepsHistorico & { retentar?: boolean },
): Promise<ResultadoHistorico> {
  try {
    if (!fonteNoPlano('historico_veicular', pedido.plano)) return { ok: false, pulado: 'fora do plano' }
    if (!deps.cfg.chave || (!deps.cfg.ligado && !deps.ignorarChave)) return { ok: false, pulado: 'desligado' }
    const snap = await lerSnapshot(sb, pedido.id)
    if (!snap) return { ok: false, pulado: 'sem snapshot' }
    if (snap.historicoVeicular?.status === 'ok') return { ok: true, pulado: 'ja tem', status: 'ok', bloco: snap.historicoVeicular }
    const voo = emVooHistorico.get(pedido.id)
    let r: ResultadoHistorico | null = voo ? await voo.promessa : null
    if (r && r.status !== 'ok' && deps.retentar) r = null
    if (!r) r = await buscarHistoricoVeicular(sb, pedido, deps)
    if (r.bloco) await gravarNoSnapshot(sb, pedido.id, r.bloco)
    return r.status === 'ok' ? { ...r, ok: true } : r
  } catch (e: any) {
    console.warn('[parceiro-historico] completar falhou (relatorio segue):', e?.message || e)
    return { ok: false, status: 'falhou', erro: String(e?.message || e).slice(0, 160) }
  }
}

/** Right after the delivery: loose, never holds nor breaks the delivery. */
export function completarHistoricoVeicularDepois(sb: any, pedido: { id: string; placa: string; plano?: string | null }): void {
  const cfg = cfgHistorico(useRuntimeConfig())
  if (!cfg.ligado || !fonteNoPlano('historico_veicular', pedido.plano)) return
  void emVoo('historico-veicular', () => completarHistoricoVeicular(sb, pedido, { cfg }).catch(() => {}))
}
