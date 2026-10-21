import { ehNotificacao } from '../../shared/leilao-notificacao'
import { gravarFotosPassagem, sanearRespostaFotos, ehRotaAusente, ehLoteNaoEncontrado, type RespostaFotos } from './fotos-depois'

// Fotos do lote NA GERACAO do relatorio Completo (Cesar, 21/out/2026).
//
// Quando a nossa base devolve uma passagem (qualquer nivel) que tem as fotos
// do anuncio na origem (detalhes.fotos[].url_origem) mas ainda nao tem foto no
// R2 (fotos e foto_refs vazios), pede a leiloes-api para baixar o lote na hora
// (POST /v1/fotos-do-lote) e espera no maximo 60 s, dentro do orcamento de
// 5 min da geracao. O que chegar a tempo e gravado SO na passagem, pela mesma
// RPC do job (fotos_passagem_gravar, jsonb_set): o snapshot ja nasce gravado e
// nunca e reescrito inteiro aqui. O que nao chegar fica para o fotos-depois
// (a cada 30 min, com o e-mail automatico de fotos).
// Base parceira nunca entra (nao tem foto). Edital de notificacao tambem nao.
// Fail-open total: nada aqui lanca nem atrasa a entrega alem do prazo.

/** Espera maxima total (todas as passagens em paralelo). */
export const FOTOS_GERACAO_PRAZO_MS = 60_000
/** Entre perguntas de uma passagem que voltou "buscando". */
export const FOTOS_GERACAO_INTERVALO_MS = 8_000
/** Passagens tratadas por pedido (a chave da API aceita 30/min: 3 x 60/8 = 22,5/min). */
export const FOTOS_GERACAO_MAX_PASSAGENS = 3
/** Teto de uma chamada (igual ao job). */
export const FOTOS_GERACAO_TIMEOUT_MS = 8_000

export interface ResumoFotosGeracao {
  etapa: 'fotos-do-lote'
  /** Tempo gasto, ms. */
  ms: number
  alvos: number
  chamadas: number
  gravadas: number
  /** Passagens que ainda estavam "buscando" (ou sem resposta) no fim do prazo. */
  pendentes: number
  sem_foto: number
  erros: number
  /** Prazo de 60 s estourou com passagem pendente. */
  prazo_estourado: boolean
  motivo?: string
}

export interface DepsFotosGeracao {
  supabase: any
  pedidoId: string
  passagens: any[]
  /** POST /v1/fotos-do-lote. Lanca com statusCode em erro HTTP. */
  buscar: (body: { fonte: string; lote: string; ref?: string }) => Promise<any>
  prazoMs?: number
  intervaloMs?: number
  agora?: () => number
  log?: (m: string) => void
}

/** A geracao deve pedir as fotos desta passagem agora? */
export function passagemPedeFotoNaGeracao(p: any): boolean {
  if (!p || typeof p !== 'object') return false
  const fonte = String(p.fonte || '')
  if (!fonte || !String(p.lote || '').trim()) return false
  if (p.fonte_tipo === 'parceiro' || fonte === 'parceiro') return false
  if (ehNotificacao(p)) return false
  if (Array.isArray(p.foto_refs) && p.foto_refs.length) return false
  if (Array.isArray(p.fotos) && p.fotos.length) return false
  const busca = p.fotos_busca?.status
  if (busca === 'sem_foto' || busca === 'fonte_sem_foto') return false
  const fotos = p.detalhes?.fotos
  if (!Array.isArray(fotos)) return false
  // Ja tem ref no detalhe: o snapshot ja mostra (foto_refs sai dele).
  if (fotos.some((f: any) => typeof f?.foto_ref === 'string' && f.foto_ref)) return false
  return fotos.some((f: any) => typeof f?.url_origem === 'string' && /^https?:\/\//i.test(f.url_origem))
}

const codigo = (e: any) => Number(e?.statusCode ?? e?.status ?? e?.response?.status) || null

/** Promessa que resolve com `valor` depois de `ms` (sem segurar o processo). */
function timer<T>(ms: number, valor: T): { p: Promise<T>; cancelar: () => void } {
  let h: ReturnType<typeof setTimeout> | undefined
  const p = new Promise<T>((ok) => { h = setTimeout(() => ok(valor), Math.max(0, ms)); (h as any)?.unref?.() })
  return { p, cancelar: () => { if (h) clearTimeout(h) } }
}

const ESGOTOU = Symbol('esgotou')

/** Pede e espera as fotos das passagens elegiveis. Nunca lanca. */
export async function buscarFotosNaGeracao(deps: DepsFotosGeracao): Promise<ResumoFotosGeracao> {
  const agora = deps.agora ?? Date.now
  const log = deps.log ?? ((m: string) => console.info(m))
  const prazoMs = deps.prazoMs ?? FOTOS_GERACAO_PRAZO_MS
  const intervaloMs = deps.intervaloMs ?? FOTOS_GERACAO_INTERVALO_MS
  const t0 = agora()
  const fim = t0 + prazoMs
  const resumo: ResumoFotosGeracao = { etapa: 'fotos-do-lote', ms: 0, alvos: 0, chamadas: 0, gravadas: 0, pendentes: 0, sem_foto: 0, erros: 0, prazo_estourado: false }
  const fechar = (motivo?: string) => ({ ...resumo, ms: Math.max(0, agora() - t0), ...(motivo ? { motivo } : {}) })

  try {
    const alvos = (Array.isArray(deps.passagens) ? deps.passagens : []).filter(passagemPedeFotoNaGeracao).slice(0, FOTOS_GERACAO_MAX_PASSAGENS)
    resumo.alvos = alvos.length
    if (!alvos.length) return fechar('sem passagem elegivel')

    // Rota ausente ou 429: para TODAS as passagens (a chave e uma so).
    let parar: string | null = null

    const umaPassagem = async (p: any): Promise<void> => {
      const fonte = String(p.fonte)
      const lote = String(p.lote)
      const alvo = { fonte, lote, ref: p.ref ?? null }
      while (!parar) {
        const resta = fim - agora()
        if (resta <= 0) { resumo.pendentes++; resumo.prazo_estourado = true; return }
        resumo.chamadas++
        const corte = timer(resta, ESGOTOU as typeof ESGOTOU)
        let r: RespostaFotos | null | typeof ESGOTOU
        try {
          r = await Promise.race([
            Promise.resolve(deps.buscar({ fonte, lote, ...(p.ref ? { ref: String(p.ref) } : {}) })).then(sanearRespostaFotos),
            corte.p,
          ])
        } catch (e: any) {
          if (ehRotaAusente(e)) { parar = 'rota /v1/fotos-do-lote ausente (404)'; return }
          if (codigo(e) === 429) { parar = '429 da leiloes-api'; resumo.pendentes++; return }
          if (ehLoteNaoEncontrado(e)) {
            await gravarFotosPassagem(deps.supabase, deps.pedidoId, alvo, { fotos_busca: { status: 'sem_foto', em: new Date(agora()).toISOString() } })
            resumo.sem_foto++
            return
          }
          // Erro de rede/5xx/timeout da chamada: o job das 30 min tenta de novo.
          resumo.erros++
          return
        } finally { corte.cancelar() }
        if (r === ESGOTOU) { resumo.pendentes++; resumo.prazo_estourado = true; return }
        if (!r) { resumo.erros++; return }
        if (r.status === 'ok' && r.fotos.length) {
          const g = await gravarFotosPassagem(deps.supabase, deps.pedidoId, alvo, { foto_refs: r.fotos })
          if (g === 'gravado' || g === 'ja_tem_foto') resumo.gravadas++
          else resumo.erros++
          return
        }
        if (r.status === 'buscando') {
          const resto = fim - agora()
          if (resto <= intervaloMs) {
            // Nao da tempo de outra pergunta: desiste; o job das 30 min completa.
            resumo.pendentes++; resumo.prazo_estourado = true
            return
          }
          const t = timer(intervaloMs, null)
          await t.p
          continue
        }
        // sem_foto, fonte_sem_foto ou ok sem foto: busca terminou sem foto.
        const status = r.status === 'fonte_sem_foto' ? 'fonte_sem_foto' : 'sem_foto'
        await gravarFotosPassagem(deps.supabase, deps.pedidoId, alvo, { fotos_busca: { status, em: new Date(agora()).toISOString() } })
        resumo.sem_foto++
        return
      }
    }

    await Promise.all(alvos.map((p) => umaPassagem(p).catch(() => { resumo.erros++ })))
    const out = fechar(parar ?? undefined)
    log(`[fotos-na-geracao] pedido ${deps.pedidoId}: alvos=${out.alvos} gravadas=${out.gravadas} pendentes=${out.pendentes} sem_foto=${out.sem_foto} erros=${out.erros} ms=${out.ms}${parar ? ` (${parar})` : ''}`)
    return out
  } catch (e: any) {
    return fechar(`falhou (fail-open): ${String(e?.message || e).slice(0, 120)}`)
  }
}

/**
 * Acrescenta o resumo ao debug_trace do pedido (lido na hora: o trace da
 * consulta ja foi gravado na entrega). Nunca lanca.
 */
export async function registrarNoTrace(supabase: any, pedidoId: string, entrada: ResumoFotosGeracao): Promise<void> {
  try {
    const { data } = await supabase.from('pedidos_premium').select('debug_trace').eq('id', pedidoId).maybeSingle()
    const atual = Array.isArray(data?.debug_trace) ? data.debug_trace : []
    await supabase.from('pedidos_premium').update({ debug_trace: [...atual, entrada] }).eq('id', pedidoId)
  } catch { /* trace nunca derruba nada */ }
}

/**
 * Chamado na entrega (premium-processar), depois de gravar o snapshot. So o
 * Completo, so com a leiloes-api configurada. FOTOS_NA_GERACAO_DESLIGADO=1
 * desliga. Nunca lanca.
 */
export async function completarFotosNaGeracao(
  supabase: any,
  pedido: { id: string; plano?: string | null },
  snapshot: any,
): Promise<ResumoFotosGeracao | null> {
  try {
    if (process.env.FOTOS_NA_GERACAO_DESLIGADO === '1') return null
    if ((pedido.plano || 'completa') !== 'completa') return null
    const passagens = snapshot?.historicoLeilao?.passagens
    if (!Array.isArray(passagens) || !passagens.some(passagemPedeFotoNaGeracao)) return null
    const config = useRuntimeConfig()
    const base = String(config.leiloesApiUrl || '').replace(/\/+$/, '')
    const key = String(config.leiloesApiKey || '')
    if (!base || !key) return null
    const resumo = await buscarFotosNaGeracao({
      supabase,
      pedidoId: pedido.id,
      passagens,
      buscar: (body) => $fetch(`${base}/v1/fotos-do-lote`, {
        method: 'POST',
        headers: { 'X-API-Key': key, 'X-Origem': config.public.gated ? 'homolog-premium' : 'prod-premium' },
        body,
        timeout: FOTOS_GERACAO_TIMEOUT_MS,
      }),
    })
    await registrarNoTrace(supabase, pedido.id, resumo)
    return resumo
  } catch (e: any) {
    console.warn('[fotos-na-geracao] falhou (fail-open):', e?.message || e)
    return null
  }
}
