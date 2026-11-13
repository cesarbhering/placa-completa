import { detectarPagamento, deveChecarWooviOriginal, type PedidoPagamento } from './status-pagamento'
import { provedorDoPedido } from './pix-provider'
import { cobrancaPorCorrelacao } from './woovi'
import { consultarPaymentIntent, consultarStripeSession, paymentIntentPago, stripeSessionPaga } from './stripe'

// The single rule that decides whether an order has been paid. It is shared by
// the buyer's polling (server/api/premium/status.get.ts) and by the Woovi
// webhook (server/api/premium/webhook-woovi.ts), so the two can never drift.
//
// The answer always comes from a payment provider, asked with OUR credential,
// about a charge that is tied to the order on our side: the charge recorded on
// the order, or the original Woovi charge (correlationID = order id). Nothing
// a caller brings along (an event body, a query string) takes part in it.

/**
 * - 'pago': a provider confirmed a paid charge of this order.
 * - 'nao_pago': every provider that had to be asked answered, and none has a
 *   paid charge of this order.
 * - 'indeterminado': no paid charge was found, but at least one provider did
 *   not answer (network error, timeout, non-2xx reply), so "not paid" cannot
 *   be asserted either.
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
  // The provider modules return null when they could not get an answer.
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
      const chk = await provedorDoPedido(provider).checarPix(chargeId)
      if (!chk) semResposta = true
      return !!(chk && /paid|completed|pago/i.test(chk.status))
    },
  })

  // Safety net: the ORIGINAL Woovi charge (correlationID = pedido.id) paid
  // while the order pointed to another one (see deveChecarWooviOriginal).
  if (!pago && deveChecarWooviOriginal(pedido)) {
    const orig = await cobrancaPorCorrelacao(pedido.id)
    if (!orig) semResposta = true
    if (orig?.status === 'PAID') {
      console.warn(`[pix] pagamento achado na cobranca Woovi original; repointando pedido=${pedido.id}`)
      await supabase.from('pedidos_premium').update({ pix_provider: 'woovi', abacatepay_id: orig.identifier }).eq('id', pedido.id)
      pedido.pix_provider = 'woovi'
      pedido.abacatepay_id = orig.identifier
      pago = true
    }
  }

  if (pago) return 'pago'
  return semResposta ? 'indeterminado' : 'nao_pago'
}
