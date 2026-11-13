import { emVoo, rastrearEmVoo } from '../../utils/tarefas-em-voo'
import { chavesPublicas, verificarAssinatura, pedidoDaCorrelacao } from '../../utils/woovi'
import { gravarPagadorHash, sanearPayloadWebhook } from '../../utils/pagador-hash'
import { lerPayloadWoovi, ehPingWoovi } from '../../utils/woovi-webhook-payload'
import { encaminharWebhookFinanceiro } from '../../utils/woovi-financeiro'
import { avisarEventoEstranhoWoovi } from '../../utils/alerta-evento-woovi'
import { confirmarPagamentoDoPedido, conferirCobrancaDoEvento, reapontarPedido, type CobrancaDoEvento } from '../../utils/confirmar-pagamento'

// Upper bound for everything that is asked to the providers about one event: a
// provider API that hangs must not hold the webhook open. Past it the answer
// is 503 and the provider resends.
const TETO_CONFIRMACAO_MS = 10_000

/**
 * Waits for a lookup until `prazo` (a timestamp). If it is not done by then,
 * or if it throws, the result is `semResposta`: never "yes", never "no".
 */
async function ate<T>(prazo: number, consulta: Promise<T>, semResposta: T): Promise<T> {
  let relogio: ReturnType<typeof setTimeout> | undefined
  const teto = new Promise<T>((resolve) => {
    relogio = setTimeout(() => resolve(semResposta), Math.max(0, prazo - Date.now()))
  })
  try {
    return await Promise.race([consulta, teto])
  } catch {
    return semResposta
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
// What a signed event says is checked with the provider, with our own
// credential, before anything is done with it (server/utils/confirmar-pagamento.ts).
// The charge the event names is looked up in our account by its correlationID:
// it has to belong to the order and to be the very charge the event carries.
// Nothing in the event body counts as proof; the correlationID and the
// identifier are search keys.
//
// For a payment event:
// - the charge is ours, of the order, and paid: the order is processed, finance
//   gets its copy and the event is flagged as processed;
// - the charge is ours and of the order but does not show as paid yet, or the
//   provider cannot be asked: 503, so the provider resends;
// - the charge is not ours: 200, and the team is told.
// An order that turns out to be paid on another charge of its own is still
// processed, but the event stays unverified: no copy, no flag.
//
// Every event with a valid signature is stored in webhook_events. An event
// that carries no charge goes to finance marked as not verified and is never a
// payment of an order.
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

  const evt = String(payload?.event || '')
  const charge = payload?.charge && typeof payload.charge === 'object' ? payload.charge : null
  // correlationID e o id do nosso pedido: foi o que mandamos na criacao.
  // Renovacao usa `<pedido>-r<sufixo>`: tira o sufixo pra achar o pedido.
  const pedidoId = typeof charge?.correlationID === 'string' ? pedidoDaCorrelacao(charge.correlationID) : ''
  const chargeId = typeof charge?.identifier === 'string' ? charge.identifier : ''

  const supabase = usePremiumSupabase()
  // Every event with a valid signature is stored, whatever happens next: this
  // is the audit trail. The row carries no payer data (name, CPF).
  await supabase.from('webhook_events').insert({
    provider: 'woovi', event: evt, abacatepay_id: chargeId || pedidoId, payload: sanearPayloadWebhook(payload),
  })

  // An event without a charge (a Pix received outside a charge, for example)
  // cannot be checked against our account and is not about an order. Finance
  // still gets its copy, marked as not verified. Without await: the copy never
  // delays the answer.
  if (!charge) {
    void emVoo('webhook-financeiro', () => encaminharWebhookFinanceiro(supabase, payload, raw, '', '', { naoVerificado: true }))
    return { ok: true, ignored: evt }
  }

  // Woovi sends OPENPIX:CHARGE_COMPLETED when a charge is paid. The event type
  // and status only tell what the event claims; they are never the
  // confirmation.
  const eventoDePagamento = /completed|paid|pago/i.test(evt) || String(charge.status || '').toUpperCase() === 'COMPLETED'

  // The order this event is about, when it is one of ours.
  let pedido: any = null
  if (pedidoId) ({ data: pedido } = await supabase.from('pedidos_premium').select('*').eq('id', pedidoId).maybeSingle())
  if (!pedido && chargeId) ({ data: pedido } = await supabase.from('pedidos_premium').select('*').eq('abacatepay_id', chargeId).maybeSingle())
  if (!pedido) return eventoDePagamento ? { ok: true, semPedido: true } : { ok: true, ignored: evt }

  // What our account says about the charge this event names.
  const prazo = Date.now() + TETO_CONFIRMACAO_MS
  const cobranca = await ate<CobrancaDoEvento>(
    prazo,
    conferirCobrancaDoEvento(pedido, { correlationID: charge.correlationID, identifier: charge.identifier }),
    { situacao: 'sem_resposta' },
  )

  // FULL copy to financeiro@ (reconciliation, invoices), without await: it
  // never delays the answer nor the order. Deduplicated per event (Woovi
  // delivers each one twice). It only goes out once the charge of the event
  // was checked.
  const copiarProFinanceiro = () => {
    void emVoo('webhook-financeiro', () => encaminharWebhookFinanceiro(supabase, payload, raw, pedidoId, chargeId))
  }

  if (!eventoDePagamento) {
    if (cobranca.situacao === 'sem_resposta') throw createError({ statusCode: 503, message: 'evento nao conferido' })
    if (cobranca.situacao === 'nossa') copiarProFinanceiro()
    return { ok: true, ignored: evt }
  }

  if (cobranca.situacao === 'nossa' && cobranca.paga) {
    try {
      await reapontarPedido(supabase, pedido, cobranca.identifier)
    } catch {
      console.warn(`[woovi] confirmed payment could not be recorded on the order; asking for a resend pedido=${pedido.id}`)
      throw createError({ statusCode: 503, message: 'pagamento nao gravado' })
    }
    copiarProFinanceiro()
    void emVoo('pagador-hash', () => gravarPagadorHash(supabase, pedido))
    await rastrearEmVoo('processar-pedido', () => processarPedidoPago(supabase, pedido))
    // Flagged by the identifier the provider returned for the charge.
    await supabase.from('webhook_events').update({ processado: true }).eq('abacatepay_id', cobranca.identifier)
    return { ok: true }
  }

  // The charge of the event is not confirmed. The order may still be paid on
  // another charge of its own (the recorded one, the original): a real payment
  // is never lost, so the order is processed. The event itself stays
  // unverified: no copy to finance, no processed flag. The processing is not
  // awaited: the answer below is about the event.
  const doPedido = await ate(prazo, confirmarPagamentoDoPedido(supabase, pedido, { falhaContaComoSemResposta: true }), 'indeterminado' as const)
  if (doPedido === 'pago') {
    void emVoo('pagador-hash', () => gravarPagadorHash(supabase, pedido))
    rastrearEmVoo('processar-pedido', () => processarPedidoPago(supabase, pedido)).catch(() => {})
  }

  if (cobranca.situacao === 'estranha') {
    // Not a charge of ours for this order. A genuine event never gets here, so
    // the team is told (one alert per correlationID per hour). There is
    // nothing to resend.
    const motivo = cobranca.motivo
    void emVoo('alerta-evento-woovi', () => avisarEventoEstranhoWoovi({ evento: evt, correlationID: String(charge.correlationID ?? ''), pedidoId: pedido.id, motivo }))
    console.warn(`[woovi] payment event about a charge that is not ours for the order (${motivo}); nothing done for it pedido=${pedido.id}`)
    return { ok: true, naoConfirmado: true }
  }

  // Ours but not shown as paid yet (the provider may be behind), or the
  // provider could not be asked: 503, so the provider resends. The buyer's
  // polling keeps covering the delivery in the meantime.
  const porque = cobranca.situacao === 'nossa' ? 'the charge does not show as paid yet' : 'the provider did not answer'
  console.warn(`[woovi] payment event not confirmed, ${porque}; asking for a resend pedido=${pedido.id}`)
  throw createError({ statusCode: 503, message: 'pagamento nao confirmado' })
})
