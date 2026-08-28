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
    // preview salvo no checkout (uf/municipio do veiculo) — usado so pra
    // montar o snapshot do relatorio (valorCusto). Opcional: quando ausente
    // (chamadores antigos/parciais), o snapshot ainda grava, so sem
    // uf/municipio (getValorCusto cai pro fallback dele).
    preview?: any
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

    // Snapshot imutavel: monta o payload agregado (consulta filtrada por
    // plano + valorCusto + chassiOrigem + camposRestantes) UMA VEZ, aqui na
    // entrega, pra report.get nunca mais precisar refazer chamadas externas
    // (vin-decoder/FIPE/seguro) nas visualizacoes seguintes. Fail-safe: se a
    // gravacao falhar, so loga — report.get tem fallback lazy que monta e
    // grava na 1a visualizacao caso o snapshot ainda nao exista.
    try {
      const snapshot = await montarRelatorioSnapshot(supabase, {
        placa: pedido.placa,
        plano: pedido.plano || 'completa',
        consulta_id: r.consultaId,
        preview: pedido.preview,
      })
      await supabase
        .from('pedidos_premium')
        .update({ relatorio_snapshot: snapshot, snapshot_em: new Date().toISOString() })
        .eq('id', pedido.id)
    } catch (snapErr: any) {
      if (import.meta.dev) console.warn('[premium] snapshot falhou na entrega, fallback lazy cobre depois:', snapErr?.message || snapErr)
    }

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
    const reembolso = pedido.abacatepay_id
      ? await reembolsarPix(pedido.abacatepay_id)
      : { ok: false, error: 'pedido sem cobranca' }
    if (reembolso.ok) {
      await supabase.from('pedidos_premium').update({ status: 'reembolsado' }).eq('id', pedido.id)
    } else {
      // Reembolso NAO aconteceu: guarda o motivo no pedido e alerta. O status
      // fica 'falha' (a UI nao promete estorno que nao ocorreu). O erro tipico
      // (INSUFFICIENT_FUNDS) e transitorio: da pra reprocessar quando o saldo
      // liberar (ver server/api/premium/reembolsar).
      await supabase.from('pedidos_premium')
        .update({ erro: `${String(e?.message || e)} | reembolso: ${reembolso.error}` })
        .eq('id', pedido.id)
      await sendErrorEmail({
        endpoint: '/premium/processar',
        errorMessage: `PAGO, CONSULTA FALHOU e REEMBOLSO FALHOU. pedido=${pedido.id} placa=${pedido.placa} charge=${pedido.abacatepay_id} consulta_erro=${String(e?.message || e)} reembolso_erro=${reembolso.error}`,
      })
    }
  }
}
