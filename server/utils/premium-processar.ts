// Processa um pedido PAGO: dispara a consulta SENATRAN uma vez, entrega ou
// reembolsa. Usado pelo WEBHOOK e pelo POLLING de status (o que chegar primeiro).
// Trava atomica via update condicional (status aguardando/pago -> consultando):
// so um processo "reivindica" o pedido; os outros saem.
export async function processarPedidoPago(
  supabase: any,
  pedido: { id: string; placa: string; email: string | null; token_entrega: string; abacatepay_id: string | null },
): Promise<void> {
  const { data: claimed } = await supabase
    .from('pedidos_premium')
    .update({ status: 'consultando', pago_em: new Date().toISOString() })
    .eq('id', pedido.id)
    .in('status', ['aguardando_pagamento', 'pago'])
    .select()
  if (!claimed || !claimed.length) return // ja reivindicado/processado

  try {
    const r = await consultarSenatran(pedido.placa)
    await supabase
      .from('pedidos_premium')
      .update({ status: 'entregue', entregue_em: new Date().toISOString(), consulta_id: r.consultaId })
      .eq('id', pedido.id)
    await enviarRelatorioEmail(pedido.email, pedido.token_entrega)
  } catch (e: any) {
    await supabase.from('pedidos_premium').update({ status: 'falha', erro: String(e?.message || e) }).eq('id', pedido.id)
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
