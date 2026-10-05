import { chavesPublicas, verificarAssinatura } from '../../utils/woovi'
import { gravarPagadorHash, sanearPayloadWebhook } from '../../utils/pagador-hash'

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
export default defineEventHandler(async (event) => {
  // Handshake de validacao (GET/HEAD): nao carrega pagamento, 200 fixo.
  if (event.method !== 'POST') return { ok: true, ping: true }

  const raw = String((await readRawBody(event)) || '')
  const assinatura = getRequestHeader(event, 'x-webhook-signature') || ''

  let payload: any = {}
  try { payload = JSON.parse(raw) } catch { /* corpo nao-JSON cai como vazio */ }
  const evtBruto = String(payload?.event || payload?.evento || '')

  // Ping de validacao via POST: sem assinatura, ou evento de teste. Responder
  // 200 aqui e seguro porque confirmar pagamento continua exigindo assinatura
  // valida logo abaixo; um request sem assinatura nao passa do 401 nem toca em
  // pedido nenhum.
  if (!assinatura || /test|teste|ping|validation|validacao/i.test(evtBruto)) {
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
  const pedidoId = String(charge?.correlationID || '')
  const chargeId = String(charge?.identifier || '')

  const supabase = usePremiumSupabase()
  // Mesma tabela de sempre, pra auditoria e idempotencia ficarem num lugar so.
  await supabase.from('webhook_events').insert({
    // Sem dados do pagador (CPF/nome) no log de auditoria.
    provider: 'woovi', event: evt, abacatepay_id: chargeId || pedidoId, payload: sanearPayloadWebhook(payload),
  })

  // So pagamento confirmado interessa. A Woovi manda OPENPIX:CHARGE_COMPLETED
  // quando a cobranca e paga.
  const pago = /completed|paid|pago/i.test(evt) || String(charge?.status || '').toUpperCase() === 'COMPLETED'
  if (!pago) return { ok: true, ignored: evt }

  let pedido: any = null
  if (pedidoId) ({ data: pedido } = await supabase.from('pedidos_premium').select('*').eq('id', pedidoId).maybeSingle())
  if (!pedido && chargeId) ({ data: pedido } = await supabase.from('pedidos_premium').select('*').eq('abacatepay_id', chargeId).maybeSingle())
  if (!pedido) return { ok: true, semPedido: true }

  void gravarPagadorHash(supabase, pedido)
  await processarPedidoPago(supabase, pedido)
  if (chargeId) await supabase.from('webhook_events').update({ processado: true }).eq('abacatepay_id', chargeId)
  return { ok: true }
})
