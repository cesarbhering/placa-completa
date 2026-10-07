// Decide se um pedido pendente JA foi pago, olhando as trilhas certas na ordem
// certa. Extraido do status.get pra ser testavel sem Nitro: os checadores
// (Stripe / Pix) entram como dependencias.
//
// Regressao que motivou isto ("abriu Pix, trocou pra cartao"): um pedido de
// cartao podia acabar com um abacatepay_id de Pix (a tela do relatorio renovava
// Pix num pedido sem br_code). O codigo antigo checava SO o Pix (nunca pago) e
// nunca o Stripe -> o pedido de cartao travava em aguardando pra sempre. Aqui o
// cartao e checado PRIMEIRO, e o Pix segue sendo checado tambem (pagamento
// detectado em qualquer trilha; o claim atomico do processarPedidoPago evita
// processar duas vezes).

export interface PedidoPagamento {
  forma_pagamento?: string | null
  stripe_session_id?: string | null
  abacatepay_id?: string | null
  pix_provider?: string | null
}

export interface CheadoresPagamento {
  /** true se a sessao Stripe esta paga. */
  checarStripe: (sessionId: string) => Promise<boolean>
  /** true se a cobranca Pix esta paga (no provedor que a criou). */
  checarPix: (provider: string | null | undefined, chargeId: string) => Promise<boolean>
}

export async function detectarPagamento(pedido: PedidoPagamento, deps: CheadoresPagamento): Promise<boolean> {
  const ehCartao = pedido.forma_pagamento === 'cartao'

  // Cartao PRIMEIRO: trilha principal do pedido de cartao.
  if (ehCartao && pedido.stripe_session_id) {
    if (await deps.checarStripe(pedido.stripe_session_id)) return true
  }

  // Pix: checado inclusive num pedido de cartao (se um Pix existir), pra detectar
  // pagamento em qualquer trilha.
  if (pedido.abacatepay_id) {
    if (await deps.checarPix(pedido.pix_provider, pedido.abacatepay_id)) return true
  }

  return false
}

/**
 * Rede de seguranca do Pix (RBF5A06, 07/out): a cobranca Woovi ORIGINAL de um
 * pedido (correlationID = pedido.id) pode ter sido paga enquanto o pedido ja
 * apontava pra outra cobranca (renovacao que caiu na AbacatePay). Vale olhar a
 * Woovi pelo id do pedido quando o pedido nao aponta pra Woovi, ou quando o Pix
 * atual ja venceu (pedido parado, polling raro, entao a chamada extra e barata).
 * Cartao fica fora.
 */
export function deveChecarWooviOriginal(
  pedido: PedidoPagamento & { expira_em?: string | null },
  agora: number = Date.now(),
): boolean {
  if (pedido.forma_pagamento === 'cartao') return false
  if (String(pedido.pix_provider || '').toLowerCase() !== 'woovi') return true
  return !!pedido.expira_em && new Date(pedido.expira_em).getTime() < agora
}
