import { idChecklistValido } from '../../../shared/checklist-compra'
import { pedidoDoChecklist, gravarChecklist, dentroDoTetoChecklist, TETO_ESCRITA_POR_TOKEN } from '../../utils/premium-checklist'

// POST /api/premium/checklist { token, item_id, marcado } -> { ok: true }
// Upsert por (pedido, item_id). Item fora da lista de ids validos: 400.
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)
  const token = String(body?.token || '')
  const itemId = body?.item_id
  if (!idChecklistValido(itemId) || typeof body?.marcado !== 'boolean') throw createError({ statusCode: 400 })
  if (!dentroDoTetoChecklist(`e:${token}`, TETO_ESCRITA_POR_TOKEN)) throw createError({ statusCode: 429 })
  const sb = usePremiumSupabase()
  const pedido = await pedidoDoChecklist(sb, token)
  if (!pedido) throw createError({ statusCode: 404 })
  if (!(await gravarChecklist(sb, pedido.id, itemId, body.marcado))) throw createError({ statusCode: 502 })
  return { ok: true }
})
