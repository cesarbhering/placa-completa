import { pedidoDoChecklist, lerChecklist, dentroDoTetoChecklist, TETO_LEITURA_POR_TOKEN } from '../../utils/premium-checklist'

// GET /api/premium/checklist?token=... -> { marcados: { item_id: true } }
// A pagina chama ao abrir e quando a aba volta ao foco (sincroniza aparelhos).
export default defineEventHandler(async (event) => {
  const token = String(getQuery(event).token || '')
  if (!dentroDoTetoChecklist(`l:${token}`, TETO_LEITURA_POR_TOKEN)) throw createError({ statusCode: 429 })
  const sb = usePremiumSupabase()
  const pedido = await pedidoDoChecklist(sb, token)
  if (!pedido) throw createError({ statusCode: 404 })
  setHeader(event, 'Cache-Control', 'no-store')
  return { marcados: await lerChecklist(sb, pedido.id) }
})
