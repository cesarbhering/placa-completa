import { lerFonteCache, gravarFonteCache, chaveDePlaca } from './fonte-cache'
import { inicioDoDiaBrasilia, AVISO_PARCEIROS, type Http } from './parceiro-leilao'
import { cfgHistorico, FONTE_CACHE_HISTORICO, FONTE_CUSTO_HISTORICO, type CfgHistorico } from './parceiro-historico-env'
import { emVoo } from './tarefas-em-voo'
import { parsearRespostaHistorico, historicoDoVeiculo, type HistoricoVeicular } from '../../shared/historico-veicular'
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
//  - one paid call per order and per plate: lock per order AND per plate (two
//    orders of the same plate never pay twice), a unique index in the table,
//    and an order that already has a paid row reuses it;
//  - daily ceiling NUXT_PARCEIRO_HISTORICO_TETO_DIA (60) of PAID calls plus
//    the calls in progress (an attempt with an error does not count): each call
//    reserves its row in the database first (RPC with a lock), so simultaneous
//    calls never pass it. Reached, the report goes on without the source and
//    ONE alert goes out per day;
//  - the snapshot gets the block through an RPC that sets only that key
//    (jsonb_set): it never rewrites what other sources wrote;
//  - cost in premium_custos for every call (custo_debitado; 1,90 reserve when
//    the answer does not say; 0 on error).

export const TIMEOUT_HISTORICO_MS = 60_000
export const PRECO_RESERVA_CENTAVOS = 190
/** Lock lease per order: longer than one call with the timeout. */
export const LOCK_HISTORICO_S = 90
/** How many seconds the one without the lock waits for the other call (covers the timeout). */
export const ESPERA_LOCK_VOLTAS_HISTORICO = 75

/**
 * Deadline for the whole call, body included: at the deadline it aborts AND
 * gives up, even if the response body never ends (review 1 of PR #752).
 */
async function comTimeout<T>(ms: number, fn: (s: AbortSignal) => Promise<T>): Promise<T> {
  const c = new AbortController()
  let t: any
  const limite = new Promise<never>((_, rejeita) => {
    t = setTimeout(() => { c.abort(); rejeita(Object.assign(new Error(`timeout ${ms} ms`), { name: 'AbortError' })) }, ms)
  })
  try { return await Promise.race([fn(c.signal), limite]) } finally { clearTimeout(t) }
}

/** Why a call brought nothing: balance/quota, key refused, or anything else. */
export type MotivoFalha = 'saldo' | 'autenticacao' | 'erro'

export interface ChamadaHistorico {
  http: number | null
  ms: number
  bruto: any
  bloco: HistoricoVeicular | null
  cobrada: boolean
  custoCentavos: number
  idConsulta: string | null
  erro: string | null
  motivo: MotivoFalha | null
}

/** One call to the partner. Never throws. */
export async function chamarHistorico(
  cfg: CfgHistorico, placa: string, http: Http, prazoMs = TIMEOUT_HISTORICO_MS,
  parsear: (b: any) => HistoricoVeicular | null = parsearRespostaHistorico,
): Promise<ChamadaHistorico> {
  const t0 = Date.now()
  let status: number | null = null
  let corpo = ''
  try {
    const r = await comTimeout(prazoMs, async (signal) => {
      const resp = await http(`${cfg.base}/v1/e20?query=${encodeURIComponent(placa)}`, {
        method: 'GET', headers: { 'x-api-key': cfg.chave, Accept: 'application/json' }, signal,
      })
      // The body is read inside the deadline: a body that never ends cannot outlive the lock.
      return { status: resp.status, corpo: await resp.text() }
    })
    status = r.status
    corpo = r.corpo
  } catch (e: any) {
    return {
      http: null, ms: Date.now() - t0, bruto: null, bloco: null, cobrada: false, custoCentavos: 0, idConsulta: null, motivo: 'erro',
      erro: e?.name === 'AbortError' ? `timeout ${prazoMs} ms` : String(e?.message || e).slice(0, 160),
    }
  }
  // Charge, cost and raw answer come FIRST: whatever happens in the parse
  // below, a paid answer stays paid and kept (never paid again for it).
  let bruto: any = corpo
  try { bruto = JSON.parse(corpo) } catch { /* keeps the text */ }
  const json = !!bruto && typeof bruto === 'object'
  const sucesso = status === 200 && json && bruto.success === true
  const debitado = Number(json ? bruto.custo_debitado : NaN)
  const cobrada = status === 200 && (sucesso || (Number.isFinite(debitado) && debitado > 0))
  const custoCentavos = cobrada ? (Number.isFinite(debitado) && debitado > 0 ? Math.round(debitado * 100) : PRECO_RESERVA_CENTAVOS) : 0
  const id = json ? String(bruto.queryId ?? '').trim().slice(0, 80) : ''
  let bloco: HistoricoVeicular | null = null
  try { bloco = sucesso ? parsear(bruto) : null } catch { bloco = null }
  const base = { http: status, ms: Date.now() - t0, bruto, cobrada, custoCentavos, idConsulta: id || null }
  if (bloco) return { ...base, bloco, erro: null, motivo: null }
  // Error text without the body: it can carry personal data.
  const erro = status !== 200 ? `HTTP ${status}` : sucesso ? 'resposta sem dados' : 'resposta sem sucesso'
  return { ...base, bloco: null, erro, motivo: motivoDaFalha({ http: status, bruto }) }
}

/** Balance or quota (402, or the answer says so), key refused (401/403), anything else. */
export function motivoDaFalha(c: Pick<ChamadaHistorico, 'http' | 'bruto'>): MotivoFalha {
  if (c.http === 402 || ehSaldoOuLimiteHistorico(c)) return 'saldo'
  if (c.http === 401 || c.http === 403) return 'autenticacao'
  return 'erro'
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

/**
 * Reserves a slot of the daily ceiling and the row of this attempt, BEFORE the
 * call, in one RPC with a lock: paid calls of the day plus the reservations in
 * progress (5 min) are counted, so simultaneous calls never pass the ceiling.
 * Returns the row id, or null when the ceiling is reached. Throws when the
 * database does not answer (then nothing is called).
 */
async function reservarChamada(sb: any, pedidoId: string, placa: string, teto: number, agora: number): Promise<string | null> {
  const { data, error } = await sb.rpc('parceiro_historico_reservar', { p_pedido: pedidoId, p_placa: placa, p_teto: teto, p_desde: inicioDoDiaBrasilia(agora) })
  if (error) throw new Error(error.message)
  return data ? String(data) : null
}

/**
 * Writes the result into the reserved row. 'duplicada' when the database
 * refused a second paid row of the same order (the vendor charged it: the row
 * stays, marked).
 */
async function concluirReserva(sb: any, id: string, l: Omit<LinhaHistorico, 'pedido_id' | 'placa' | 'cache_hit'>): Promise<'ok' | 'duplicada' | 'erro'> {
  try {
    const { error } = await sb.from(TABELA).update({ ...l, em_andamento: false }).eq('id', id)
    if (!error) return 'ok'
    if (error.code === '23505' && l.cobrada) {
      await sb.from(TABELA).update({ ...l, em_andamento: false, cobrada: false, motivo_erro: 'COBRANCA DUPLICADA: o banco barrou a 2a linha cobrada deste pedido (o fornecedor cobrou)' }).eq('id', id)
      return 'duplicada'
    }
    console.warn('[parceiro-historico] linha de auditoria falhou:', error.message)
    return 'erro'
  } catch (e: any) { console.warn('[parceiro-historico] linha de auditoria falhou:', e?.message || e); return 'erro' }
}

async function lerSnapshot(sb: any, id: string): Promise<any | null> {
  const { data } = await sb.from('pedidos_premium').select('relatorio_snapshot').eq('id', id).maybeSingle()
  const s = data?.relatorio_snapshot
  return s && typeof s === 'object' ? s : null
}

/** VIN of the vehicle in the paid query stored in the snapshot (object or one-item list). */
function chassiDoSnapshot(snap: any): string | null {
  const r = snap?.consulta?.response
  const b = Array.isArray(r) ? r[0] : r
  return b && typeof b === 'object' && typeof b.chassi === 'string' ? b.chassi : null
}

/**
 * Writes ONLY snapshot.historicoVeicular, through an RPC that sets that key
 * with jsonb_set (never rewrites what other sources wrote, review 1 of PR
 * #752). A failure never replaces a block that is already ok.
 */
async function gravarNoSnapshot(sb: any, pedidoId: string, bloco: HistoricoVeicular): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc('snapshot_gravar_historico_veicular', { p_pedido: pedidoId, p_valor: bloco })
    if (error) { console.warn('[parceiro-historico] snapshot nao gravou:', error.message); return false }
    return data === true
  } catch (e: any) {
    console.warn('[parceiro-historico] snapshot nao gravou:', e?.message || e)
    return false
  }
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
  /** Deadline of the call, body included (tests inject a short one). */
  prazoMs?: number
}

export interface ResultadoHistorico {
  /** The block came with status ok (and, from completar, is in the snapshot). */
  ok: boolean
  /** Skipped without calling: off, outside the plan, no plate, no snapshot, already there. */
  pulado?: string
  /** divergente: the partner answered for another VIN than the vehicle's (nothing goes to the report). */
  status?: 'ok' | 'falhou' | 'teto' | 'divergente'
  cacheHit?: boolean
  cobrada?: boolean
  custoCentavos?: number
  /** HTTP status of the call (null without a call). */
  code?: number | null
  erro?: string | null
  tempoMs?: number
  bloco?: HistoricoVeicular | null
}

/** Takes a named lock (job_lock_pegar, lease LOCK_HISTORICO_S). Throws when the database does not answer. */
async function pegarLock(sb: any, nome: string, dono: string): Promise<boolean> {
  const { data, error } = await sb.rpc('job_lock_pegar', { p_nome: nome, p_dono: dono, p_segundos: LOCK_HISTORICO_S })
  if (error) throw new Error(error.message)
  return data === true
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
  const falhou = (x: Partial<ResultadoHistorico> = {}, motivo: MotivoFalha = 'erro'): ResultadoHistorico => ({ ok: false, status: 'falhou', bloco: { status: 'falhou', consultadoEm: quando, motivo }, ...x })
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
      let doPedido: HistoricoVeicular | null = null
      try { doPedido = parsearRespostaHistorico(paga.resposta_bruta) } catch { doPedido = null }
      // Paid but without usable data: calling again would pay again for the
      // same answer. The order stays without the source (the row is there to
      // be checked against the invoice).
      if (!doPedido) return falhou({ cobrada: false, custoCentavos: 0, code: null, erro: 'resposta paga sem dados' })
      await gravarFonteCache(sb, FONTE_CACHE_HISTORICO, placa, { ...doPedido, consultadoEm: null }, 'ok', agora)
      return { ok: true, status: 'ok', cacheHit: false, cobrada: false, custoCentavos: 0, code: null, bloco: { ...doPedido, consultadoEm: paga.criado_em ?? quando } }
    }
    const pronto = await reaproveitar()
    if (pronto) return pronto

    // Locks per order AND per plate: early call, step after the delivery,
    // queue job and operator route never call together, and two orders of the
    // same plate never pay twice (the second one takes the clean cache).
    const dono = deps.dono ?? `${process.pid}:${Math.random().toString(36).slice(2, 10)}`
    const esperarOutra = async (): Promise<ResultadoHistorico> => {
      const esperar = deps.esperar ?? ((ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)))
      for (let i = 0; i < ESPERA_LOCK_VOLTAS_HISTORICO; i++) {
        await esperar(1000)
        const r = await reaproveitar()
        if (r) return r
      }
      log(`[parceiro-historico] pedido=${ref} com consulta em andamento em outra execucao: segue sem chamar`)
      // The other call did not bring it: this order goes on without it (the queue tries).
      return falhou({ erro: 'em andamento' })
    }
    try {
      if (!(await pegarLock(sb, `historico:${pedido.id}`, dono))) return await esperarOutra()
      if (!(await pegarLock(sb, `historico-placa:${placa}`, dono))) return await esperarOutra()
    } catch (e: any) {
      log(`[parceiro-historico] sem lock do pedido=${ref} (${String(e?.message || e).slice(0, 80)}): nao chama`)
      return falhou({ erro: 'sem lock' })
    }
    // With both locks: another run may have finished between the look and the locks.
    const depois = await reaproveitar()
    if (depois) return depois

    // Daily ceiling: the slot and the row of this attempt are reserved first.
    let reserva: string | null = null
    try { reserva = await reservarChamada(sb, pedido.id, placa, deps.cfg.tetoDia, agora) } catch (e: any) {
      log(`[parceiro-historico] sem reserva do teto (${String(e?.message || e).slice(0, 80)}): nao chama`)
      return falhou({ erro: 'sem reserva do teto' })
    }
    if (!reserva) {
      const dia = inicioDoDiaBrasilia(agora)
      if (alertaTetoDia !== dia) {
        alertaTetoDia = dia
        await Promise.resolve(alertar('BASE PARCEIRA DE HISTORICO: TETO DIARIO ATINGIDO', `Teto de ${deps.cfg.tetoDia} chamadas cobradas no dia atingido. Os relatorios seguem sem a fonte; a fila tenta de novo depois.`)).catch(() => {})
      }
      log(`[parceiro-historico] teto diario atingido (${deps.cfg.tetoDia}) pedido=${ref}`)
      return { ok: false, status: 'teto', bloco: { status: 'teto', consultadoEm: quando } }
    }

    // The call.
    const c = await chamarHistorico(deps.cfg, placa, http, deps.prazoMs)
    const gravou = await concluirReserva(sb, reserva, {
      http_status: c.http, sucesso: !!c.bloco, cobrada: c.cobrada, custo_centavos: c.custoCentavos,
      tempo_ms: c.ms, id_consulta_parceiro: c.idConsulta, motivo_erro: c.erro, resposta_bruta: c.bruto ?? null,
    })
    if (gravou === 'duplicada') await Promise.resolve(alertar('BASE PARCEIRA DE HISTORICO: COBRANCA DUPLICADA', `Pedido ${pedido.id} foi cobrado de novo (queryId ${c.idConsulta || '?'}). O lock deveria ter barrado: investigar.`)).catch(() => {})
    await gravarCusto(sb, pedido.id, c)
    if (c.motivo === 'saldo') await Promise.resolve(alertar('BASE PARCEIRA DE HISTORICO: SALDO OU LIMITE', `HTTP ${c.http} ao consultar o pedido ${pedido.id}.`)).catch(() => {})
    log(`[parceiro-historico] pedido=${ref} http=${c.http ?? '-'} ${c.bloco ? 'ok' : `erro=${c.erro}`} cobrada=${c.cobrada} ${c.ms}ms`)
    const base = { cobrada: c.cobrada, custoCentavos: c.custoCentavos, code: c.http, tempoMs: c.ms, cacheHit: false }
    if (!c.bloco) return falhou({ erro: c.erro, ...base }, c.motivo ?? 'erro')
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
      // Refused while the server shuts down: a failure like any other (the queue tries).
      .then((r): ResultadoHistorico => r ?? { ok: false, status: 'falhou', erro: 'nao rodou', bloco: { status: 'falhou', consultadoEm: new Date(deps.agora ?? Date.now()).toISOString(), motivo: 'erro' } })
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
  pedido: { id?: string | null; placa: string; chassi?: string | null },
  cfg: CfgHistorico = cfgHistorico(useRuntimeConfig()),
  agora = Date.now(),
): Promise<HistoricoVeicular | null> {
  try {
    const voo = pedido.id ? emVooHistorico.get(pedido.id) : undefined
    // Another VIN than the vehicle's: only the reason (review 1 of PR #752).
    if (voo) return historicoDoVeiculo(voo.resultado?.bloco ?? null, pedido.chassi)
    if (!cfg.ligado) return null
    const hit = await lerFonteCache<any>(sb, FONTE_CACHE_HISTORICO, chaveDePlaca(pedido.placa), agora)
    return hit?.payload?.status === 'ok' ? historicoDoVeiculo({ ...hit.payload, consultadoEm: hit.consultadoEm }, pedido.chassi) : null
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
    const feito = snap.historicoVeicular?.status
    if (feito === 'ok' || feito === 'divergente') return { ok: feito === 'ok', pulado: 'ja tem', status: feito, bloco: snap.historicoVeicular }
    const voo = emVooHistorico.get(pedido.id)
    let r: ResultadoHistorico | null = voo ? await voo.promessa : null
    if (r && r.status !== 'ok' && deps.retentar) r = null
    if (!r) r = await buscarHistoricoVeicular(sb, pedido, deps)
    // Another VIN than the vehicle's: only the reason goes in (review 1 of PR #752).
    const bloco = historicoDoVeiculo(r.bloco, chassiDoSnapshot(snap))
    if (bloco) await gravarNoSnapshot(sb, pedido.id, bloco)
    if (bloco?.status === 'divergente') return { ...r, ok: false, status: 'divergente', bloco }
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
