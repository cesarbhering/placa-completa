import { relatorioPodeBaixarEdital, dentroDoTetoDeFoto } from '../../utils/edital-leilao'
import { fotoRefDoRelatorio } from '../../../shared/foto-lote'

// GET /api/premium/foto?token=<relatorio>&ref=<foto_ref>  ->  302 pra URL
// assinada (24 h) da foto do lote no R2, via leiloes-api /v1/foto-link.
// O ref so vale se for de uma passagem DESTE relatorio (mesma muralha do
// edital). A URL assinada nunca vai pro snapshot nem pro HTML: cada exibicao
// passa por aqui. Cache curto em memoria pra nao estourar o limite da API
// (600/h por chave).

const CACHE_MS = 10 * 60 * 1000
const cache = new Map<string, { url: string; ate: number }>()

export default defineEventHandler(async (event) => {
  const { token, ref } = getQuery(event)
  const tok = String(token || '')
  const r = String(ref || '')
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(tok) || !/^[A-Za-z0-9._~-]{8,512}$/.test(r)) throw createError({ statusCode: 404 })

  const agora = Date.now()
  // Chave = token + ref: so entra no cache depois de validado PARA ESTE
  // relatorio. Com chave so pelo ref, um token qualquer pegaria a foto em cache.
  const chave = `${tok}|${r}`
  const emCache = cache.get(chave)
  if (emCache && emCache.ate > agora) {
    setHeader(event, 'Cache-Control', 'private, max-age=300')
    return sendRedirect(event, emCache.url, 302)
  }

  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('status,plano,relatorio_snapshot')
    .eq('token_entrega', tok)
    .maybeSingle()
  if (!relatorioPodeBaixarEdital(pedido) || !fotoRefDoRelatorio(pedido!.relatorio_snapshot, r)) throw createError({ statusCode: 404 })

  // Teto por relatorio (igual ao edital), so pra chamada nova a API.
  if (!dentroDoTetoDeFoto(tok)) throw createError({ statusCode: 429, message: 'Muitas fotos pedidas para este relatório. Tente daqui a pouco.' })

  const config = useRuntimeConfig()
  const base = String(config.leiloesApiUrl || '').replace(/\/+$/, '')
  const key = String(config.leiloesApiKey || '')
  if (!base || !key) throw createError({ statusCode: 404 })
  try {
    const res = await $fetch<any>(`${base}/v1/foto-link`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'X-Origem': config.public.gated ? 'homolog-premium' : 'prod-premium' },
      body: { foto_ref: r },
      timeout: 8000,
    })
    const url = String(res?.url || '')
    if (!/^https:\/\//.test(url)) throw createError({ statusCode: 404 })
    const vale = Math.max(60, Number(res?.expira_em_segundos) || 3600) * 1000
    cache.set(chave, { url, ate: agora + Math.min(CACHE_MS, vale - 60_000) })
    if (cache.size > 2000) cache.clear()
    setHeader(event, 'Cache-Control', 'private, max-age=300')
    return sendRedirect(event, url, 302)
  } catch (e: any) {
    if (e?.statusCode !== 404) console.warn('[foto-lote] falhou:', e?.statusCode || '', e?.data?.message || e?.message)
    throw createError({ statusCode: 404 })
  }
})
