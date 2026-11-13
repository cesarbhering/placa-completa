import { emVoo, rastrearEmVoo } from '../../utils/tarefas-em-voo'
import { chavesPublicas, verificarAssinatura, pedidoDaCorrelacao } from '../../utils/woovi'
import { gravarPagadorHash, sanearPayloadWebhook } from '../../utils/pagador-hash'
import { lerPayloadWoovi, ehPingWoovi } from '../../utils/woovi-webhook-payload'
import { encaminharWebhookFinanceiro } from '../../utils/woovi-financeiro'
import { confirmarPagamentoDoPedido, confirmarCobrancaDoEvento, type ConfirmacaoPagamento } from '../../utils/confirmar-pagamento'

// Upper bound for the payment confirmation: a provider API that hangs must not
// hold the webhook open. Past it the answer is 503 and the provider resends.
const TETO_CONFIRMACAO_MS = 10_000

/**
 * Asks the provider, with our own credential, whether the order was paid.
 *
 * First the rule of the buyer's polling: the charge recorded on the order,
 * then the original one. If neither is paid, the charge this event names is
 * looked up in our account by its correlationID, provided that correlationID
 * maps to this order. That lookup is about the event itself, so when it
 * applies its verdict stands: paid, not paid (which includes "no such charge
 * in our account") or no answer.
 *
 * Anything that prevents a clear answer (provider API error, timeout,
 * unexpected failure) is 'indeterminado': it never counts as paid and never
 * counts as not paid.
 */
async function confirmarPagamento(supabase: any, pedido: any, correlationID: unknown): Promise<ConfirmacaoPagamento> {
  let relogio: ReturnType<typeof setTimeout> | undefined
  const teto = new Promise<ConfirmacaoPagamento>((resolve) => {
    relogio = setTimeout(() => resolve('indeterminado'), TETO_CONFIRMACAO_MS)
  })
  const perguntar = async (): Promise<ConfirmacaoPagamento> => {
    const doPedido = await confirmarPagamentoDoPedido(supabase, pedido)
    if (doPedido === 'pago') return 'pago'
    const doEvento = await confirmarCobrancaDoEvento(supabase, pedido, correlationID)
    return doEvento ?? doPedido
  }
  try {
    return await Promise.race([perguntar(), teto])
  } catch {
    return 'indeterminado'
  } finally {
    clearTimeout(relogio)
  }
}

// Webhook da Woovi, handler unico pra TODOS os metodos. Endpoint separado do da
// AbacatePay de proposito: o formato do payload e, principalmente, o jeito de
// provar quem mandou sao diferentes. Misturar os dois num handler so significaria
// um if no meio da unica parte do sistema onde errar deixa qualquer um confirmar
// pagamento.
//
// Por que um arquivo so (e nao .get.ts + .post.ts): ao registrar o webhook, a
// Woovi valida a URL batendo nela com GET/HEAD (e as vezes um POST de teste) e
// SO aceita o registro se receber 200. Um handler POST-only devolvia 404 no
// GET/HEAD e o registro era recusado. Aqui qualquer metodo que nao seja POST e o
// aperto de mao, responde 200 e nao toca em nada.
//
// A assinatura e RSA-SHA256 com a chave PUBLICA da Woovi (header
// x-webhook-signature), nao HMAC com segredo nosso: a chave publica prova que
// quem mandou foi a Woovi; um HMAC provaria so que alguem conhece nosso segredo.
//
// The signature proves who sent the message, and nothing else. It does not
// prove that the charge belongs to our account, nor that it is the charge of
// the order it names. So a signed "charge completed" event only triggers a
// question: the provider is asked, with our own credential, whether the order
// has a paid charge (server/utils/confirmar-pagamento.ts, the same rule as the
// polling of status.get.ts, plus the charge the event names). Nothing in the
// event body (value, identifier, status) counts as proof of payment. The
// correlationID is used as a search key only: to find the order, and to look
// the event's charge up in our account.
export default defineEventHandler(async (event) => {
  // Handshake de validacao (GET/HEAD): nao carrega pagamento, 200 fixo.
  if (event.method !== 'POST') return { ok: true, ping: true }

  const raw = String((await readRawBody(event)) || '')
  const assinatura = getRequestHeader(event, 'x-webhook-signature') || ''

  // Corpo pode vir como JSON string duplamente codificado (teste de registro).
  const payload: any = lerPayloadWoovi(raw)

  // Ping de validacao via POST: sem assinatura, ou evento de teste. Responder
  // 200 aqui e seguro porque confirmar pagamento continua exigindo assinatura
  // valida logo abaixo; um request sem assinatura nao passa do 401 nem toca em
  // pedido nenhum.
  if (!assinatura || ehPingWoovi(payload)) {
    return { ok: true, ping: true }
  }

  // Evento real assinado: se a assinatura nao confere, 401. Isso e de proposito
  // NAO ser 200 no-op: um evento assinado que falha e ou adulteracao ou uma
  // falha transitoria na busca das chaves publicas, e nos dois casos e melhor a
  // Woovi reenviar (o polling do status.get.ts tambem cobre a entrega).
  const chaves = await chavesPublicas()
  if (!verificarAssinatura(raw, assinatura, chaves)) {
    throw createError({ statusCode: 401, message: 'assinatura invalida' })
  }

  const charge = payload?.charge || {}
  const evt = String(payload?.event || '')
  // correlationID e o id do nosso pedido: foi o que mandamos na criacao.
  // Renovacao usa `<pedido>-r<sufixo>`: tira o sufixo pra achar o pedido.
  const pedidoId = pedidoDaCorrelacao(charge?.correlationID)
  const chargeId = String(charge?.identifier || '')

  const supabase = usePremiumSupabase()
  // Every event with a valid signature is stored, whatever happens next: this
  // is the audit trail. Mesma tabela de sempre, pra auditoria e idempotencia
  // ficarem num lugar so.
  await supabase.from('webhook_events').insert({
    // Sem dados do pagador (CPF/nome) no log de auditoria.
    provider: 'woovi', event: evt, abacatepay_id: chargeId || pedidoId, payload: sanearPayloadWebhook(payload),
  })

  // The order this event is about, when it is one of ours.
  let pedido: any = null
  if (pedidoId) ({ data: pedido } = await supabase.from('pedidos_premium').select('*').eq('id', pedidoId).maybeSingle())
  if (!pedido && chargeId) ({ data: pedido } = await supabase.from('pedidos_premium').select('*').eq('abacatepay_id', chargeId).maybeSingle())

  // FULL copy to financeiro@ (reconciliation, invoices), without await: it
  // never delays the answer nor the order. Deduplicated per event (Woovi
  // delivers each one twice). It only goes out for an event about an order of
  // ours: a payment event after the provider confirmed it, any other event
  // once its order was found.
  const avisarFinanceiro = () => {
    void emVoo('webhook-financeiro', () => encaminharWebhookFinanceiro(supabase, payload, raw, pedidoId, chargeId))
  }

  // Only payment events are processed. Woovi sends OPENPIX:CHARGE_COMPLETED
  // when a charge is paid. The event type and status only select which events
  // are worth confirming below; they are never the confirmation.
  const eventoDePagamento = /completed|paid|pago/i.test(evt) || String(charge?.status || '').toUpperCase() === 'COMPLETED'
  if (!eventoDePagamento) {
    if (pedido) avisarFinanceiro()
    return { ok: true, ignored: evt }
  }
  if (!pedido) return { ok: true, semPedido: true }

  // The event located an order. Whether that order was paid is answered by
  // the provider, with our own credential (see the header comment).
  const confirmacao = await confirmarPagamento(supabase, pedido, charge?.correlationID)
  if (confirmacao === 'indeterminado') {
    // Could not ask: 503 without processing, so the provider resends. The
    // buyer's polling keeps covering the delivery in the meantime.
    console.warn(`[woovi] payment not confirmed, the provider did not answer; asking for a resend pedido=${pedido.id}`)
    throw createError({ statusCode: 503, message: 'pagamento nao confirmado' })
  }
  if (confirmacao !== 'pago') {
    // The provider answered and this order has no paid charge: acknowledge
    // without processing and without flagging the event as processed.
    console.warn(`[woovi] payment event ignored, the provider has no paid charge for the order pedido=${pedido.id}`)
    return { ok: true, naoConfirmado: true }
  }

  avisarFinanceiro()
  void emVoo('pagador-hash', () => gravarPagadorHash(supabase, pedido))
  await rastrearEmVoo('processar-pedido', () => processarPedidoPago(supabase, pedido))
  if (chargeId) await supabase.from('webhook_events').update({ processado: true }).eq('abacatepay_id', chargeId)
  return { ok: true }
})
