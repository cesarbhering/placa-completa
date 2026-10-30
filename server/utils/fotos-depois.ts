import { fotoRefsDaPassagem, passagemPrecisaDeFoto, type FotoRef, type FotosBuscaStatus } from '../../shared/foto-lote'

// Fotos do lote que chegam DEPOIS da venda (Cesar, 18/out/2026).
//
// O snapshot do relatorio (pedidos_premium.relatorio_snapshot) e congelado na
// venda. Quando as fotos de um lote chegam depois (backfill ou busca sob
// demanda na leiloes-api), o relatorio nao as mostrava. Este job, a cada
// 30 min (server/plugins/fotos-depois.ts), pergunta a leiloes-api
// (POST /v1/fotos-do-lote) pelas passagens sem foto e grava os foto_refs SO
// naquela passagem, por jsonb_set no banco (outros blocos tambem escrevem no
// snapshot). Sem e-mail ao cliente. Fail-open: erro aqui nunca quebra
// nada; o que nao deu volta na proxima rodada.
//
// Lock entre containers: job_lock_pegar (lease no banco, migration
// 20261018120000_fotos_depois.sql). Sem lock (migration ainda nao aplicada, banco
// fora) a rodada NAO roda.
//
// Enquanto /v1/fotos-do-lote nao existir (404 de rota, {"detail":"Not Found"}),
// a rodada para na primeira chamada, loga uma linha e tenta de novo daqui a
// 30 min. Nada e gravado. 404 "lote nao encontrado" grava sem_foto na
// passagem; 404 com outro corpo pula so ela. ~2,1 s entre chamadas (30/min por
// chave); 429 para a rodada.
// Gravacao: RPC fotos_passagem_gravar (jsonb_set so na passagem).

export const FOTOS_NOME_LOCK = 'fotos-depois'
export const FOTOS_INTERVALO_MS = 30 * 60 * 1000
/**
 * Lease de 25 min, que NAO e solto no fim da rodada: segura a "vez" do
 * intervalo inteiro. Assim, com 2 containers (troca rolling do Coolify) o job
 * roda 1 vez a cada ~30 min no total, nao 1 por container. Menor que o
 * intervalo, pra que o proximo tick (de qualquer container) pegue de novo; e
 * bem maior que a rodada mais longa (FOTOS_MAX_CHAMADAS x 8 s).
 */
export const FOTOS_LEASE_S = 25 * 60
export const FOTOS_JANELA_DIAS = 90
/** Pedidos com passagem pedindo foto tratados por rodada. */
export const FOTOS_MAX_PEDIDOS = 15
/** Teto de chamadas a API por rodada (a chave e compartilhada com /v1/foto-link, 600/h). */
export const FOTOS_MAX_CHAMADAS = 40
/** A API aceita 30 pedidos/min por chave: ~2,1 s entre chamadas. */
export const FOTOS_PAUSA_MS = 2100

const DIA_MS = 24 * 60 * 60 * 1000

export type RespostaFotos = { status: 'ok' | 'buscando' | 'sem_foto' | 'fonte_sem_foto'; fotos: FotoRef[] }

export interface DepsFotos {
  supabase: any
  /** POST /v1/fotos-do-lote. Lanca com statusCode em erro HTTP. */
  buscar: (body: { fonte: string; lote: string; ref?: string }) => Promise<any>
  dono: string
  agora?: number
  log?: (m: string) => void
  /** Fontes que ja responderam fonte_sem_foto (vive enquanto o processo vive). */
  fontesSemFoto?: Set<string>
  /** pedido_id -> ultima tentativa (ms), pra revezar quem fica "buscando". */
  tentadoEm?: Map<string, number>
  /** Pausa entre chamadas (teste injeta uma que nao espera). */
  esperar?: (ms: number) => Promise<void>
  /**
   * Aviso ao cliente quando a rodada gravou foto em passagem(ns) do pedido
   * (server/utils/aviso-fotos.ts). Chamado UMA vez por pedido por rodada, com
   * os niveis das passagens que ganharam foto. Ausente = sem aviso (a flag
   * FOTOS_AVISO_EMAIL do plugin decide). Nunca deve lancar.
   */
  avisar?: (pedidoId: string, niveis: string[]) => Promise<unknown>
}

export interface ResumoRodada {
  rodou: boolean
  motivo?: string
  pedidos: number
  chamadas: number
  gravados: number
  apiAusente?: boolean
  /** A API respondeu 429: rodada parada ali. */
  limitada?: boolean
}

/** Resposta da API -> formato interno. Torto vira null (tratado como falha). */
export function sanearRespostaFotos(res: any): RespostaFotos | null {
  if (!res || typeof res !== 'object') return null
  const status = String(res.status || '')
  if (!['ok', 'buscando', 'sem_foto', 'fonte_sem_foto'].includes(status)) return null
  const fotos = fotoRefsDaPassagem({ detalhes: { fotos: Array.isArray(res.fotos) ? res.fotos : [] } })
  return { status: status as RespostaFotos['status'], fotos }
}

const codigo = (e: any) => Number(e?.statusCode ?? e?.status ?? e?.response?.status) || null

type Mudanca = { foto_refs: FotoRef[] } | { fotos_busca: { status: FotosBuscaStatus; em: string } }

/**
 * Grava SO na passagem (fonte, lote, ref), via RPC fotos_passagem_gravar:
 * jsonb_set dentro da linha travada, entao nunca pisa no que outro escritor
 * (DETRAN tardio, recallBase...) gravou no resto do snapshot. Nunca lanca.
 */
export async function gravarFotosPassagem(supabase: any, pedidoId: string, alvo: { fonte: string; lote: string; ref?: string | null }, mudanca: Mudanca): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('fotos_passagem_gravar', {
      p_pedido: pedidoId,
      p_fonte: alvo.fonte,
      p_lote: alvo.lote,
      p_ref: alvo.ref ?? null,
      p_foto_refs: 'foto_refs' in mudanca ? mudanca.foto_refs : null,
      p_fotos_busca: 'fotos_busca' in mudanca ? mudanca.fotos_busca : null,
    })
    if (error) return `erro: ${String(error.message || '').slice(0, 80)}`
    return String(data || '')
  } catch (e: any) {
    return `erro: ${String(e?.message || e).slice(0, 80)}`
  }
}

function corpoDoErro(e: any): any {
  const corpo = e?.data ?? e?.response?._data
  if (typeof corpo === 'string') { try { return JSON.parse(corpo) } catch { return corpo } }
  return corpo
}

/** 404 do lote ("lote nao encontrado"): a API nao conhece este lote. */
export function ehLoteNaoEncontrado(e: any): boolean {
  if (codigo(e) !== 404) return false
  const corpo = corpoDoErro(e)
  const txt = typeof corpo === 'string' ? corpo : [corpo?.detail, corpo?.message, corpo?.erro, corpo?.error].filter((x) => typeof x === 'string').join(' ')
  return /lote\s+n[aã]o\s+encontrado/i.test(txt)
}

/**
 * 404 de ROTA (endpoint ainda nao existe na leiloes-api): o FastAPI responde
 * {"detail":"Not Found"}. Qualquer outro 404 e da passagem (pula so ela).
 */
export function ehRotaAusente(e: any): boolean {
  if (codigo(e) !== 404) return false
  const corpo = corpoDoErro(e)
  return !!corpo && typeof corpo === 'object' && corpo.detail === 'Not Found'
}

interface CtxTentativa {
  deps: DepsFotos
  agora: number
  log: (m: string) => void
  fontesSemFoto: Set<string>
  esperar: (ms: number) => Promise<void>
  resumo: ResumoRodada
  tetoChamadas: number
  prefixo: string
}

/**
 * UMA chamada por passagem de um pedido (rodada de 30 min e rodada rapida).
 * `parar` = a rodada inteira deve parar (rota ausente ou 429). `pendentes` =
 * passagens que seguem sem resposta final (buscando, erro, invalida ou nao
 * perguntadas por causa do teto). Nunca lanca.
 */
async function tentarPedido(ctx: CtxTentativa, pedido: any, alvos: any[]): Promise<{ parar: boolean; pendentes: number }> {
  const { deps, agora, log, fontesSemFoto, esperar, resumo, prefixo } = ctx
  const tok = String(pedido.token_entrega || '').slice(0, 6)
  const linhaLog: string[] = []
  let pendentes = 0
  // Niveis das passagens que ganharam foto nesta rodada (um aviso so por pedido).
  const niveisComFoto: string[] = []
  const avisar = async () => {
    if (!deps.avisar || !niveisComFoto.length) return
    try { await deps.avisar(pedido.id, [...new Set(niveisComFoto)]) } catch { /* aviso nunca derruba o job */ }
  }
  for (let i = 0; i < alvos.length; i++) {
    const p = alvos[i]
    if (resumo.chamadas >= ctx.tetoChamadas) { pendentes += alvos.length - i; break }
    const fonte = String(p.fonte)
    if (fontesSemFoto.has(fonte)) continue
    const lote = String(p.lote)
    const alvo = { fonte, lote, ref: p.ref ?? null }
    let r: RespostaFotos | null = null
    if (resumo.chamadas > 0) await esperar(FOTOS_PAUSA_MS)
    resumo.chamadas++
    try {
      r = sanearRespostaFotos(await deps.buscar({ fonte, lote, ...(p.ref ? { ref: String(p.ref) } : {}) }))
    } catch (e: any) {
      if (ehRotaAusente(e)) {
        // Endpoint ainda nao esta no ar: para a rodada, sem erro.
        resumo.apiAusente = true
        log(`${prefixo} /v1/fotos-do-lote ainda nao disponivel (404): nada a fazer nesta rodada`)
        return { parar: true, pendentes: pendentes + alvos.length - i }
      }
      if (codigo(e) === 429) {
        // Limite da chave (30/min): para a rodada; o resto fica pra proxima.
        resumo.limitada = true
        linhaLog.push(`${fonte}:${lote}=429`)
        log(`${prefixo} pedido ${pedido.id} (${tok}…): ${linhaLog.join(', ')}`)
        log(`${prefixo} 429 da leiloes-api: rodada parada`)
        await avisar()
        return { parar: true, pendentes: pendentes + alvos.length - i }
      }
      if (ehLoteNaoEncontrado(e)) {
        // A API nao conhece o lote: vira sem_foto, pra nao perguntar toda rodada.
        const g = await gravarFotosPassagem(deps.supabase, pedido.id, alvo, { fotos_busca: { status: 'sem_foto', em: new Date(agora).toISOString() } })
        linhaLog.push(`${fonte}:${lote}=404 lote nao encontrado${g === 'gravado' || g === 'igual' ? '' : ` (nao gravou: ${g})`}`)
        continue
      }
      pendentes++
      linhaLog.push(`${fonte}:${lote}=erro ${codigo(e) ?? (e?.message || '').slice(0, 40)}`)
      continue
    }
    if (!r) { pendentes++; linhaLog.push(`${fonte}:${lote}=resposta invalida`); continue }

    if (r.status === 'ok' && r.fotos.length) {
      const g = await gravarFotosPassagem(deps.supabase, pedido.id, alvo, { foto_refs: r.fotos })
      if (g === 'gravado') { resumo.gravados++; niveisComFoto.push(String(p.nivel || '')) }
      linhaLog.push(`${fonte}:${lote}=ok ${r.fotos.length} foto${r.fotos.length === 1 ? '' : 's'}${g === 'gravado' ? '' : ` (nao gravou: ${g})`}`)
    } else if (r.status === 'buscando') {
      // Segue tentando nas proximas rodadas (o aviso da pagina expira sozinho em 7 dias).
      pendentes++
      linhaLog.push(`${fonte}:${lote}=buscando`)
    } else {
      // sem_foto, fonte_sem_foto ou ok sem foto: busca terminou sem foto.
      const status: FotosBuscaStatus = r.status === 'fonte_sem_foto' ? 'fonte_sem_foto' : 'sem_foto'
      if (status === 'fonte_sem_foto') fontesSemFoto.add(fonte)
      const g = await gravarFotosPassagem(deps.supabase, pedido.id, alvo, { fotos_busca: { status, em: new Date(agora).toISOString() } })
      linhaLog.push(`${fonte}:${lote}=${status}${g === 'gravado' || g === 'igual' ? '' : ` (nao gravou: ${g})`}`)
    }
  }
  log(`${prefixo} pedido ${pedido.id} (${tok}…): ${linhaLog.join(', ') || 'nada'}`)
  await avisar()
  return { parar: false, pendentes }
}

/** Uma rodada do job. Nunca lanca. */
export async function rodarFotosDepois(deps: DepsFotos): Promise<ResumoRodada> {
  const agora = deps.agora ?? Date.now()
  const log = deps.log ?? ((m: string) => console.info(m))
  const fontesSemFoto = deps.fontesSemFoto ?? new Set<string>()
  const tentadoEm = deps.tentadoEm ?? new Map<string, number>()
  const esperar = deps.esperar ?? ((ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)))
  const resumo: ResumoRodada = { rodou: false, pedidos: 0, chamadas: 0, gravados: 0 }

  let pegou = false
  try {
    const { data, error } = await deps.supabase.rpc('job_lock_pegar', { p_nome: FOTOS_NOME_LOCK, p_dono: deps.dono, p_segundos: FOTOS_LEASE_S })
    if (error) throw new Error(error.message)
    pegou = data === true
  } catch (e: any) {
    log(`[fotos-depois] sem lock (${String(e?.message || e).slice(0, 120)}): rodada pulada`)
    return { ...resumo, motivo: 'lock indisponivel' }
  }
  if (!pegou) return { ...resumo, motivo: 'lock com outro container' }
  resumo.rodou = true
  const ctx: CtxTentativa = { deps, agora, log, fontesSemFoto, esperar, resumo, tetoChamadas: FOTOS_MAX_CHAMADAS, prefixo: '[fotos-depois]' }

  try {
    const desde = new Date(agora - FOTOS_JANELA_DIAS * DIA_MS).toISOString()
    const { data: linhas, error } = await deps.supabase.from('pedidos_premium')
      .select('id,token_entrega,entregue_em,passagens:relatorio_snapshot->historicoLeilao->passagens')
      .eq('status', 'entregue')
      .eq('plano', 'completa')
      .gte('entregue_em', desde)
      .order('entregue_em', { ascending: false })
      .limit(1000)
    if (error) throw new Error(error.message)

    const candidatos = (linhas || [])
      .map((l: any) => ({ ...l, alvo: (Array.isArray(l.passagens) ? l.passagens : []).filter((p: any) => passagemPrecisaDeFoto(p, fontesSemFoto)) }))
      .filter((l: any) => l.alvo.length)
      // Quem nunca foi tentado primeiro; depois o tentado ha mais tempo.
      .sort((a: any, b: any) => (tentadoEm.get(a.id) ?? 0) - (tentadoEm.get(b.id) ?? 0))
      .slice(0, FOTOS_MAX_PEDIDOS)

    for (const pedido of candidatos) {
      if (resumo.chamadas >= FOTOS_MAX_CHAMADAS) break
      tentadoEm.set(pedido.id, agora)
      resumo.pedidos++
      const fim = await tentarPedido(ctx, pedido, pedido.alvo)
      if (fim.parar) return resumo
    }
    return resumo
  } catch (e: any) {
    log(`[fotos-depois] rodada falhou (fail-open): ${String(e?.message || e).slice(0, 200)}`)
    return resumo
  }
}

// ---------- Rodada rapida pos-entrega (Cesar, 30/out/2026) ----------
//
// Relatorio pago com passagem de leilao sem foto e prioridade maxima: nao
// espera a rodada de 30 min. Pedido entregue ha ate 30 min com passagem que
// pede foto (fotos_pendente ou resposta "buscando") e perguntado de novo a
// cada 60 s nos primeiros 10 min e a cada 90 s depois (backoff leve). Lock
// proprio entre containers (lease curto), 1 chamada por passagem por
// tentativa, teto de chamadas por rodada e pausa de 3 min apos 429. Pedidos
// mais antigos seguem so na rodada de 30 min.

export const FOTOS_RAPIDO_NOME_LOCK = 'fotos-depois-rapido'
/** Lease curto: outro container so assume depois de ~50 s sem renovacao (minimo da RPC: 30 s). */
export const FOTOS_RAPIDO_LEASE_S = 50
/** Janela da cadencia rapida, contada da entrega. */
export const FOTOS_RAPIDO_JANELA_MS = 30 * 60 * 1000
/** Batida do relogio do plugin (so decide se ja e hora; nao chama nada sozinha). */
export const FOTOS_RAPIDO_TICK_MS = 15_000
/** Primeira tentativa depois da entrega. */
export const FOTOS_RAPIDO_PRIMEIRA_MS = 60_000
/** Teto de chamadas por rodada rapida (bem abaixo de FOTOS_MAX_CHAMADAS e dos 30/min da chave). */
export const FOTOS_RAPIDO_MAX_CHAMADAS = 8
/** Sem pedido pendente: olha o banco a cada 5 min (entrega feita em outro container). */
export const FOTOS_RAPIDO_OCIOSO_MS = 5 * 60 * 1000
/** Depois de 429 (rapida ou de 30 min): espera antes de perguntar de novo. */
export const FOTOS_RAPIDO_PAUSA_429_MS = 3 * 60 * 1000
/** Rota ausente: a rapida tambem para ate a proxima rodada de 30 min. */
export const FOTOS_RAPIDO_PAUSA_ROTA_MS = FOTOS_INTERVALO_MS

/** Intervalo entre tentativas de um pedido, pela idade da entrega: 60 s ate 10 min, 90 s depois. */
export function intervaloRapidoMs(idadeMs: number): number {
  return idadeMs < 10 * 60 * 1000 ? 60_000 : 90_000
}

export interface DepsFotosRapido extends DepsFotos {
  /** pedido_id -> ultima tentativa rapida (ms). */
  tentadoRapido?: Map<string, number>
}

export interface ResumoRodadaRapida extends ResumoRodada {
  /** Quando a proxima rodada rapida deve rodar (ms). */
  proximaEm: number
}

/** Uma rodada rapida. Nunca lanca. */
export async function rodarFotosRapido(deps: DepsFotosRapido): Promise<ResumoRodadaRapida> {
  const agora = deps.agora ?? Date.now()
  const log = deps.log ?? ((m: string) => console.info(m))
  const fontesSemFoto = deps.fontesSemFoto ?? new Set<string>()
  const tentadoRapido = deps.tentadoRapido ?? new Map<string, number>()
  const esperar = deps.esperar ?? ((ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)))
  const resumo: ResumoRodadaRapida = { rodou: false, pedidos: 0, chamadas: 0, gravados: 0, proximaEm: agora + FOTOS_RAPIDO_OCIOSO_MS }

  let pegou = false
  try {
    const { data, error } = await deps.supabase.rpc('job_lock_pegar', { p_nome: FOTOS_RAPIDO_NOME_LOCK, p_dono: deps.dono, p_segundos: FOTOS_RAPIDO_LEASE_S })
    if (error) throw new Error(error.message)
    pegou = data === true
  } catch (e: any) {
    log(`[fotos-depois rapido] sem lock (${String(e?.message || e).slice(0, 120)}): rodada pulada`)
    return { ...resumo, motivo: 'lock indisponivel' }
  }
  // Outro container cuida da rapida; tenta de novo quando o lease dele puder vencer.
  if (!pegou) return { ...resumo, motivo: 'lock com outro container', proximaEm: agora + FOTOS_RAPIDO_LEASE_S * 1000 }
  resumo.rodou = true
  const ctx: CtxTentativa = { deps, agora, log, fontesSemFoto, esperar, resumo, tetoChamadas: FOTOS_RAPIDO_MAX_CHAMADAS, prefixo: '[fotos-depois rapido]' }

  try {
    const desde = new Date(agora - FOTOS_RAPIDO_JANELA_MS).toISOString()
    const { data: linhas, error } = await deps.supabase.from('pedidos_premium')
      .select('id,token_entrega,entregue_em,passagens:relatorio_snapshot->historicoLeilao->passagens')
      .eq('status', 'entregue')
      .eq('plano', 'completa')
      .gte('entregue_em', desde)
      .order('entregue_em', { ascending: false })
      .limit(50)
    if (error) throw new Error(error.message)

    const pendentes = (linhas || [])
      .map((l: any) => {
        const ent = new Date(String(l.entregue_em || '')).getTime()
        const idade = Number.isFinite(ent) ? Math.max(0, agora - ent) : 0
        const vez = (tentadoRapido.get(l.id) ?? 0) + intervaloRapidoMs(idade)
        return { ...l, idade, vez, alvo: (Array.isArray(l.passagens) ? l.passagens : []).filter((p: any) => passagemPrecisaDeFoto(p, fontesSemFoto)) }
      })
      .filter((l: any) => l.alvo.length && l.idade <= FOTOS_RAPIDO_JANELA_MS)

    // Proxima vez de cada pedido que segue pendente (dentro da janela).
    const vezes: number[] = []
    const devidos = pendentes.filter((l: any) => l.vez <= agora).sort((a: any, b: any) => a.vez - b.vez)
    for (const l of pendentes) if (l.vez > agora) vezes.push(l.vez)

    for (let i = 0; i < devidos.length; i++) {
      const pedido = devidos[i]
      if (resumo.chamadas >= FOTOS_RAPIDO_MAX_CHAMADAS) {
        // Teto da rodada: o resto volta na proxima batida.
        vezes.push(agora + FOTOS_RAPIDO_TICK_MS)
        break
      }
      tentadoRapido.set(pedido.id, agora)
      resumo.pedidos++
      const fim = await tentarPedido(ctx, pedido, pedido.alvo)
      if (fim.parar) {
        resumo.proximaEm = agora + (resumo.apiAusente ? FOTOS_RAPIDO_PAUSA_ROTA_MS : FOTOS_RAPIDO_PAUSA_429_MS)
        return resumo
      }
      const proxima = agora + intervaloRapidoMs(pedido.idade)
      if (fim.pendentes && proxima - new Date(String(pedido.entregue_em)).getTime() <= FOTOS_RAPIDO_JANELA_MS) vezes.push(proxima)
    }

    resumo.proximaEm = vezes.length ? Math.max(agora + FOTOS_RAPIDO_TICK_MS, Math.min(...vezes)) : agora + FOTOS_RAPIDO_OCIOSO_MS
    // Limpa pedidos que sairam da janela (o mapa nao cresce sem fim).
    for (const [id, em] of tentadoRapido) if (agora - em > FOTOS_RAPIDO_JANELA_MS * 2) tentadoRapido.delete(id)
    return resumo
  } catch (e: any) {
    log(`[fotos-depois rapido] rodada falhou (fail-open): ${String(e?.message || e).slice(0, 200)}`)
    resumo.proximaEm = agora + FOTOS_RAPIDO_PRIMEIRA_MS
    return resumo
  }
}

/**
 * Agenda da rodada rapida, por processo. O plugin consulta `devido` a cada
 * batida; a entrega do relatorio chama `agendarFotosRapido` para a primeira
 * tentativa sair ~60 s depois, sem esperar a agenda ociosa de 5 min.
 */
export function criarAgendaRapida(inicioEm: number) {
  let proximaEm = inicioEm
  let acordarEm = Number.POSITIVE_INFINITY
  return {
    devido: (agora: number) => agora >= Math.min(proximaEm, acordarEm),
    /** Chamado antes de rodar: o pedido de acordar ja foi atendido por esta rodada. */
    comecou: () => { acordarEm = Number.POSITIVE_INFINITY },
    terminou: (proxima: number) => { proximaEm = proxima },
    acordar: (em: number) => { acordarEm = Math.min(acordarEm, em) },
    /** Nao roda antes de `ate` (ex.: 429 na rodada de 30 min). Pedido de acordar tambem espera. */
    adiar: (ate: number) => { proximaEm = Math.max(proximaEm, ate); if (acordarEm < ate) acordarEm = ate },
    get proximaEm() { return Math.min(proximaEm, acordarEm) },
  }
}

/** Agenda do processo (plugin + entrega no mesmo servidor). */
export const agendaFotosRapida = criarAgendaRapida(Date.now() + FOTOS_RAPIDO_PRIMEIRA_MS)

/** O snapshot recem gravado tem passagem pedindo foto? */
export function snapshotPedeFoto(snapshot: any): boolean {
  const passagens = snapshot?.historicoLeilao?.passagens
  return Array.isArray(passagens) && passagens.some((p: any) => passagemPrecisaDeFoto(p))
}

/** Entrega com passagem sem foto: primeira tentativa rapida ~60 s depois. Nunca lanca. */
export function agendarFotosRapido(snapshot: any, agora = Date.now()): boolean {
  try {
    if (!snapshotPedeFoto(snapshot)) return false
    agendaFotosRapida.acordar(agora + FOTOS_RAPIDO_PRIMEIRA_MS)
    return true
  } catch { return false }
}
