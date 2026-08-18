// Webhook AbacatePay. Confirma pagamento (HMAC) e dispara a consulta SENATRAN
// UMA vez (idempotente). Falhou a consulta -> reembolsa. Nunca exige gate.
export default defineEventHandler(async (event) => {
  const raw = (await readRawBody(event)) || ''
  const sig =
    getRequestHeader(event, 'x-abacatepay-signature') ||
    getRequestHeader(event, 'abacatepay-signature') ||
    getRequestHeader(event, 'x-webhook-signature')
  if (!verificarWebhook(String(raw), sig)) throw createError({ statusCode: 401, message: 'assinatura invalida' })

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
  if (['consultando', 'entregue', 'reembolsado'].includes(pedido.status)) return { ok: true, jaProcessado: true }

  await supabase.from('pedidos_premium').update({ status: 'consultando', pago_em: new Date().toISOString() }).eq('id', pedido.id)

  try {
    const r = await consultarSenatran(pedido.placa)
    await supabase
      .from('pedidos_premium')
      .update({ status: 'entregue', entregue_em: new Date().toISOString(), consulta_id: r.consultaId })
      .eq('id', pedido.id)
    await enviarRelatorioEmail(pedido.email, pedido.token_entrega)
  } catch (e: any) {
    await supabase.from('pedidos_premium').update({ status: 'falha', erro: String(e?.message || e) }).eq('id', pedido.id)
    // falhou depois de pago -> reembolsa
    if (pedido.abacatepay_id) {
      const ok = await reembolsarPix(pedido.abacatepay_id)
      if (ok) await supabase.from('pedidos_premium').update({ status: 'reembolsado' }).eq('id', pedido.id)
    }
  }
  if (abacatepayId) await supabase.from('webhook_events').update({ processado: true }).eq('abacatepay_id', abacatepayId)
  return { ok: true }
})
