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
// The webhook has one more question, conferirCobrancaDoEvento, further down:
// it follows the same principle and never runs for the polling.

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

export interface OpcoesDeConfirmacao {
  /**
   * When set, a lookup that throws (a provider that is not configured, for
   * example) counts as "did not answer" and the lookups after it still run.
   * The webhook sets it. The polling does not: there, an error thrown by a
   * provider module reaches the caller.
   */
  falhaContaComoSemResposta?: boolean
}

/**
 * Asks the providers whether the order has a paid charge. When the payment is
 * found on the original Woovi charge while the order points to another one,
 * the order is repointed to it, in the database and in the `pedido` object
 * handed in, so that status, refund and payer hash hit the right charge.
 */
export async function confirmarPagamentoDoPedido(
  supabase: any,
  pedido: PedidoConfirmavel,
  opcoes: OpcoesDeConfirmacao = {},
): Promise<ConfirmacaoPagamento> {
  // True once a provider that had to be asked did not answer.
  let semResposta = false

  /** Runs one lookup. With the option on, a lookup that throws did not answer. */
  const consultar = async <T>(consulta: () => Promise<T>, quandoFalha: T): Promise<T> => {
    if (!opcoes.falhaContaComoSemResposta) return consulta()
    try {
      return await consulta()
    } catch {
      return quandoFalha
    }
  }

  // Card FIRST (Stripe), then Pix: a payment is detected on any track. See
  // status-pagamento.ts for the "opened Pix, switched to card" regression.
  let pago = await detectarPagamento(pedido, {
    // v2 (Elements) stores the pi_ of the PaymentIntent; v1 (hosted Checkout)
    // the cs_ of the session. Both are detected.
    checarStripe: async (id) => {
      if (id.startsWith('pi_')) {
        const intent = await consultar(() => consultarPaymentIntent(id), null)
        if (!intent) semResposta = true
        return paymentIntentPago(intent)
      }
      const sessao = await consultar(() => consultarStripeSession(id), null)
      if (!sessao) semResposta = true
      return stripeSessionPaga(sessao)
    },
    checarPix: async (provider, chargeId) => {
      // Ask the provider that created THIS charge, not the one configured
      // now: both coexist while the switch between them happens.
      const consulta = await consultar(() => provedorDoPedido(provider).consultarPix(chargeId), { situacao: 'sem_resposta' as const })
      if (consulta.situacao === 'sem_resposta') semResposta = true
      return consulta.situacao === 'encontrada' && /paid|completed|pago/i.test(consulta.cobranca.status)
    },
  })

  // Safety net: the ORIGINAL Woovi charge (correlationID = pedido.id) paid
  // while the order pointed to another one (see deveChecarWooviOriginal).
  if (!pago && deveChecarWooviOriginal(pedido)) {
    const consulta = await consultar(() => consultarCobrancaPorCorrelacao(pedido.id), { situacao: 'sem_resposta' as const })
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
 * What our account says about the charge an event names.
 *
 * - 'nossa': the charge is in our account, the provider ties it to this
 *   order, and it is the very charge the event carries. `paga` tells whether
 *   the provider already shows it as paid.
 * - 'estranha': not a charge of ours for this order. `motivo` says why.
 * - 'sem_resposta': the provider could not be asked.
 */
export type CobrancaDoEvento =
  | { situacao: 'nossa'; paga: boolean; identifier: string }
  | { situacao: 'estranha'; motivo: 'sem_correlacao_do_pedido' | 'nao_existe' | 'outra_cobranca' | 'de_outro_pedido' }
  | { situacao: 'sem_resposta' }

/**
 * Webhook only. Looks up, in OUR account, the charge that an event names by
 * its correlationID, and checks it against what the event says.
 *
 * The correlationID and the identifier come from the event, so they are search
 * keys to be checked and nothing more:
 * - the correlationID has to map to this very order (we create it as
 *   `<order id>` or `<order id>-r<suffix>`); otherwise nothing is asked;
 * - the charge has to exist in our account, which is what asking with our
 *   credential answers;
 * - the provider's own record of that charge has to carry a correlationID
 *   that maps to this order, and the identifier the event carries.
 *
 * It only reads. Nothing is written to the order here.
 */
export async function conferirCobrancaDoEvento(
  pedido: { id: string },
  evento: { correlationID: unknown; identifier: unknown },
): Promise<CobrancaDoEvento> {
  const correlacao = typeof evento.correlationID === 'string' ? evento.correlationID : ''
  if (!correlacao || pedidoDaCorrelacao(correlacao) !== pedido.id) return { situacao: 'estranha', motivo: 'sem_correlacao_do_pedido' }
  const identificador = typeof evento.identifier === 'string' ? evento.identifier : ''
  if (!identificador) return { situacao: 'estranha', motivo: 'outra_cobranca' }

  const consulta = await consultarCobrancaPorCorrelacao(correlacao)
  if (consulta.situacao === 'sem_resposta') return { situacao: 'sem_resposta' }
  if (consulta.situacao === 'nao_encontrada') return { situacao: 'estranha', motivo: 'nao_existe' }

  const { status, identifier, correlationID: registrada } = consulta.cobranca
  if (pedidoDaCorrelacao(registrada) !== pedido.id) return { situacao: 'estranha', motivo: 'de_outro_pedido' }
  if (identifier !== identificador) return { situacao: 'estranha', motivo: 'outra_cobranca' }
  return { situacao: 'nossa', paga: status === 'PAID', identifier }
}

/**
 * Webhook only. Points the order at a Woovi charge of its own that the
 * provider confirmed, in the database and in the `pedido` object handed in.
 * Does nothing when the order already points at it.
 */
export async function reapontarPedido(supabase: any, pedido: PedidoConfirmavel, identifier: string): Promise<void> {
  if (String(pedido.pix_provider || '').toLowerCase() === 'woovi' && pedido.abacatepay_id === identifier) return
  console.warn(`[pix] payment found on the Woovi charge the event names; repointing the order pedido=${pedido.id}`)
  await supabase.from('pedidos_premium').update({ pix_provider: 'woovi', abacatepay_id: identifier }).eq('id', pedido.id)
  pedido.pix_provider = 'woovi'
  pedido.abacatepay_id = identifier
}
