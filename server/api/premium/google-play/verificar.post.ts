import { sanearOrigemCheckout } from '../../../../shared/origem-checkout'
import { ambienteDaConsultaPaga } from '../../../utils/gcc-reserva'
import crypto from 'node:crypto'
import { sanearOrigem } from '../../../../shared/origem-trafego'
import { PLANOS } from '../../../../shared/planos'
import { PRODUTO_COMPLETA, consultarCompra, consumirCompra } from '../../../utils/google-play'

// Compra feita dentro do app Android, cobrada pelo Google Play.
//
// O app nao tem Pix: quem cobra e a loja, e a unica coisa que ele consegue
// mandar pra ca e o purchaseToken. Este endpoint faz o que o webhook do Pix
// faz no site: confirma com quem recebeu o dinheiro, cria o pedido pago e
// dispara a entrega. Nada e entregue sem a Google confirmar.
//
// Idempotencia: o purchaseToken e unique no banco. Se o app reenviar (rede
// caiu, usuario reabriu a tela), a segunda chamada devolve o MESMO
// token_entrega em vez de cobrar de novo o SENATRAN e entregar duas vezes.
export default defineEventHandler(async (event) => {
  assertPremiumGate(event)
  const body = await readBody(event)
  const placa = String(body.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  const email = String(body.email || '').trim().toLowerCase()
  const purchaseToken = String(body.purchaseToken || '').trim()
  const orderId = String(body.orderId || '').trim() || null
  const productId = String(body.productId || '').trim()

  if (placa.length < 7) throw createError({ statusCode: 400, message: 'Placa invalida' })
  if (!purchaseToken) throw createError({ statusCode: 400, message: 'Compra sem comprovante.' })
  // Um unico produto existe no app. Aceitar outro id seria aceitar um preco
  // que nao e o nosso.
  if (productId !== PRODUTO_COMPLETA) throw createError({ statusCode: 400, message: 'Produto invalido.' })
  if (email && !email.includes('@')) throw createError({ statusCode: 400, message: 'E-mail invalido' })

  const supabase = usePremiumSupabase()

  // Reenvio do mesmo comprovante: devolve o pedido que ja existe.
  const { data: existente } = await supabase
    .from('pedidos_premium')
    .select('token_entrega')
    .eq('google_play_purchase_token', purchaseToken)
    .maybeSingle()
  if (existente?.token_entrega) return { token_entrega: existente.token_entrega, repetido: true }

  const compra = await consultarCompra(productId, purchaseToken)
  if (!compra.ok) {
    throw createError({ statusCode: 402, message: mensagemDeFalha(compra.motivo) })
  }

  // O ambiente das consultas segue a mesma regra do checkout Pix: so o build
  // de homolog deixa escolher, todo o resto e producao.
  const config = useRuntimeConfig()
  // Fora do homolog sempre 'producao'; no homolog, 'producao' so com a env
  // NUXT_HOMOLOG_GCC_PRODUCAO=on (ver ambienteDaConsultaPaga).
  const ambiente = ambienteDaConsultaPaga(body.ambiente, config)

  // Mesmo formato de token do checkout Pix: 18 bytes em base64url.
  const tokenEntrega = crypto.randomBytes(18).toString('base64url')
  const { data: pedido, error } = await supabase
    .from('pedidos_premium')
    .insert({
      token_entrega: tokenEntrega,
      placa,
      placa_confirmada: true,
      // Botao que abriu o checkout (shared/origem-checkout.ts); fora do enum = null.
      origem_checkout: sanearOrigemCheckout(body.origem_checkout),
      email: email || null,
      // Quem cobrou foi a loja. Guardar isso e o que impede o fluxo de estorno
      // de bater na porta da AbacatePay por uma compra que nunca passou por la.
      pix_provider: 'google_play',
      google_play_purchase_token: purchaseToken,
      google_play_order_id: orderId || compra.orderId,
      google_play_product_id: productId,
      // Preco de tabela, nunca o que o cliente mandou.
      status: 'pago',
      valor_centavos: PLANOS.completa.valorCentavos,
      plano: 'completa',
      preview: body.preview || null,
      ambiente,
      ip_address: getClientIp(event),
      ...getDispositivo(event),
      ...sanearOrigem(body.origin),
    })
    .select()
    .single()

  if (error || !pedido) {
    // Corrida entre dois envios do mesmo comprovante: o unique do banco barrou
    // o segundo. Isso e sucesso, nao erro — devolve o pedido que venceu.
    const { data: corrida } = await supabase
      .from('pedidos_premium')
      .select('token_entrega')
      .eq('google_play_purchase_token', purchaseToken)
      .maybeSingle()
    if (corrida?.token_entrega) return { token_entrega: corrida.token_entrega, repetido: true }
    throw createError({ statusCode: 500, message: 'Falha ao criar pedido' })
  }

  // Entrega em segundo plano (a tela acompanha por /api/premium/status, igual
  // ao Pix) e, quando ela termina, a compra e consumida pra pessoa poder
  // comprar outra placa. Consumir antes seria abrir mao do comprovante no meio
  // da entrega.
  processarPedidoPago(supabase, pedido)
    .catch(() => {})
    .finally(() => { consumirCompra(productId, purchaseToken).catch(() => {}) })

  return { token_entrega: tokenEntrega }
})

function mensagemDeFalha(motivo: string | null): string {
  if (motivo === 'pagamento pendente') return 'O Google ainda nao confirmou o pagamento. Assim que ele cair, abra o app de novo.'
  if (motivo === 'compra ja utilizada') return 'Esta compra ja foi usada em um relatorio.'
  if (motivo === 'compra cancelada') return 'Esta compra foi cancelada pelo Google.'
  if (motivo === 'compra nao encontrada') return 'Nao encontramos esta compra no Google Play.'
  return 'Nao conseguimos confirmar sua compra agora. Tente de novo em instantes.'
}

