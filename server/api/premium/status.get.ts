// Status do pedido pelo token (polling da tela pendente). O token e a
// credencial, entao nao exige gate. Quando detecta o pagamento (via AbacatePay),
// DISPARA a consulta (fire-and-forget) - assim o fluxo completa mesmo sem webhook.
export default defineEventHandler(async (event) => {
  const { token } = getQuery(event)
  if (!token) throw createError({ statusCode: 400, message: 'token obrigatorio' })
  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('id,status,placa,email,token_entrega,abacatepay_id,pix_provider,forma_pagamento,stripe_session_id,google_play_order_id,expira_em,plano,ambiente,debug_trace,erro,preview,valor_centavos,gclid,msclkid,utm_source,utm_campaign,entregue_em,relatorio_snapshot')
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
    } else if (pedido.forma_pagamento === 'cartao' && pedido.stripe_session_id) {
      // Cartao (Stripe): pergunta pra sessao se o cartao passou. Igual ao Pix,
      // isso confirma o pagamento mesmo sem webhook (essencial no homolog, atras
      // do challenge do Cloudflare, onde o webhook do Stripe toma 403).
      const s = await consultarStripeSession(pedido.stripe_session_id)
      if (stripeSessionPaga(s)) {
        processarPedidoPago(supabase, pedido).catch(() => {})
        status = 'consultando'
      }
    }
  }
  // Piso de loading: quando o registro traz recall e/ou multa (SP), a tela de
  // checkout segura a navegacao por ~40s pra os enriquecimentos rodarem e a
  // FIPE ganhar contexto, mostrando o que esta sendo buscado. Expomos as flags
  // e o entregue_em; o FLOOR e do cliente (so no fluxo recem-entregue, nunca
  // numa revisita de link antigo). So calcula na entrega (snapshot ja existe).
  let piso: Record<string, unknown> = {}
  if (status === 'entregue') {
    const resp = (pedido.relatorio_snapshot as any)?.consulta?.response
    piso = {
      entregue_em: pedido.entregue_em,
      temRecall: temRecallPendente(resp),
      temMultaSP: temMultaSP(resp),
    }
  }

  return {
    status,
    ...piso,
    ...(String(getQuery(event).debug) === '1' ? { debug_trace: pedido.debug_trace, erro: pedido.erro, ambiente: pedido.ambiente } : {}),
  }
})
