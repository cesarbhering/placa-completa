import { gravarPagadorHash, sanearPayloadWebhook } from '../../utils/pagador-hash'
// Webhook do Stripe (cartao). Endpoint separado do Pix (AbacatePay/Woovi) de
// proposito: o payload e, principalmente, a prova de quem mandou sao diferentes.
// Aqui a assinatura e HMAC-SHA256 com o webhook secret (whsec_...) do Stripe
// sobre o corpo CRU (header Stripe-Signature). A entrega em si e a mesma dos
// outros: processarPedidoPago. O polling do status.get.ts cobre a entrega
// mesmo se o webhook falhar (ex: homolog atras do challenge do Cloudflare).
export default defineEventHandler(async (event) => {
  const raw = String((await readRawBody(event)) || '')
  const assinatura = getRequestHeader(event, 'stripe-signature') || ''
  const segredo = stripeWebhookSecret()

  // Sem segredo configurado nao da pra provar nada: recusa (nao no-op), pra o
  // Stripe reenviar quando o ambiente estiver completo.
  if (!segredo) throw createError({ statusCode: 503, message: 'webhook nao configurado' })
  if (!verificarAssinaturaStripe(raw, assinatura, segredo)) {
    throw createError({ statusCode: 401, message: 'assinatura invalida' })
  }

  let payload: any = {}
  try { payload = JSON.parse(raw) } catch { /* assinatura ja passou; corpo malformado cai como vazio */ }
  const tipo = String(payload?.type || '')
  const sessao = payload?.data?.object || {}
  const sessionId = String(sessao?.id || '')
  const pedidoIdMeta = String(sessao?.metadata?.pedido_id || sessao?.client_reference_id || '')

  const supabase = usePremiumSupabase()
  // Mesma tabela de auditoria/idempotencia dos outros provedores. Guarda o id do
  // EVENTO do Stripe (evt_...) em abacatepay_id: e a chave natural de dedup aqui.
  const eventoId = String(payload?.id || sessionId)
  await supabase.from('webhook_events').insert({
    // Sem dados do titular (nome, e-mail, endereco) no log de auditoria.
    provider: 'stripe', event: tipo, abacatepay_id: eventoId, payload: sanearPayloadWebhook(payload),
  })

  // Interessa a conclusao paga:
  //   v2 (Elements): payment_intent.succeeded (data.object = o PaymentIntent).
  //   v1 (Checkout hospedado): checkout.session.completed com payment_status=paid.
  const pago = tipo === 'payment_intent.succeeded'
    || (tipo === 'checkout.session.completed' && sessao?.payment_status === 'paid')
    || tipo === 'checkout.session.async_payment_succeeded'
  if (!pago) return { ok: true, ignored: tipo }

  let pedido: any = null
  if (sessionId) ({ data: pedido } = await supabase.from('pedidos_premium').select('*').eq('stripe_session_id', sessionId).maybeSingle())
  if (!pedido && pedidoIdMeta) ({ data: pedido } = await supabase.from('pedidos_premium').select('*').eq('id', pedidoIdMeta).maybeSingle())
  if (!pedido) return { ok: true, semPedido: true }

  // Claim atomico dentro de processarPedidoPago evita duplicar com o polling do
  // status.get.ts (os dois podem detectar o mesmo pagamento).
  void gravarPagadorHash(supabase, pedido)
  await processarPedidoPago(supabase, pedido)
  await supabase.from('webhook_events').update({ processado: true }).eq('abacatepay_id', eventoId)
  return { ok: true }
})
