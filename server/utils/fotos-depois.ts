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
// 30 min. Nada e gravado. 404 com outro corpo pula so aquela passagem.
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
}

export interface ResumoRodada {
  rodou: boolean
  motivo?: string
  pedidos: number
  chamadas: number
  gravados: number
  apiAusente?: boolean
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
async function gravar(supabase: any, pedidoId: string, alvo: { fonte: string; lote: string; ref?: string | null }, mudanca: Mudanca): Promise<string> {
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

/**
 * 404 de ROTA (endpoint ainda nao existe na leiloes-api): o FastAPI responde
 * {"detail":"Not Found"}. Qualquer outro 404 e da passagem (pula so ela).
 */
export function ehRotaAusente(e: any): boolean {
  if (codigo(e) !== 404) return false
  let corpo = e?.data ?? e?.response?._data
  if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo) } catch { /* texto */ } }
  return !!corpo && typeof corpo === 'object' && corpo.detail === 'Not Found'
}

/** Uma rodada do job. Nunca lanca. */
export async function rodarFotosDepois(deps: DepsFotos): Promise<ResumoRodada> {
  const agora = deps.agora ?? Date.now()
  const log = deps.log ?? ((m: string) => console.info(m))
  const fontesSemFoto = deps.fontesSemFoto ?? new Set<string>()
  const tentadoEm = deps.tentadoEm ?? new Map<string, number>()
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
      const tok = String(pedido.token_entrega || '').slice(0, 6)
      const linhaLog: string[] = []
      for (const p of pedido.alvo) {
        if (resumo.chamadas >= FOTOS_MAX_CHAMADAS) break
        const fonte = String(p.fonte)
        if (fontesSemFoto.has(fonte)) continue
        const lote = String(p.lote)
        const alvo = { fonte, lote, ref: p.ref ?? null }
        let r: RespostaFotos | null = null
        resumo.chamadas++
        try {
          r = sanearRespostaFotos(await deps.buscar({ fonte, lote, ...(p.ref ? { ref: String(p.ref) } : {}) }))
        } catch (e: any) {
          if (ehRotaAusente(e)) {
            // Endpoint ainda nao esta no ar: para a rodada, sem erro.
            resumo.apiAusente = true
            log('[fotos-depois] /v1/fotos-do-lote ainda nao disponivel (404): nada a fazer nesta rodada')
            return resumo
          }
          linhaLog.push(`${fonte}:${lote}=erro ${codigo(e) ?? (e?.message || '').slice(0, 40)}`)
          continue
        }
        if (!r) { linhaLog.push(`${fonte}:${lote}=resposta invalida`); continue }

        if (r.status === 'ok' && r.fotos.length) {
          const g = await gravar(deps.supabase, pedido.id, alvo, { foto_refs: r.fotos })
          if (g === 'gravado') resumo.gravados++
          linhaLog.push(`${fonte}:${lote}=ok ${r.fotos.length} foto${r.fotos.length === 1 ? '' : 's'}${g === 'gravado' ? '' : ` (nao gravou: ${g})`}`)
        } else if (r.status === 'buscando') {
          // Segue tentando nas proximas rodadas (o aviso da pagina expira sozinho em 7 dias).
          linhaLog.push(`${fonte}:${lote}=buscando`)
        } else {
          // sem_foto, fonte_sem_foto ou ok sem foto: busca terminou sem foto.
          const status: FotosBuscaStatus = r.status === 'fonte_sem_foto' ? 'fonte_sem_foto' : 'sem_foto'
          if (status === 'fonte_sem_foto') fontesSemFoto.add(fonte)
          const g = await gravar(deps.supabase, pedido.id, alvo, { fotos_busca: { status, em: new Date(agora).toISOString() } })
          linhaLog.push(`${fonte}:${lote}=${status}${g === 'gravado' || g === 'igual' ? '' : ` (nao gravou: ${g})`}`)
        }
      }
      log(`[fotos-depois] pedido ${pedido.id} (${tok}…): ${linhaLog.join(', ') || 'nada'}`)
    }
    return resumo
  } catch (e: any) {
    log(`[fotos-depois] rodada falhou (fail-open): ${String(e?.message || e).slice(0, 200)}`)
    return resumo
  }
}
