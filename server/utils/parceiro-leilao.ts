import { avisarLeilaoTardio } from './aviso-leilao'
import { lerFonteCache, gravarFonteCache, chaveDePlaca } from './fonte-cache'
import {
  parsearRespostaParceiro, historicoComParceiro, nossaBaseVazia,
  type RespostaParceiro, type EstadoParceiro, type MotivoReserva,
} from '../../shared/fonte-parceira'
import { historicoLeilaoComHistorico, motivoDaReserva } from '../../shared/historico-veicular'
import { configParceiroComLegado, FONTE_CACHE_LEGADA, FONTE_CUSTO_LEGADA, BASE_PADRAO_LEGADA } from './parceiro-leilao-env'
import { cfgHistorico } from './parceiro-historico-env'

// Cliente INTERNO da base parceira de leiloes e sinistros (parceiro-leilao).
// Plano do Cesar (20/out/2026). O nome do fornecedor so existe em
// parceiro-leilao-env.ts (nome legado), em premium_custos, fonte_cache e nos
// logs do servidor; tudo que sai para o cliente usa o rotulo de
// shared/fonte-parceira.ts.
//
// Regras:
//  - so Relatorio Completo, so quando a NOSSA base devolveu zero passagens e
//    sem indicio (historico presente e vazio; historico null = nossa base nao
//    respondeu, entao nao chama);
//  - liga/desliga NUXT_PARCEIRO_LEILAO_LIGADO (default desligado); teto diario
//    NUXT_PARCEIRO_LEILAO_TETO_DIA (40): atingido, segue sem a fonte e alerta;
//  - login com usuario/senha -> JWT de 24 h em memoria; 401 refaz o login 1 vez;
//  - timeout 15 s por chamada HTTP, corpo incluido, e todas as chamadas do
//    pedido terminam antes do lease do lock (PRAZO_CHAMADAS_MS); chama pela
//    placa e, se der erro e houver chassi (e tempo), pelo chassi (erro nao e
//    cobrado, entao continua uma cobranca por pedido);
//  - HTTP 400 com corpo de saldo/limite: alerta na hora;
//  - bruto inteiro em fonte_cache (30 d; cache hit nao chama nem cobra) e em
//    parceiro_leilao_chamadas (uma linha por tentativa, inclusive cache hit);
//  - custo em premium_custos (FONTE_CUSTO_PARCEIRO, 6,00; erro 0).

// Valores ja gravados no banco: nao mudam (ver parceiro-leilao-env.ts).
export const FONTE_CACHE_PARCEIRO = FONTE_CACHE_LEGADA
export const FONTE_CUSTO_PARCEIRO = FONTE_CUSTO_LEGADA
export const PRECO_PARCEIRO_CENTAVOS = 600
export const TIMEOUT_PARCEIRO_MS = 15_000
/** Lease do lock por pedido: todas as chamadas do pedido terminam antes dele (PRAZO_CHAMADAS_MS). */
export const LOCK_PEDIDO_S = 60
/**
 * Deadline of ALL the HTTP steps of one order (login, call, re-login, VIN
 * call), under the per-order lock: it ends 10 s before the lease, so the lock
 * never expires in the middle of a call (and the paid row is written in time).
 */
export const PRAZO_CHAMADAS_MS = (LOCK_PEDIDO_S - 10) * 1000
/** Below this, the VIN attempt is not even started (it would only time out). */
export const TEMPO_MINIMO_TENTATIVA_MS = 2_000
/** Quanto quem ficou sem o lock espera a outra geracao (segundos). */
export const ESPERA_LOCK_VOLTAS = 20
const BASE_PADRAO = BASE_PADRAO_LEGADA
const AVISO = 'cesarcbhering@gmail.com'
/** Who also gets the partner alerts (ceiling, balance, double charge). */
export const AVISO_PARCEIROS = AVISO

export interface CfgParceiro {
  ligado: boolean; usuario: string; senha: string; tetoDia: number; base: string
  /**
   * The vehicle history partner is on (server/utils/parceiro-historico.ts): it
   * feeds the partner part of the auction section, so this one is only called
   * as its fallback, for an order where it failed (DepsParceiro.reservaDoHistorico,
   * Cesar 17/11/2026). Turning that one off brings this back for every order.
   */
  historicoLigado?: boolean
}

export function cfgParceiro(config: any, env: Record<string, string | undefined> = process.env): CfgParceiro {
  const c = configParceiroComLegado(config, env)
  const lig = c.ligado.toLowerCase()
  const teto = c.tetoDia === '' ? NaN : Number(c.tetoDia)
  return {
    ligado: ['1', 'on', 'true', 'sim'].includes(lig),
    usuario: c.usuario,
    senha: c.senha,
    tetoDia: Number.isFinite(teto) && teto >= 0 ? teto : 40,
    base: (c.url || BASE_PADRAO).replace(/\/+$/, ''),
    historicoLigado: cfgHistorico(config).ligado,
  }
}

// ---------------------------------------------------------------- HTTP

export interface Http { (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }): Promise<{ status: number; text: () => Promise<string> }> }

let tokenCache: { token: string; ate: number } | null = null
/** So pra teste. */
export function _limparTokenParceiro() { tokenCache = null }

/**
 * Deadline for the whole HTTP step, body included (same as
 * parceiro-historico.ts): at the deadline it aborts AND gives up, even if the
 * response body never ends. This client runs inside the delivery (snapshot
 * assembly), so a stuck body can never hold it nor outlive the lock.
 */
async function comTimeout<T>(ms: number, fn: (s: AbortSignal) => Promise<T>): Promise<T> {
  const c = new AbortController()
  let t: any
  const limite = new Promise<never>((_, rejeita) => {
    t = setTimeout(() => { c.abort(); rejeita(Object.assign(new Error(`timeout ${ms} ms`), { name: 'AbortError' })) }, Math.max(0, ms))
  })
  try { return await Promise.race([fn(c.signal), limite]) } finally { clearTimeout(t) }
}

/** One HTTP step within the deadline: status and body, both read before it ends. */
async function passo(http: Http, url: string, init: Parameters<Http>[1], ate: number): Promise<{ status: number; corpo: string }> {
  const ms = Math.min(TIMEOUT_PARCEIRO_MS, ate - Date.now())
  if (ms <= 0) throw Object.assign(new Error('timeout: sem prazo para a chamada'), { name: 'AbortError' })
  return comTimeout(ms, async (signal) => {
    const r = await http(url, { ...init, signal })
    return { status: r.status, corpo: await r.text() }
  })
}

async function login(cfg: CfgParceiro, http: Http, agora: number, ate: number): Promise<string> {
  const r = await passo(http, `${cfg.base}/api/Auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: cfg.usuario, password: cfg.senha }),
  }, ate)
  const corpo = r.corpo
  let j: any = null
  try { j = JSON.parse(corpo) } catch { /* corpo nao e json */ }
  if (r.status !== 200 || !j?.token) throw Object.assign(new Error(`login HTTP ${r.status}`), { status: r.status })
  // 24 h de validade; renova 1 h antes.
  tokenCache = { token: String(j.token), ate: agora + 23 * 3600_000 }
  return tokenCache.token
}

export interface Tentativa {
  parametro: string
  tipo: 'placa' | 'chassi'
  http: number | null
  ms: number
  bruto: any
  resposta: RespostaParceiro | null
  erro: string | null
}

/**
 * Uma chamada (com 1 relogin em 401). Nunca lanca. Each HTTP step has at most
 * TIMEOUT_PARCEIRO_MS, body included, and none goes past `ate` (the deadline
 * of the calls of the order, under its lock).
 */
export async function chamarParceiro(cfg: CfgParceiro, parametro: string, tipo: 'placa' | 'chassi', http: Http, agora = Date.now(), ate = Date.now() + 4 * TIMEOUT_PARCEIRO_MS): Promise<Tentativa> {
  const t0 = Date.now()
  const base: Tentativa = { parametro, tipo, http: null, ms: 0, bruto: null, resposta: null, erro: null }
  try {
    let token = tokenCache && tokenCache.ate > agora ? tokenCache.token : await login(cfg, http, agora, ate)
    const fazer = (tk: string) => passo(http, `${cfg.base}/api/Consultas/LeilaoSinistro?parametro=${encodeURIComponent(parametro)}`, {
      method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
    }, ate)
    let r = await fazer(token)
    if (r.status === 401) { tokenCache = null; token = await login(cfg, http, agora, ate); r = await fazer(token) }
    const corpo = r.corpo
    let bruto: any = corpo
    try { bruto = JSON.parse(corpo) } catch { /* guarda o texto */ }
    const resposta = r.status === 200 ? parsearRespostaParceiro(bruto) : null
    return {
      ...base, http: r.status, ms: Date.now() - t0, bruto, resposta,
      erro: r.status !== 200 ? `HTTP ${r.status}: ${String(typeof bruto === 'string' ? bruto : JSON.stringify(bruto)).slice(0, 200)}` : resposta ? null : 'resposta sem leilao nem sinistro',
    }
  } catch (e: any) {
    return { ...base, http: e?.status ?? null, ms: Date.now() - t0, erro: e?.name === 'AbortError' ? String(e?.message || 'timeout').slice(0, 80) : String(e?.message || e).slice(0, 200) }
  }
}

/** 400 por saldo pre-pago ou limite mensal: alerta na hora. */
export function ehSaldoOuLimite(t: Pick<Tentativa, 'http' | 'bruto'>): boolean {
  if (t.http !== 400) return false
  const s = (typeof t.bruto === 'string' ? t.bruto : JSON.stringify(t.bruto || '')).normalize('NFD').replace(/[̀-ͯ]/g, '')
  return /saldo|limite|credito|franquia|pre-?pago|insuficiente/i.test(s)
}

// ---------------------------------------------------------------- banco

export interface LinhaChamada {
  pedido_id: string | null
  placa: string | null
  parametro_enviado: string | null
  tipo_parametro: 'placa' | 'chassi' | null
  id_consulta_parceiro?: string | null
  data_consulta_parceiro?: string | null
  tempo_parceiro_ms?: number | null
  tempo_total_ms?: number | null
  http_status?: number | null
  cobrada: boolean
  preco_centavos: number
  motivo_erro?: string | null
  tem_registro_leilao?: boolean | null
  n_leiloes?: number | null
  indicio_sinistro?: boolean | null
  mensagem_sinistro?: string | null
  nossa_base_vazia: boolean
  cache_hit: boolean
  resposta_bruta?: any
}

/** Devolve 'duplicada' quando o banco barrou uma segunda linha cobrada do mesmo pedido. */
async function gravarLinha(sb: any, l: LinhaChamada): Promise<'ok' | 'duplicada' | 'erro'> {
  try {
    const { error } = await sb.from('parceiro_leilao_chamadas').insert(l)
    if (!error) return 'ok'
    // Unique parcial (pedido_id) where cobrada: o codigo deixou passar uma
    // segunda chamada paga. A cobranca aconteceu (o fornecedor cobra), entao a
    // linha entra mesmo assim, marcada, sem violar o indice.
    if (error.code === '23505' && l.cobrada) {
      await sb.from('parceiro_leilao_chamadas').insert({ ...l, cobrada: false, motivo_erro: 'COBRANCA DUPLICADA: o banco barrou a 2a linha cobrada deste pedido (o fornecedor cobrou)' })
      return 'duplicada'
    }
    console.warn('[parceiro-leilao] linha de auditoria falhou:', error.message)
    return 'erro'
  } catch (e: any) { console.warn('[parceiro-leilao] linha de auditoria falhou:', e?.message || e); return 'erro' }
}

async function gravarCusto(sb: any, pedidoId: string | null, t: Tentativa, cobrada: boolean, motivo?: MotivoReserva | null): Promise<void> {
  try {
    const detalhe = cobrada ? `idConsulta ${t.resposta?.idConsulta || '?'}` : `erro: ${String(t.erro || '').slice(0, 160)}`
    await sb.from('premium_custos').insert({
      pedido_id: pedidoId, fonte: FONTE_CUSTO_PARCEIRO, preco: cobrada ? PRECO_PARCEIRO_CENTAVOS / 100 : 0, code: t.http ?? 0,
      // Why it ran, when it ran as the complement of the vehicle history (to measure each rule).
      detalhe: motivo ? `${detalhe}; motivo ${motivo}` : detalhe,
    })
  } catch { /* custo nunca derruba o relatorio */ }
}

/** Inicio do dia em Brasilia (UTC-3), em ISO. */
export function inicioDoDiaBrasilia(agora = Date.now()): string {
  const brt = new Date(agora - 3 * 3600_000)
  return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate(), 3, 0, 0)).toISOString()
}

async function chamadasHoje(sb: any, agora: number): Promise<number> {
  const { count, error } = await sb.from('parceiro_leilao_chamadas').select('id', { count: 'exact', head: true })
    .eq('cache_hit', false).gte('criado_em', inicioDoDiaBrasilia(agora))
  if (error) throw new Error(error.message)
  return Number(count) || 0
}

const linhaDe = (t: Tentativa, ctx: { pedidoId: string | null; placa: string | null }, extra: Partial<LinhaChamada> = {}): LinhaChamada => {
  const r = t.resposta
  const cobrada = t.http === 200 && !!r
  return {
    pedido_id: ctx.pedidoId, placa: ctx.placa, parametro_enviado: t.parametro, tipo_parametro: t.tipo,
    id_consulta_parceiro: r?.idConsulta ?? null, data_consulta_parceiro: r?.dataConsulta ?? null,
    tempo_parceiro_ms: r?.tempoMs ?? null, tempo_total_ms: t.ms, http_status: t.http,
    cobrada, preco_centavos: cobrada ? PRECO_PARCEIRO_CENTAVOS : 0, motivo_erro: t.erro,
    tem_registro_leilao: r ? r.temRegistro : null, n_leiloes: r ? r.leiloes.length : null,
    indicio_sinistro: r ? r.sinistro.indicio : null, mensagem_sinistro: r?.sinistro.mensagem ?? null,
    nossa_base_vazia: true, cache_hit: false, resposta_bruta: t.bruto ?? null, ...extra,
  }
}

// ---------------------------------------------------------------- orquestracao

export interface DepsParceiro {
  sb: any
  cfg: CfgParceiro
  /** Pausa entre as olhadas enquanto outra geracao do mesmo pedido consulta (teste injeta). */
  esperar?: (ms: number) => Promise<void>
  /** Identidade desta tentativa no lock por pedido (teste injeta). */
  dono?: string
  /** Aviso ao cliente de leilao/sinistro tardio (teste injeta). */
  avisarLeilao?: (sb: any, pedidoId: string, antes: any, depois: any) => Promise<unknown>
  http?: Http
  alertar?: (assunto: string, texto: string) => Promise<unknown>
  agora?: number
  log?: (m: string) => void
  /**
   * The vehicle history partner failed for this order, or came complete with a
   * bank or insurer in the chain (shared/historico-veicular.ts,
   * historicoPedeReserva): with it on, this one runs only then, under the same rules.
   */
  reservaDoHistorico?: boolean
  /**
   * Why it runs as that (motivoDaReserva): goes to the state (parceiro.motivo),
   * the cost detail and the log, never with the plate.
   */
  motivoReserva?: MotivoReserva | null
  /**
   * Manual operator run: the state it leaves carries semAviso, and no customer
   * e-mail comes out of it, now or in the job's retry.
   */
  semAviso?: boolean
  /** Deadline of all the HTTP steps of the order (PRAZO_CHAMADAS_MS; tests inject a short one). */
  prazoTotalMs?: number
}

let alertaTetoDia: string | null = null
/** So pra teste. */
export function _limparAlertaTeto() { alertaTetoDia = null }

/**
 * Completa o historico de leilao do pedido com a base parceira, quando cabe.
 * Devolve o historico (mudado ou nao). Nunca lanca: o relatorio nao trava.
 * As the fallback of the vehicle history partner (reservaDoHistorico), the
 * state it leaves says so (parceiro.reserva) and why (parceiro.motivo).
 */
export async function complementarLeilaoParceiro(
  pedido: { id: string | null; placa: string; plano?: string | null },
  historico: any,
  perfil: { chassi?: string | null },
  deps: DepsParceiro,
): Promise<any> {
  const novo = await complementarSemMarca(pedido, historico, perfil, deps)
  const marca = {
    ...(deps.reservaDoHistorico ? { reserva: true } : {}),
    ...(deps.reservaDoHistorico && deps.motivoReserva ? { motivo: deps.motivoReserva } : {}),
    ...(deps.semAviso ? { semAviso: true } : {}),
  }
  if (!Object.keys(marca).length || novo === historico || !novo?.parceiro) return novo
  return { ...novo, parceiro: { ...novo.parceiro, ...marca } }
}

async function complementarSemMarca(
  pedido: { id: string | null; placa: string; plano?: string | null },
  historico: any,
  perfil: { chassi?: string | null },
  deps: DepsParceiro,
): Promise<any> {
  const agora = deps.agora ?? Date.now()
  const log = deps.log ?? ((m: string) => console.info(m))
  const alertar = deps.alertar ?? (async (assunto: string, texto: string) => sendErrorEmail({ endpoint: '/premium/parceiro-leilao', errorMessage: `${assunto}<br>${texto}`, paraTambem: [AVISO] }))
  const http: Http = deps.http ?? ((url, init) => fetch(url, init as any) as any)
  // Why it runs as the complement of the vehicle history: in the log and the cost detail.
  const motivo = deps.reservaDoHistorico ? deps.motivoReserva ?? null : null
  const comMotivo = motivo ? ` motivo=${motivo}` : ''
  try {
    if (pedido.plano && pedido.plano !== 'completa') return historico
    if (!deps.cfg.ligado || !deps.cfg.usuario || !deps.cfg.senha) return historico
    // Never both partners for the same order: with the vehicle history partner
    // on, this one runs only as its fallback, for an order where it failed.
    if (deps.cfg.historicoLigado && !deps.reservaDoHistorico) return historico
    if (!nossaBaseVazia(historico)) return historico
    if (historico?.parceiro?.status === 'ok') return historico

    const placa = chaveDePlaca(pedido.placa)
    const chassi = String(perfil.chassi || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const ctxLinha = { pedidoId: pedido.id, placa }
    const juntar = (r: RespostaParceiro, tipo: 'placa' | 'chassi', quando: string) => historicoComParceiro(historico, r, { chassi, tipo, consultadoEm: quando })

    // Ja existe resposta para este pedido ou esta placa/chassi? (cache valido
    // ou linha cobrada do pedido): reaproveita, nao chama nem cobra.
    const jaTem = async (): Promise<any | null> => {
      for (const [tipo, chave] of [['placa', placa], ['chassi', chassi]] as const) {
        if (!chave) continue
        const hit = await lerFonteCache<any>(deps.sb, FONTE_CACHE_PARCEIRO, `${tipo}:${chave}`, agora)
        const r = hit ? parsearRespostaParceiro(hit.payload?.bruto ?? hit.payload) : null
        if (r) {
          await gravarLinha(deps.sb, { ...linhaDe({ parametro: chave, tipo, http: null, ms: 0, bruto: hit!.payload?.bruto ?? hit!.payload, resposta: r, erro: null }, ctxLinha), cobrada: false, preco_centavos: 0, cache_hit: true })
          log(`[parceiro-leilao] cache ${tipo} pedido=${pedido.id || '-'}${comMotivo}`)
          return juntar(r, tipo, hit!.consultadoEm)
        }
      }
      if (pedido.id) {
        const { data: paga } = await deps.sb.from('parceiro_leilao_chamadas').select('resposta_bruta,tipo_parametro,criado_em')
          .eq('pedido_id', pedido.id).eq('cobrada', true).order('criado_em', { ascending: false }).limit(1).maybeSingle()
        const r = paga ? parsearRespostaParceiro(paga.resposta_bruta) : null
        if (r) return juntar(r, paga.tipo_parametro === 'chassi' ? 'chassi' : 'placa', paga.criado_em)
      }
      return null
    }
    const pronto = await jaTem()
    if (pronto) return pronto

    // Lock por pedido (21/out/2026, caso BCK2C28 cobrado 2x): a geracao do
    // relatorio, o lazy-fill da pagina (varias abas/polls) e o job nao podem
    // chamar juntos. Quem nao pega o lock espera a outra terminar e reaproveita.
    let lockDesde: number | null = null
    if (pedido.id) {
      const dono = deps.dono ?? `${process.pid}:${Math.random().toString(36).slice(2, 10)}`
      let pegou = false
      try {
        const antesDoLock = Date.now()
        const { data, error } = await deps.sb.rpc('job_lock_pegar', { p_nome: `parceiro:${pedido.id}`, p_dono: dono, p_segundos: LOCK_PEDIDO_S })
        if (error) throw new Error(error.message)
        pegou = data === true
        if (pegou) lockDesde = antesDoLock
      } catch (e: any) {
        log(`[parceiro-leilao] sem lock do pedido (${String(e?.message || e).slice(0, 80)}): nao chama`)
        return { ...historico, parceiro: { status: 'falhou', consultado_em: new Date(agora).toISOString() } as EstadoParceiro }
      }
      if (!pegou) {
        const esperar = deps.esperar ?? ((ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)))
        for (let i = 0; i < ESPERA_LOCK_VOLTAS; i++) {
          await esperar(1000)
          const r = await jaTem()
          if (r) return r
        }
        // A outra geracao ainda nao terminou (ou falhou): esta segue sem a
        // fonte e sem marcar estado; quem tem o lock grava o resultado.
        log(`[parceiro-leilao] pedido=${pedido.id} com consulta em andamento em outra geracao: segue sem chamar`)
        return historico
      }
      // Pegou o lock: a outra pode ter terminado entre a olhada e o lock.
      const depois = await jaTem()
      if (depois) return depois
    }

    // 3. Teto diario.
    let feitas = 0
    try { feitas = await chamadasHoje(deps.sb, agora) } catch (e: any) {
      log(`[parceiro-leilao] sem contagem do teto (${String(e?.message || e).slice(0, 80)}): nao chama`)
      return { ...historico, parceiro: { status: 'falhou', consultado_em: new Date(agora).toISOString() } as EstadoParceiro }
    }
    if (feitas >= deps.cfg.tetoDia) {
      const dia = inicioDoDiaBrasilia(agora)
      if (alertaTetoDia !== dia) {
        alertaTetoDia = dia
        await Promise.resolve(alertar('BASE PARCEIRA DE LEILAO: TETO DIARIO ATINGIDO', `${feitas} chamadas hoje (teto ${deps.cfg.tetoDia}). Os relatorios seguem sem a fonte; o job tenta de novo depois.`)).catch(() => {})
      }
      log(`[parceiro-leilao] teto diario atingido (${feitas}/${deps.cfg.tetoDia}) pedido=${pedido.id || '-'}${comMotivo}`)
      return { ...historico, parceiro: { status: 'teto', consultado_em: new Date(agora).toISOString() } as EstadoParceiro }
    }

    // 4. Chamada: placa; se der erro e houver chassi, chassi. Every HTTP step,
    // body included, ends before the lease of the per-order lock does.
    const ate = (lockDesde ?? Date.now()) + (deps.prazoTotalMs ?? PRAZO_CHAMADAS_MS)
    const tentativas: Tentativa[] = []
    const tentar = async (parametro: string, tipo: 'placa' | 'chassi') => {
      const t = await chamarParceiro(deps.cfg, parametro, tipo, http, agora, ate)
      tentativas.push(t)
      const cobrada = t.http === 200 && !!t.resposta
      const gravou = await gravarLinha(deps.sb, linhaDe(t, ctxLinha))
      if (gravou === 'duplicada') await Promise.resolve(alertar('BASE PARCEIRA DE LEILAO: COBRANCA DUPLICADA', `Pedido ${pedido.id || '-'} foi cobrado de novo (idConsulta ${t.resposta?.idConsulta || '?'}). O lock deveria ter barrado: investigar.`)).catch(() => {})
      await gravarCusto(deps.sb, pedido.id, t, cobrada, motivo)
      if (ehSaldoOuLimite(t)) await Promise.resolve(alertar('BASE PARCEIRA DE LEILAO: SALDO OU LIMITE', `HTTP 400 ao consultar ${tipo} do pedido ${pedido.id || '-'}: ${String(t.erro || '').slice(0, 200)}`)).catch(() => {})
      log(`[parceiro-leilao] ${tipo} pedido=${pedido.id || '-'} http=${t.http ?? '-'} ${cobrada ? `ok id=${t.resposta!.idConsulta}` : `erro=${t.erro}`} ${t.ms}ms${comMotivo}`)
      return cobrada ? t : null
    }
    const ok = placa ? await tentar(placa, 'placa') : null
    // The VIN attempt only with time left before the deadline (it would only time out).
    const tempoParaChassi = ate - Date.now() >= TEMPO_MINIMO_TENTATIVA_MS
    const final = ok || (chassi.length === 17 && tempoParaChassi && !ehSaldoOuLimite(tentativas[tentativas.length - 1] || { http: null, bruto: null }) ? await tentar(chassi, 'chassi') : null)
    if (!final) return { ...historico, parceiro: { status: 'falhou', consultado_em: new Date(agora).toISOString() } as EstadoParceiro }

    const quando = new Date(agora).toISOString()
    // Bruto inteiro no cache, pelas duas chaves que o servem.
    await gravarFonteCache(deps.sb, FONTE_CACHE_PARCEIRO, `${final.tipo}:${final.tipo === 'placa' ? placa : chassi}`, { bruto: final.bruto }, 'ok', agora)
    if (final.tipo === 'chassi' && placa) await gravarFonteCache(deps.sb, FONTE_CACHE_PARCEIRO, `placa:${placa}`, { bruto: final.bruto }, 'ok', agora)
    return juntar(final.resposta!, final.tipo, quando)
  } catch (e: any) {
    log(`[parceiro-leilao] falhou (relatorio segue): ${String(e?.message || e).slice(0, 160)}`)
    return historico
  }
}

// ---------------------------------------------------------------- job de complemento

/**
 * The retry job (server/plugins/parceiro-leilao.ts) runs whenever this source
 * is on, also with the vehicle history partner on: then rodarJobParceiro
 * takes only the orders where this source is that one's fallback.
 */
export function jobParceiroDeveRodar(cfg: CfgParceiro): boolean {
  return cfg.ligado
}

export const PARCEIRO_NOME_LOCK = 'parceiro-leilao'
export const PARCEIRO_INTERVALO_MS = 15 * 60 * 1000
export const PARCEIRO_LEASE_S = 10 * 60
export const PARCEIRO_JANELA_DIAS = 7
export const PARCEIRO_MAX_POR_RODADA = 10
/**
 * Vehicle history jobs the queue gave up on within this window are looked at
 * again by the job (safety net: a lease that expired on the last attempt
 * never ran its fallback). A few rounds, so an order is not read for days.
 */
export const PARCEIRO_ESGOTADO_JANELA_MS = 60 * 60 * 1000
/** Queue source of the vehicle history partner (premium_jobs.fonte). */
const FONTE_FILA_HISTORICO = 'historico_veicular'

/** VIN in the paid query stored in the snapshot (object, or a one-item list in older rows). */
function chassiDaResposta(r: any): string | null {
  const b = Array.isArray(r) ? r[0] : r
  return b && typeof b === 'object' && typeof b.chassi === 'string' ? b.chassi : null
}

/**
 * The auction section as the page shows it: the stored history merged with
 * the vehicle history (report.get does the same on every read). The late
 * notice compares these views, so no e-mail goes out for what the page
 * already showed from a partial vehicle history.
 */
function leilaoNaTela(historicoLeilao: any, snap: any): any {
  return historicoLeilaoComHistorico(historicoLeilao, snap?.historicoVeicular ?? null, { chassi: chassiDaResposta(snap?.consulta?.response) })
}

export type ResultadoReserva = 'ok' | 'falhou' | 'teto' | 'pulado' | 'erro'

/**
 * Fallback of the vehicle history partner for ONE delivered order (Cesar,
 * 17/11/2026): that partner failed for it (charged but partial answer, answer
 * for another VIN, or the queue gave up), or came complete with a bank or
 * insurer in the chain and no auction record of its own (18/11/2026), so this
 * one is called under its usual rules (Completa only,
 * our base empty, 30-day cache and the paid call of the order reused, lock
 * per order, daily ceiling). Only the first attempt: a failed or capped call
 * is retried once by rodarJobParceiro. Writes only historicoLeilao, reading
 * the snapshot again first, and tells the customer (once, aviso_leilao_em)
 * when an auction or a damage sign shows up. Never throws.
 */
export async function leilaoParceiroComoReserva(
  sb: any,
  pedidoId: string,
  deps: Partial<Omit<DepsParceiro, 'sb'>> = {},
): Promise<ResultadoReserva> {
  const log = deps.log ?? ((m: string) => console.info(m))
  const ref = String(pedidoId || '-').slice(0, 8)
  // A read or write that failed: logged with the internal id and a flag only
  // (never the snapshot), 'erro' so the queue can try again.
  const erro = (etapa: string): ResultadoReserva => {
    log(`[parceiro-leilao] reserva do historico pedido=${ref}: pulado (${etapa} falhou)`)
    return 'erro'
  }
  try {
    const cfg = deps.cfg ?? cfgParceiro(useRuntimeConfig())
    if (!cfg.ligado || !pedidoId) return 'pulado'
    const ler = async (): Promise<{ p: any } | null> => {
      const { data, error } = await sb.from('pedidos_premium').select('id,placa,plano,status,relatorio_snapshot').eq('id', pedidoId).maybeSingle()
      return error ? null : { p: data }
    }
    const lido = await ler()
    if (!lido) return erro('leitura')
    const p = lido.p
    const snap = p?.relatorio_snapshot
    if (!p || p.plano !== 'completa' || !snap || typeof snap !== 'object') return 'pulado'
    // Why it runs (motivoDaReserva). The caller that has the block in hand
    // gives it (deps.motivoReserva): its snapshot write may have failed, and
    // the stored block would then read as no answer (review of PR #761).
    // Otherwise it comes from the stored block: the caller decided the
    // vehicle history failed for this order (partial, another VIN, or no good
    // answer once the queue gave up or gives up now, hence 'esgotado'). A
    // complete answer for this vehicle (stored after a lease expired, or a
    // manual redo) needs no fallback, unless it shows a bank or insurer in
    // the chain and no auction record of its own (18/11/2026).
    const motivo = deps.motivoReserva ?? motivoDaReserva(snap.historicoVeicular, 'esgotado')
    if (!motivo) return 'pulado'
    const antes = snap.historicoLeilao
    // Already tried for this order (any state): the retry belongs to the job.
    if (antes?.parceiro) return 'pulado'
    if (!nossaBaseVazia(antes)) return 'pulado'
    const novo = await complementarLeilaoParceiro(
      { id: p.id, placa: p.placa, plano: p.plano }, antes, { chassi: chassiDaResposta(snap.consulta?.response) },
      { ...deps, sb, cfg, reservaDoHistorico: true, motivoReserva: motivo },
    )
    const status = novo?.parceiro?.status as 'ok' | 'falhou' | 'teto' | undefined
    // No state: another run of this order holds the lock and writes its own result.
    if (!status) return 'pulado'
    const relido = await ler()
    if (!relido) return erro('releitura')
    const atual = relido.p?.relatorio_snapshot
    if (!atual || typeof atual !== 'object' || atual.historicoLeilao?.parceiro?.status === 'ok') return 'pulado'
    const { error: erroGravar } = await sb.from('pedidos_premium').update({ relatorio_snapshot: { ...atual, historicoLeilao: novo } }).eq('id', p.id)
    if (erroGravar) return erro('gravacao')
    // Auction or damage sign that the page did not show before: tells the
    // customer (once). Both sides as the page shows them (merged with the
    // vehicle history), so a partial answer that already showed it does not
    // count as new. Never for a manual operator run (semAviso).
    if (status === 'ok' && !novo.parceiro?.semAviso) await (deps.avisarLeilao ?? avisarLeilaoTardio)(sb, p.id, leilaoNaTela(atual.historicoLeilao ?? antes, atual), leilaoNaTela(novo, atual))
    log(`[parceiro-leilao] reserva do historico pedido=${ref}: ${status} motivo=${motivo}`)
    return status
  } catch (e: any) {
    return erro(`excecao ${String(e?.name || 'Error').slice(0, 40)}`)
  }
}

/**
 * Pedido cuja consulta a base parceira falhou (ou parou no teto) na geracao:
 * tenta de novo UMA vez (como fotos-depois/DETRAN), respeitando o teto. Teto
 * atingido de novo nao gasta a tentativa. Grava so historicoLeilao. Nunca lanca.
 * With the vehicle history partner on, only orders where this one ran as its
 * fallback (parceiro.reserva), plus orders whose vehicle history job the queue
 * has just given up on (safety net for a fallback that never ran).
 */
export async function rodarJobParceiro(deps: DepsParceiro & { dono: string }): Promise<{ rodou: boolean; vistos: number; completados: number }> {
  const agora = deps.agora ?? Date.now()
  const log = deps.log ?? ((m: string) => console.info(m))
  const out = { rodou: false, vistos: 0, completados: 0 }
  if (!deps.cfg.ligado) return out
  const soReserva = !!deps.cfg.historicoLigado
  try {
    const { data, error } = await deps.sb.rpc('job_lock_pegar', { p_nome: PARCEIRO_NOME_LOCK, p_dono: deps.dono, p_segundos: PARCEIRO_LEASE_S })
    if (error || data !== true) return out
  } catch { return out }
  out.rodou = true
  try {
    const desde = new Date(agora - PARCEIRO_JANELA_DIAS * 86400_000).toISOString()
    let consulta = deps.sb.from('pedidos_premium')
      .select('id,placa,plano,historicoLeilao:relatorio_snapshot->historicoLeilao,chassi:relatorio_snapshot->consulta->response->0->chassi,historicoVeicular:relatorio_snapshot->historicoVeicular')
      .eq('status', 'entregue').eq('plano', 'completa').gte('entregue_em', desde)
      .in('relatorio_snapshot->historicoLeilao->parceiro->>status', ['falhou', 'teto'])
    // Vehicle history partner on: only the orders where this one is its fallback.
    if (soReserva) consulta = consulta.eq('relatorio_snapshot->historicoLeilao->parceiro->>reserva', 'true')
    const { data: pedidos, error } = await consulta
      .order('entregue_em', { ascending: true })
      .limit(PARCEIRO_MAX_POR_RODADA * 3)
    if (error) throw new Error(error.message)
    const candidatos = (pedidos || []).filter((x: any) => !x.historicoLeilao?.parceiro?.retentado && (!soReserva || x.historicoLeilao?.parceiro?.reserva === true))
    for (const p of candidatos.slice(0, PARCEIRO_MAX_POR_RODADA)) {
      out.vistos++
      // Why the fallback still runs (motivoDaReserva). None: the vehicle
      // history came complete since it started, without a bank or insurer in
      // the chain (a lease that expired after a complete answer was stored, a
      // manual redo), so the retry is spent without a call.
      const motivo = soReserva ? motivoDaReserva(p.historicoVeicular, 'esgotado') : null
      const dispensado = soReserva && !motivo
      // A fallback started by a manual operator run keeps its mark: the data
      // goes in, the customer gets no e-mail from it.
      const semAviso = p.historicoLeilao?.parceiro?.semAviso === true
      const novo = dispensado ? p.historicoLeilao : await complementarLeilaoParceiro({ id: p.id, placa: p.placa, plano: p.plano }, p.historicoLeilao, { chassi: typeof p.chassi === 'string' ? p.chassi : null }, { ...deps, agora, reservaDoHistorico: soReserva, semAviso, motivoReserva: motivo })
      const status = dispensado ? null : novo?.parceiro?.status
      if (status === 'teto') break // o teto vale pra todos: para a rodada sem gastar tentativa
      const gravar = status === 'ok' ? novo : { ...p.historicoLeilao, parceiro: { ...(p.historicoLeilao?.parceiro || {}), retentado: true } }
      // Rele o snapshot e troca so historicoLeilao (outros blocos tambem escrevem nele).
      const { data: atual } = await deps.sb.from('pedidos_premium').select('relatorio_snapshot').eq('id', p.id).maybeSingle()
      if (!atual?.relatorio_snapshot) continue
      await deps.sb.from('pedidos_premium').update({ relatorio_snapshot: { ...atual.relatorio_snapshot, historicoLeilao: gravar } }).eq('id', p.id)
      // Leilao ou sinistro que apareceu depois da entrega: avisa o cliente (uma
      // vez). Both sides as the page shows them (merged with the vehicle
      // history). Never for a fallback started by an operator run (semAviso).
      if (status === 'ok' && !gravar.parceiro?.semAviso) await (deps.avisarLeilao ?? avisarLeilaoTardio)(deps.sb, p.id, leilaoNaTela(atual.relatorio_snapshot?.historicoLeilao ?? p.historicoLeilao, atual.relatorio_snapshot), leilaoNaTela(gravar, atual.relatorio_snapshot))
      if (status === 'ok') out.completados++
      log(`[parceiro-leilao] job pedido=${p.id}: ${status === 'ok' ? 'completado' : dispensado ? 'historico veio completo (sem chamada)' : 'falhou de novo (nao tenta mais)'}${motivo ? ` motivo=${motivo}` : ''}`)
    }
    if (soReserva) {
      // Safety net: the queue gave up on the vehicle history of these orders
      // just now. The fallback normally ran in the last attempt; when that
      // attempt never finished (lease expired), it runs here. Orders already
      // tried, outside the plan or with something in our base are skipped.
      // Most recent first: the window is short, so those never wait behind older ones.
      const { data: esgotados } = await deps.sb.from('premium_jobs').select('pedido_id')
        .eq('fonte', FONTE_FILA_HISTORICO).eq('status', 'esgotado')
        .gte('concluido_em', new Date(agora - PARCEIRO_ESGOTADO_JANELA_MS).toISOString())
        .order('concluido_em', { ascending: false })
        .limit(PARCEIRO_MAX_POR_RODADA)
      for (const j of Array.isArray(esgotados) ? esgotados : []) {
        const r = await leilaoParceiroComoReserva(deps.sb, j.pedido_id, { ...deps, agora })
        // pulado: nothing to do; erro: logged, the next round (within the window) tries again.
        if (r === 'pulado' || r === 'erro') continue
        out.vistos++
        if (r === 'ok') out.completados++
        if (r === 'teto') break
      }
    }
  } catch (e: any) {
    log(`[parceiro-leilao] job falhou: ${String(e?.message || e).slice(0, 160)}`)
  }
  return out
}
