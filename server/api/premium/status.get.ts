// Status do pedido pelo token (polling da tela pendente). O token e a
// credencial, entao nao exige gate. Quando detecta o pagamento (via AbacatePay),
// DISPARA a consulta (fire-and-forget) - assim o fluxo completa mesmo sem webhook.
export default defineEventHandler(async (event) => {
  const { token } = getQuery(event)
  if (!token) throw createError({ statusCode: 400, message: 'token obrigatorio' })
  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('id,status,placa,email,token_entrega,abacatepay_id,pix_provider,google_play_order_id,expira_em,plano,ambiente,debug_trace,erro,preview,valor_centavos,gclid,msclkid,utm_source,utm_campaign')
    .eq('token_entrega', String(token))
    .single()
  if (!pedido) throw createError({ statusCode: 404, message: 'Pedido nao encontrado' })

  let status = pedido.status
  if (status === 'aguardando_pagamento') {
    if (pedido.expira_em && new Date(pedido.expira_em).getTime() < Date.now()) {
      status = 'expirado'
      await supabase.from('pedidos_premium').update({ status }).eq('id', pedido.id)
    } else if (pedido.abacatepay_id) {
      // Pergunta pro provedor que criou ESTA cobranca, nao pro configurado
      // agora: os dois convivem enquanto a troca acontece.
      const chk = await provedorDoPedido(pedido.pix_provider).checarPix(pedido.abacatepay_id)
      if (chk && /paid|completed|pago/i.test(chk.status)) {
        // pagamento confirmado -> dispara a consulta (claim atomico evita duplicar
        // com o webhook). Fire-and-forget: o container segue processando apos a resposta.
        processarPedidoPago(supabase, pedido).catch(() => {})
        status = 'consultando'
      }
    }
  }
  return {
    status,
    ...(String(getQuery(event).debug) === '1' ? { debug_trace: pedido.debug_trace, erro: pedido.erro, ambiente: pedido.ambiente } : {}),
  }
})
