// Webhook AbacatePay. Confirma pagamento (HMAC) e dispara a consulta SENATRAN
// UMA vez (idempotente). Falhou a consulta -> reembolsa. Nunca exige gate.
export default defineEventHandler(async (event) => {
  const raw = String((await readRawBody(event)) || '')
  const signature = getRequestHeader(event, 'x-webhook-signature')
  const timestamp = getRequestHeader(event, 'x-webhook-timestamp')
  const querySecret = String((getQuery(event).webhookSecret as string) || '')
  if (!verificarWebhook({ rawBody: raw, signature, timestamp, querySecret }))
    throw createError({ statusCode: 401, message: 'assinatura invalida' })

  let payload: any = {}
  try { payload = JSON.parse(String(raw)) } catch { /* noop */ }
  const evt: string = payload.event || payload.type || ''
  const data = payload.data || {}
  const abacatepayId: string | undefined = data.id || data?.pixQrCode?.id
  const pedidoId: string | undefined = data?.metadata?.pedidoId

  const supabase = usePremiumSupabase()
  await supabase.from('webhook_events').insert({ event: evt, abacatepay_id: abacatepayId, payload })

  // so pagamento confirmado interessa
  const pago = /completed|paid|pago/i.test(evt)
  if (!pago) return { ok: true, ignored: evt }

  // acha o pedido por metadata.pedidoId ou pelo id do charge
  let pedido: any = null
  if (pedidoId) ({ data: pedido } = await supabase.from('pedidos_premium').select('*').eq('id', pedidoId).single())
  if (!pedido && abacatepayId) ({ data: pedido } = await supabase.from('pedidos_premium').select('*').eq('abacatepay_id', abacatepayId).single())
  if (!pedido) return { ok: true, semPedido: true }

  // idempotencia: so processa se ainda nao entrou em consulta/entrega
  // processador compartilhado (idempotente via claim atomico)
  await processarPedidoPago(supabase, pedido)
  if (abacatepayId) await supabase.from('webhook_events').update({ processado: true }).eq('abacatepay_id', abacatepayId)
  return { ok: true }
})
