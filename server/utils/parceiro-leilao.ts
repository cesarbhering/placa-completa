import { avisarLeilaoTardio } from './aviso-leilao'
import { lerFonteCache, gravarFonteCache, chaveDePlaca } from './fonte-cache'
import {
  parsearRespostaParceiro, historicoComParceiro, nossaBaseVazia,
  type RespostaParceiro, type EstadoParceiro,
} from '../../shared/fonte-parceira'

// Cliente INTERNO da base parceira de leiloes e sinistros (Avaliservice).
// Plano do Cesar (20/out/2026). O nome do fornecedor so existe aqui, em
// premium_custos, fonte_cache e nos logs do servidor; tudo que sai para o
// cliente usa o rotulo de shared/fonte-parceira.ts.
//
// Regras:
//  - so Relatorio Completo, so quando a NOSSA base devolveu zero passagens e
//    sem indicio (historico presente e vazio; historico null = nossa base nao
//    respondeu, entao nao chama);
//  - liga/desliga NUXT_AVALISERVICE_LIGADO (default desligado); teto diario
//    NUXT_AVALISERVICE_TETO_DIA (40): atingido, segue sem a fonte e alerta;
//  - login com usuario/senha -> JWT de 24 h em memoria; 401 refaz o login 1 vez;
//  - timeout 15 s; chama pela placa e, se der erro e houver chassi, pelo chassi
//    (erro nao e cobrado, entao continua uma cobranca por pedido);
//  - HTTP 400 com corpo de saldo/limite: alerta na hora;
//  - bruto inteiro em fonte_cache (30 d; cache hit nao chama nem cobra) e em
//    parceiro_leilao_chamadas (uma linha por tentativa, inclusive cache hit);
//  - custo em premium_custos ('avaliservice_leilao_sinistro', 6,00; erro 0).

export const FONTE_CACHE_PARCEIRO = 'avaliservice'
export const FONTE_CUSTO_PARCEIRO = 'avaliservice_leilao_sinistro'
export const PRECO_PARCEIRO_CENTAVOS = 600
export const TIMEOUT_PARCEIRO_MS = 15_000
/** Lease do lock por pedido: maior que placa + chassi com timeout (2 x 15 s). */
export const LOCK_PEDIDO_S = 60
/** Quanto quem ficou sem o lock espera a outra geracao (segundos). */
export const ESPERA_LOCK_VOLTAS = 20
const BASE_PADRAO = 'https://api.avaliservice.com.br'
const AVISO = 'cesarcbhering@gmail.com'

export interface CfgParceiro { ligado: boolean; usuario: string; senha: string; tetoDia: number; base: string }

export function cfgParceiro(config: any): CfgParceiro {
  const lig = String(config?.avaliserviceLigado ?? '').trim().toLowerCase()
  const teto = Number(config?.avaliserviceTetoDia)
  return {
    ligado: ['1', 'on', 'true', 'sim'].includes(lig),
    usuario: String(config?.avaliserviceUser || ''),
    senha: String(config?.avaliservicePass || ''),
    tetoDia: Number.isFinite(teto) && teto >= 0 ? teto : 40,
    base: String(config?.avaliserviceUrl || BASE_PADRAO).replace(/\/+$/, ''),
  }
}

// ---------------------------------------------------------------- HTTP

export interface Http { (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }): Promise<{ status: number; text: () => Promise<string> }> }

let tokenCache: { token: string; ate: number } | null = null
/** So pra teste. */
export function _limparTokenParceiro() { tokenCache = null }

async function comTimeout<T>(ms: number, fn: (s: AbortSignal) => Promise<T>): Promise<T> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try { return await fn(c.signal) } finally { clearTimeout(t) }
}

async function login(cfg: CfgParceiro, http: Http, agora: number): Promise<string> {
  const r = await comTimeout(TIMEOUT_PARCEIRO_MS, (signal) => http(`${cfg.base}/api/Auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: cfg.usuario, password: cfg.senha }), signal,
  }))
  const corpo = await r.text()
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

/** Uma chamada (com 1 relogin em 401). Nunca lanca. */
export async function chamarParceiro(cfg: CfgParceiro, parametro: string, tipo: 'placa' | 'chassi', http: Http, agora = Date.now()): Promise<Tentativa> {
  const t0 = Date.now()
  const base: Tentativa = { parametro, tipo, http: null, ms: 0, bruto: null, resposta: null, erro: null }
  try {
    let token = tokenCache && tokenCache.ate > agora ? tokenCache.token : await login(cfg, http, agora)
    const fazer = (tk: string) => comTimeout(TIMEOUT_PARCEIRO_MS, (signal) => http(`${cfg.base}/api/Consultas/LeilaoSinistro?parametro=${encodeURIComponent(parametro)}`, {
      method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' }, signal,
    }))
    let r = await fazer(token)
    if (r.status === 401) { tokenCache = null; token = await login(cfg, http, agora); r = await fazer(token) }
    const corpo = await r.text()
    let bruto: any = corpo
    try { bruto = JSON.parse(corpo) } catch { /* guarda o texto */ }
    const resposta = r.status === 200 ? parsearRespostaParceiro(bruto) : null
    return {
      ...base, http: r.status, ms: Date.now() - t0, bruto, resposta,
      erro: r.status !== 200 ? `HTTP ${r.status}: ${String(typeof bruto === 'string' ? bruto : JSON.stringify(bruto)).slice(0, 200)}` : resposta ? null : 'resposta sem leilao nem sinistro',
    }
  } catch (e: any) {
    return { ...base, http: e?.status ?? null, ms: Date.now() - t0, erro: e?.name === 'AbortError' ? `timeout ${TIMEOUT_PARCEIRO_MS} ms` : String(e?.message || e).slice(0, 200) }
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

async function gravarCusto(sb: any, pedidoId: string | null, t: Tentativa, cobrada: boolean): Promise<void> {
  try {
    await sb.from('premium_custos').insert({
      pedido_id: pedidoId, fonte: FONTE_CUSTO_PARCEIRO, preco: cobrada ? PRECO_PARCEIRO_CENTAVOS / 100 : 0, code: t.http ?? 0,
      detalhe: cobrada ? `idConsulta ${t.resposta?.idConsulta || '?'}` : `erro: ${String(t.erro || '').slice(0, 160)}`,
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
}

let alertaTetoDia: string | null = null
/** So pra teste. */
export function _limparAlertaTeto() { alertaTetoDia = null }

/**
 * Completa o historico de leilao do pedido com a base parceira, quando cabe.
 * Devolve o historico (mudado ou nao). Nunca lanca: o relatorio nao trava.
 */
export async function complementarLeilaoParceiro(
  pedido: { id: string | null; placa: string; plano?: string | null },
  historico: any,
  perfil: { chassi?: string | null },
  deps: DepsParceiro,
): Promise<any> {
  const agora = deps.agora ?? Date.now()
  const log = deps.log ?? ((m: string) => console.info(m))
  const alertar = deps.alertar ?? (async (assunto: string, texto: string) => sendErrorEmail({ endpoint: '/premium/parceiro-leilao', errorMessage: `${assunto}<br>${texto}`, paraTambem: [AVISO] }))
  const http: Http = deps.http ?? ((url, init) => fetch(url, init as any) as any)
  try {
    if (pedido.plano && pedido.plano !== 'completa') return historico
    if (!deps.cfg.ligado || !deps.cfg.usuario || !deps.cfg.senha) return historico
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
          log(`[parceiro-leilao] cache ${tipo} pedido=${pedido.id || '-'}`)
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
    if (pedido.id) {
      const dono = deps.dono ?? `${process.pid}:${Math.random().toString(36).slice(2, 10)}`
      let pegou = false
      try {
        const { data, error } = await deps.sb.rpc('job_lock_pegar', { p_nome: `parceiro:${pedido.id}`, p_dono: dono, p_segundos: LOCK_PEDIDO_S })
        if (error) throw new Error(error.message)
        pegou = data === true
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
      log(`[parceiro-leilao] teto diario atingido (${feitas}/${deps.cfg.tetoDia}) pedido=${pedido.id || '-'}`)
      return { ...historico, parceiro: { status: 'teto', consultado_em: new Date(agora).toISOString() } as EstadoParceiro }
    }

    // 4. Chamada: placa; se der erro e houver chassi, chassi.
    const tentativas: Tentativa[] = []
    const tentar = async (parametro: string, tipo: 'placa' | 'chassi') => {
      const t = await chamarParceiro(deps.cfg, parametro, tipo, http, agora)
      tentativas.push(t)
      const cobrada = t.http === 200 && !!t.resposta
      const gravou = await gravarLinha(deps.sb, linhaDe(t, ctxLinha))
      if (gravou === 'duplicada') await Promise.resolve(alertar('BASE PARCEIRA DE LEILAO: COBRANCA DUPLICADA', `Pedido ${pedido.id || '-'} foi cobrado de novo (idConsulta ${t.resposta?.idConsulta || '?'}). O lock deveria ter barrado: investigar.`)).catch(() => {})
      await gravarCusto(deps.sb, pedido.id, t, cobrada)
      if (ehSaldoOuLimite(t)) await Promise.resolve(alertar('BASE PARCEIRA DE LEILAO: SALDO OU LIMITE', `HTTP 400 ao consultar ${tipo} do pedido ${pedido.id || '-'}: ${String(t.erro || '').slice(0, 200)}`)).catch(() => {})
      log(`[parceiro-leilao] ${tipo} pedido=${pedido.id || '-'} http=${t.http ?? '-'} ${cobrada ? `ok id=${t.resposta!.idConsulta}` : `erro=${t.erro}`} ${t.ms}ms`)
      return cobrada ? t : null
    }
    const ok = placa ? await tentar(placa, 'placa') : null
    const final = ok || (chassi.length === 17 && !ehSaldoOuLimite(tentativas[tentativas.length - 1] || { http: null, bruto: null }) ? await tentar(chassi, 'chassi') : null)
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

export const PARCEIRO_NOME_LOCK = 'parceiro-leilao'
export const PARCEIRO_INTERVALO_MS = 15 * 60 * 1000
export const PARCEIRO_LEASE_S = 10 * 60
export const PARCEIRO_JANELA_DIAS = 7
export const PARCEIRO_MAX_POR_RODADA = 10

/**
 * Pedido cuja consulta a base parceira falhou (ou parou no teto) na geracao:
 * tenta de novo UMA vez (como fotos-depois/DETRAN), respeitando o teto. Teto
 * atingido de novo nao gasta a tentativa. Grava so historicoLeilao. Nunca lanca.
 */
export async function rodarJobParceiro(deps: DepsParceiro & { dono: string }): Promise<{ rodou: boolean; vistos: number; completados: number }> {
  const agora = deps.agora ?? Date.now()
  const log = deps.log ?? ((m: string) => console.info(m))
  const out = { rodou: false, vistos: 0, completados: 0 }
  if (!deps.cfg.ligado) return out
  try {
    const { data, error } = await deps.sb.rpc('job_lock_pegar', { p_nome: PARCEIRO_NOME_LOCK, p_dono: deps.dono, p_segundos: PARCEIRO_LEASE_S })
    if (error || data !== true) return out
  } catch { return out }
  out.rodou = true
  try {
    const desde = new Date(agora - PARCEIRO_JANELA_DIAS * 86400_000).toISOString()
    const { data: pedidos, error } = await deps.sb.from('pedidos_premium')
      .select('id,placa,plano,historicoLeilao:relatorio_snapshot->historicoLeilao,chassi:relatorio_snapshot->consulta->response->0->chassi')
      .eq('status', 'entregue').eq('plano', 'completa').gte('entregue_em', desde)
      .in('relatorio_snapshot->historicoLeilao->parceiro->>status', ['falhou', 'teto'])
      .order('entregue_em', { ascending: true })
      .limit(PARCEIRO_MAX_POR_RODADA * 3)
    if (error) throw new Error(error.message)
    for (const p of (pedidos || []).filter((x: any) => !x.historicoLeilao?.parceiro?.retentado).slice(0, PARCEIRO_MAX_POR_RODADA)) {
      out.vistos++
      const novo = await complementarLeilaoParceiro({ id: p.id, placa: p.placa, plano: p.plano }, p.historicoLeilao, { chassi: typeof p.chassi === 'string' ? p.chassi : null }, { ...deps, agora })
      const status = novo?.parceiro?.status
      if (status === 'teto') break // o teto vale pra todos: para a rodada sem gastar tentativa
      const gravar = status === 'ok' ? novo : { ...p.historicoLeilao, parceiro: { ...(p.historicoLeilao?.parceiro || {}), retentado: true } }
      // Rele o snapshot e troca so historicoLeilao (outros blocos tambem escrevem nele).
      const { data: atual } = await deps.sb.from('pedidos_premium').select('relatorio_snapshot').eq('id', p.id).maybeSingle()
      if (!atual?.relatorio_snapshot) continue
      await deps.sb.from('pedidos_premium').update({ relatorio_snapshot: { ...atual.relatorio_snapshot, historicoLeilao: gravar } }).eq('id', p.id)
      // Leilao ou sinistro que apareceu depois da entrega: avisa o cliente (uma vez).
      if (status === 'ok') await (deps.avisarLeilao ?? avisarLeilaoTardio)(deps.sb, p.id, atual.relatorio_snapshot?.historicoLeilao ?? p.historicoLeilao, gravar)
      if (status === 'ok') out.completados++
      log(`[parceiro-leilao] job pedido=${p.id}: ${status === 'ok' ? 'completado' : 'falhou de novo (nao tenta mais)'}`)
    }
  } catch (e: any) {
    log(`[parceiro-leilao] job falhou: ${String(e?.message || e).slice(0, 160)}`)
  }
  return out
}
