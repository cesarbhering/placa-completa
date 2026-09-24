import { chavesPublicas, verificarAssinatura } from '../../utils/woovi'

// Webhook da Woovi. Endpoint separado do da AbacatePay de proposito: o formato
// do payload e, principalmente, o jeito de provar quem mandou sao diferentes.
// Misturar os dois num handler so significaria um if no meio da unica parte do
// sistema onde errar deixa qualquer um confirmar pagamento.
//
// Aqui a assinatura e RSA-SHA256 com a chave PUBLICA da Woovi (header
// x-webhook-signature), e nao HMAC com segredo nosso. A diferenca importa: a
// assinatura por chave publica prova que quem mandou foi a Woovi; um HMAC
// provaria apenas que alguem conhece o nosso segredo.
export default defineEventHandler(async (event) => {
  const raw = String((await readRawBody(event)) || '')
  const assinatura = getRequestHeader(event, 'x-webhook-signature') || ''

  // Ping de validacao: ao registrar o webhook, a Woovi bate na URL e SO aceita o
  // registro se receber 200. Esse ping vem SEM assinatura (e as vezes com um
  // evento de teste). Responder 200 aqui e seguro porque confirmar pagamento
  // continua exigindo assinatura valida logo abaixo: um request sem assinatura
  // nao passa da linha do 401 nem toca em pedido nenhum. Sem este atalho, o
  // registro do webhook e recusado pra sempre (o ping levava 401).
  let payload: any = {}
  try { payload = JSON.parse(raw) } catch { /* corpo nao-JSON cai como vazio */ }
  const evtBruto = String(payload?.event || payload?.evento || '')
  if (!assinatura || /test|teste|ping|validation|validacao/i.test(evtBruto)) {
    return { ok: true, ping: true }
  }

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
    provider: 'woovi', event: evt, abacatepay_id: chargeId || pedidoId, payload,
  })

  // So pagamento confirmado interessa. A Woovi manda OPENPIX:CHARGE_COMPLETED
  // quando a cobranca e paga.
  const pago = /completed|paid|pago/i.test(evt) || String(charge?.status || '').toUpperCase() === 'COMPLETED'
  if (!pago) return { ok: true, ignored: evt }

  let pedido: any = null
  if (pedidoId) ({ data: pedido } = await supabase.from('pedidos_premium').select('*').eq('id', pedidoId).maybeSingle())
  if (!pedido && chargeId) ({ data: pedido } = await supabase.from('pedidos_premium').select('*').eq('abacatepay_id', chargeId).maybeSingle())
  if (!pedido) return { ok: true, semPedido: true }

  await processarPedidoPago(supabase, pedido)
  if (chargeId) await supabase.from('webhook_events').update({ processado: true }).eq('abacatepay_id', chargeId)
  return { ok: true }
})
