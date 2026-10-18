import { fotoRefsDaPassagem, passagemPrecisaDeFoto, type FotoRef, type FotosBuscaStatus } from '../../shared/foto-lote'

// Fotos do lote que chegam DEPOIS da venda (Cesar, 18/out/2026).
//
// O snapshot do relatorio (pedidos_premium.relatorio_snapshot) e congelado na
// venda. Quando as fotos de um lote chegam depois (backfill ou busca sob
// demanda na leiloes-api), o relatorio nao as mostrava. Este job, a cada
// 30 min (server/plugins/fotos-depois.ts), pergunta a leiloes-api
// (POST /v1/fotos-do-lote) pelas passagens sem foto e grava os foto_refs SO
// naquela passagem, relendo o snapshot antes de gravar (outros blocos tambem
// escrevem nele). Sem e-mail ao cliente. Fail-open: erro aqui nunca quebra
// nada; o que nao deu volta na proxima rodada.
//
// Lock entre containers: job_lock_pegar (lease no banco, migration
// 20261018120000_job_lock.sql). Sem lock (migration ainda nao aplicada, banco
// fora) a rodada NAO roda.
//
// Enquanto /v1/fotos-do-lote nao existir (404), a rodada para na primeira
// chamada, loga uma linha e tenta de novo daqui a 30 min. Nada e gravado.

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
/** Depois disso, "buscando" deixa de mostrar o aviso na pagina (o job segue tentando ate FOTOS_JANELA_DIAS). */
export const FOTOS_AVISO_MAX_DIAS = 7

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

const chavePassagem = (p: any) => `${String(p?.fonte || '')}|${String(p?.lote || '')}|${String(p?.ref || '')}`

/**
 * Aplica o resultado numa copia do snapshot ATUAL, so na passagem certa.
 * Devolve null quando nao ha nada a gravar (passagem sumiu, ja tem foto, etc.).
 */
export function aplicarNaPassagem(
  snap: any,
  alvo: { fonte: string; lote: string; ref?: string | null },
  mudanca: { foto_refs: FotoRef[] } | { fotos_busca: { status: FotosBuscaStatus; em: string } },
): any | null {
  const passagens = snap?.historicoLeilao?.passagens
  if (!Array.isArray(passagens)) return null
  const k = chavePassagem(alvo)
  const i = passagens.findIndex((p: any) => chavePassagem(p) === k)
  if (i < 0) return null
  const p = passagens[i]
  if ((Array.isArray(p.foto_refs) && p.foto_refs.length) || fotoRefsDaPassagem(p).length) return null
  let nova: any
  if ('foto_refs' in mudanca) {
    if (!mudanca.foto_refs.length) return null
    nova = { ...p, foto_refs: mudanca.foto_refs, fotos_pendente: false }
    delete nova.fotos_busca
  } else {
    if (p.fotos_busca?.status === mudanca.fotos_busca.status) return null
    nova = { ...p, fotos_busca: mudanca.fotos_busca }
  }
  const lista = passagens.slice()
  lista[i] = nova
  return { ...snap, historicoLeilao: { ...snap.historicoLeilao, passagens: lista } }
}

/** Rele o snapshot, aplica e grava. Nunca lanca. */
async function gravar(
  supabase: any,
  pedidoId: string,
  alvo: { fonte: string; lote: string; ref?: string | null },
  mudanca: Parameters<typeof aplicarNaPassagem>[2],
): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('pedidos_premium').select('relatorio_snapshot').eq('id', pedidoId).maybeSingle()
    if (error || !data?.relatorio_snapshot) return false
    const novo = aplicarNaPassagem(data.relatorio_snapshot, alvo, mudanca)
    if (!novo) return false
    const { error: e2 } = await supabase.from('pedidos_premium').update({ relatorio_snapshot: novo }).eq('id', pedidoId)
    return !e2
  } catch {
    return false
  }
}

const codigo = (e: any) => Number(e?.statusCode ?? e?.status ?? e?.response?.status) || null

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
          if (codigo(e) === 404) {
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
          const ok = await gravar(deps.supabase, pedido.id, alvo, { foto_refs: r.fotos })
          if (ok) resumo.gravados++
          linhaLog.push(`${fonte}:${lote}=ok ${r.fotos.length} foto${r.fotos.length === 1 ? '' : 's'}${ok ? '' : ' (nao gravou)'}`)
        } else if (r.status === 'buscando') {
          // Segue tentando nas proximas rodadas. Passado o prazo do aviso, a
          // pagina para de dizer "Buscando fotos" (o job continua).
          const entregue = new Date(String(pedido.entregue_em || '')).getTime()
          if (p?.detalhes?.fotos_pendente === true && !p.fotos_busca && entregue && agora - entregue > FOTOS_AVISO_MAX_DIAS * DIA_MS) {
            await gravar(deps.supabase, pedido.id, alvo, { fotos_busca: { status: 'expirou', em: new Date(agora).toISOString() } })
            linhaLog.push(`${fonte}:${lote}=buscando (aviso expirou)`)
          } else {
            linhaLog.push(`${fonte}:${lote}=buscando`)
          }
        } else {
          // sem_foto, fonte_sem_foto ou ok sem foto: busca terminou sem foto.
          const status: FotosBuscaStatus = r.status === 'fonte_sem_foto' ? 'fonte_sem_foto' : 'sem_foto'
          if (status === 'fonte_sem_foto') fontesSemFoto.add(fonte)
          await gravar(deps.supabase, pedido.id, alvo, { fotos_busca: { status, em: new Date(agora).toISOString() } })
          linhaLog.push(`${fonte}:${lote}=${status}`)
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
