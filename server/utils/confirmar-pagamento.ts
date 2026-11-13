import { detectarPagamento, deveChecarWooviOriginal, type PedidoPagamento } from './status-pagamento'
import { provedorDoPedido } from './pix-provider'
import { consultarCobrancaPorCorrelacao, pedidoDaCorrelacao } from './woovi'
import { consultarPaymentIntent, consultarStripeSession, paymentIntentPago, stripeSessionPaga } from './stripe'

// The single rule that decides whether an order has been paid. It is shared by
// the buyer's polling (server/api/premium/status.get.ts) and by the Woovi
// webhook (server/api/premium/webhook-woovi.ts), so the two can never drift.
//
// The answer always comes from a payment provider, asked with OUR credential,
// about a charge that is tied to the order on our side: the charge recorded on
// the order, or the original Woovi charge (correlationID = order id). Nothing
// a caller brings along (an event body, a query string) takes part in it.
//
// The webhook has one more question, confirmarCobrancaDoEvento, at the end of
// this file: it follows the same principle and never runs for the polling.

/**
 * - 'pago': a provider confirmed a paid charge of this order.
 * - 'nao_pago': every provider that had to be asked answered, and none has a
 *   paid charge of this order. "There is no such charge in your account" is an
 *   answer too.
 * - 'indeterminado': no paid charge was found, but at least one provider did
 *   not answer (network error, timeout, refused credential, provider error),
 *   so "not paid" cannot be asserted either. See pix-consulta.ts for what
 *   counts as an answer.
 */
export type ConfirmacaoPagamento = 'pago' | 'nao_pago' | 'indeterminado'

export type PedidoConfirmavel = PedidoPagamento & { id: string; expira_em?: string | null }

/**
 * Asks the providers whether the order has a paid charge. When the payment is
 * found on the original Woovi charge while the order points to another one,
 * the order is repointed to it, in the database and in the `pedido` object
 * handed in, so that status, refund and payer hash hit the right charge.
 *
 * Errors thrown by a provider module (for example a provider that is not
 * configured) are not swallowed here: each caller decides what they mean.
 */
export async function confirmarPagamentoDoPedido(supabase: any, pedido: PedidoConfirmavel): Promise<ConfirmacaoPagamento> {
  // True once a provider that had to be asked did not answer.
  let semResposta = false

  // Card FIRST (Stripe), then Pix: a payment is detected on any track. See
  // status-pagamento.ts for the "opened Pix, switched to card" regression.
  let pago = await detectarPagamento(pedido, {
    // v2 (Elements) stores the pi_ of the PaymentIntent; v1 (hosted Checkout)
    // the cs_ of the session. Both are detected.
    checarStripe: async (id) => {
      if (id.startsWith('pi_')) {
        const intent = await consultarPaymentIntent(id)
        if (!intent) semResposta = true
        return paymentIntentPago(intent)
      }
      const sessao = await consultarStripeSession(id)
      if (!sessao) semResposta = true
      return stripeSessionPaga(sessao)
    },
    checarPix: async (provider, chargeId) => {
      // Ask the provider that created THIS charge, not the one configured
      // now: both coexist while the switch between them happens.
      const consulta = await provedorDoPedido(provider).consultarPix(chargeId)
      if (consulta.situacao === 'sem_resposta') semResposta = true
      return consulta.situacao === 'encontrada' && /paid|completed|pago/i.test(consulta.cobranca.status)
    },
  })

  // Safety net: the ORIGINAL Woovi charge (correlationID = pedido.id) paid
  // while the order pointed to another one (see deveChecarWooviOriginal).
  if (!pago && deveChecarWooviOriginal(pedido)) {
    const consulta = await consultarCobrancaPorCorrelacao(pedido.id)
    if (consulta.situacao === 'sem_resposta') semResposta = true
    if (consulta.situacao === 'encontrada' && consulta.cobranca.status === 'PAID') {
      const { identifier } = consulta.cobranca
      console.warn(`[pix] pagamento achado na cobranca Woovi original; repointando pedido=${pedido.id}`)
      await supabase.from('pedidos_premium').update({ pix_provider: 'woovi', abacatepay_id: identifier }).eq('id', pedido.id)
      pedido.pix_provider = 'woovi'
      pedido.abacatepay_id = identifier
      pago = true
    }
  }

  if (pago) return 'pago'
  return semResposta ? 'indeterminado' : 'nao_pago'
}

/**
 * Webhook only. The charge that an event names, looked up in OUR account by
 * its correlationID. It reaches what the rule above does not: a payment on a
 * charge of the order that is neither the recorded one nor the original (an
 * older renewal), or on the original while the recorded charge is still inside
 * its window.
 *
 * The correlationID comes from the event, so it is a search key and nothing
 * more:
 * - it has to map to this very order (we create it as `<order id>` or
 *   `<order id>-r<suffix>`); otherwise nothing is asked and there is no
 *   verdict (null);
 * - the charge has to exist in our account, which is what asking with our
 *   credential answers;
 * - the provider's own record of that charge has to be paid and to carry a
 *   correlationID that maps to this order too.
 *
 * When all of that holds, the order is repointed to the charge, the way the
 * rule above does for the original, and the verdict is 'pago'.
 */
export async function confirmarCobrancaDoEvento(supabase: any, pedido: PedidoConfirmavel, correlationID: unknown): Promise<ConfirmacaoPagamento | null> {
  const correlacao = typeof correlationID === 'string' ? correlationID : ''
  if (!correlacao || pedidoDaCorrelacao(correlacao) !== pedido.id) return null

  const consulta = await consultarCobrancaPorCorrelacao(correlacao)
  if (consulta.situacao === 'sem_resposta') return 'indeterminado'
  if (consulta.situacao === 'nao_encontrada') return 'nao_pago'

  const { status, identifier, correlationID: registrada } = consulta.cobranca
  if (status !== 'PAID' || pedidoDaCorrelacao(registrada) !== pedido.id) return 'nao_pago'

  const jaApontaPraEla = String(pedido.pix_provider || '').toLowerCase() === 'woovi' && pedido.abacatepay_id === identifier
  if (!jaApontaPraEla) {
    console.warn(`[pix] pagamento achado na cobranca Woovi do evento; repointando pedido=${pedido.id}`)
    await supabase.from('pedidos_premium').update({ pix_provider: 'woovi', abacatepay_id: identifier }).eq('id', pedido.id)
    pedido.pix_provider = 'woovi'
    pedido.abacatepay_id = identifier
  }
  return 'pago'
}
