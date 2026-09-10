// Retenta o reembolso de um pedido que foi PAGO mas nao pode ser concluido, e
// cujo estorno automatico falhou (tipicamente INSUFFICIENT_FUNDS, quando o
// dinheiro pago ainda esta em `pending` e nao ha saldo `available`). Idempotente
// do lado da AbacatePay. Gated + exige o token do pedido (credencial).
export default defineEventHandler(async (event) => {
  assertPremiumGate(event)
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
  }
  return { ok: r.ok, error: r.error }
})
