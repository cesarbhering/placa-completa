// Processa um pedido PAGO: dispara a consulta SENATRAN uma vez, entrega ou
// reembolsa. Usado pelo WEBHOOK e pelo POLLING de status (o que chegar primeiro).
// Trava atomica via update condicional (status aguardando/pago -> consultando):
// so um processo "reivindica" o pedido; os outros saem.
export async function processarPedidoPago(
  supabase: any,
  pedido: {
    id: string; placa: string; email: string | null; token_entrega: string
    abacatepay_id: string | null
    // usado no assunto e no corpo do e-mail de entrega
    plano?: string | null
    // controle de teste: 'producao' dispara consulta real; ausente => 'homolog'
    ambiente?: string | null
  },
): Promise<void> {
  const ambiente = pedido.ambiente === 'producao' ? 'producao' : 'homolog'
  const { data: claimed } = await supabase
    .from('pedidos_premium')
    .update({ status: 'consultando', pago_em: new Date().toISOString() })
    .eq('id', pedido.id)
    .in('status', ['aguardando_pagamento', 'pago'])
    .select()
  if (!claimed || !claimed.length) return // ja reivindicado/processado

  try {
    const r = await consultarSenatran(pedido.placa, ambiente)
    await supabase
      .from('pedidos_premium')
      .update({ status: 'entregue', entregue_em: new Date().toISOString(), consulta_id: r.consultaId, debug_trace: r.trace })
      .eq('id', pedido.id)
    // Placa e plano entram no assunto e no corpo: "seu relatorio completo da
    // placa ABC1D23 esta pronto" e reconhecivel na caixa de entrada, "sua
    // consulta esta pronta" nao.
    await enviarRelatorioEmail({
      email: pedido.email,
      token: pedido.token_entrega,
      plano: pedido.plano,
      placa: pedido.placa,
    })
  } catch (e: any) {
    await supabase.from('pedidos_premium').update({ status: 'falha', erro: String(e?.message || e), debug_trace: (e as any)?.trace ?? null }).eq('id', pedido.id)
    let reembolsado = false
    if (pedido.abacatepay_id) reembolsado = await reembolsarPix(pedido.abacatepay_id)
    if (reembolsado) {
      await supabase.from('pedidos_premium').update({ status: 'reembolsado' }).eq('id', pedido.id)
    } else {
      await sendErrorEmail({
        endpoint: '/premium/processar',
        errorMessage: `PAGO, CONSULTA FALHOU e REEMBOLSO FALHOU. pedido=${pedido.id} placa=${pedido.placa} charge=${pedido.abacatepay_id} erro=${String(e?.message || e)}`,
      })
    }
  }
}
