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
    const ehCartao = pedido.forma_pagamento === 'cartao'
    // Cartao PRIMEIRO (Stripe), depois Pix — detecta pagamento em qualquer
    // trilha. Ver status-pagamento.ts pra a regressao "abriu Pix, trocou pra
    // cartao" que isto conserta.
    const pago = await detectarPagamento(pedido, {
      checarStripe: async (sid) => stripeSessionPaga(await consultarStripeSession(sid)),
      checarPix: async (provider, chargeId) => {
        // Pergunta pro provedor que criou ESTA cobranca, nao pro configurado
        // agora: os dois convivem enquanto a troca acontece.
        const chk = await provedorDoPedido(provider).checarPix(chargeId)
        return !!(chk && /paid|completed|pago/i.test(chk.status))
      },
    })

    if (pago) {
      // pagamento confirmado -> dispara a consulta (fire-and-forget; o container
      // segue processando apos a resposta). Claim atomico evita duplicar.
      processarPedidoPago(supabase, pedido).catch(() => {})
      status = 'consultando'
    } else if (!ehCartao && pedido.expira_em && new Date(pedido.expira_em).getTime() < Date.now()) {
      // So o Pix expira pela janela do QR (15 min). Pedido de cartao NUNCA vira
      // 'expirado' por causa de um expira_em de Pix: a sessao Stripe tem prazo
      // proprio e a tela do cartao segue confirmando ate o pagamento cair.
      status = 'expirado'
      await supabase.from('pedidos_premium').update({ status }).eq('id', pedido.id)
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
