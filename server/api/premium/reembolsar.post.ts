import { cancelarNfse } from '../../utils/nfse'
import { emVoo } from '../../utils/tarefas-em-voo'
import { assertAdminSecret } from '../../utils/admin-secret'

// Operator-only: retries the refund of an order that was PAID but could not be
// delivered and whose automatic refund failed (typically INSUFFICIENT_FUNDS,
// when the money paid is still `pending` and there is no `available` balance).
//
// Requires x-admin-secret in every environment (404 without it, like the other
// operator routes). The order token in the body only says which order to
// refund; it is not a credential here. No page calls this route.
//
// Idempotent: an order already marked reembolsado is answered without asking
// the provider again, and the provider deduplicates a repeated refund.
export default defineEventHandler(async (event) => {
  assertAdminSecret(event)
  const { token } = await readBody(event)
  if (!token) throw createError({ statusCode: 400, message: 'token obrigatorio' })

  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('id, abacatepay_id, pix_provider, status')
    .eq('token_entrega', String(token))
    .single()
  if (!pedido) throw createError({ statusCode: 404, message: 'Pedido nao encontrado' })
  if (pedido.status === 'reembolsado') return { ok: true, jaReembolsado: true }
  if (!pedido.abacatepay_id) throw createError({ statusCode: 409, message: 'Pedido sem cobranca' })

  const r = await provedorDoPedido((pedido as any).pix_provider).reembolsarPix(pedido.abacatepay_id)
  if (r.ok) {
    await supabase.from('pedidos_premium').update({ status: 'reembolsado' }).eq('id', pedido.id)
    void emVoo('nfse-cancelar', () => cancelarNfse(supabase, pedido.id))
  }
  return { ok: r.ok, error: r.error }
})
