import { ambienteDaConsultaPaga } from '../../utils/gcc-reserva'
import { origemDoCupom, cupomDispensaEmail } from '../../utils/cupom-recompra'
import { sanearSinalRecall, sanearMarcaRecall } from '../../../shared/eventos-funil'
import crypto from 'node:crypto'
import { sanearOrigem } from '../../../shared/origem-trafego'
import { PLANOS, isPlanoPago } from '../../../shared/planos'

// Cartao v2 EMBUTIDO (Stripe Elements, sem redirect). Cria o pedido
// (forma_pagamento='cartao') + um PaymentIntent e devolve o client_secret pro
// front confirmar (confirmCardPayment, com 3DS quando o banco pedir). A entrega
// e a mesma do Pix: o pagamento (webhook payment_intent.succeeded OU o polling
// do /status) dispara processarPedidoPago.
//
// Guarda o pi_ do PaymentIntent em stripe_session_id (mesma coluna do v1; o
// status.get e o refund reconhecem pi_ vs cs_). Sem caminho gratis: cupom que
// zera o preco e do Pix (cobranca R$0 nao existe no cartao).
export default defineEventHandler(async (event) => {
  assertPremiumGate(event)
  if (!stripeConfigurado()) throw createError({ statusCode: 503, message: 'Cartao indisponivel no momento' })

  const body = await readBody(event)
  const placa = String(body.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  const email = String(body.email || '').trim().toLowerCase()
  const telefone = String(body.telefone || '').replace(/\D/g, '') || null
  const config = useRuntimeConfig()
  // Fora do homolog sempre 'producao'; no homolog, 'producao' so com a env
  // NUXT_HOMOLOG_GCC_PRODUCAO=on (ver ambienteDaConsultaPaga).
  const ambiente = ambienteDaConsultaPaga(body.ambiente, config)

  if (placa.length < 7) throw createError({ statusCode: 400, message: 'Placa invalida' })
  if (email && !email.includes('@')) throw createError({ statusCode: 400, message: 'E-mail invalido' })
  // Cupom exige e-mail (limite por pessoa / cupom pessoal), menos o de
  // recompra, que vale pra qualquer um (server/utils/cupom-recompra.ts).
  if (!email && String(body.cupom || '').trim() && !(await cupomDispensaEmail(usePremiumSupabase(), String(body.cupom)))) {
    throw createError({ statusCode: 400, message: 'Informe o e-mail para usar um cupom.' })
  }

  const plano = isPlanoPago(body.plano) ? body.plano : 'completa'
  const abBloco = body.ab_bloco === 'A' || body.ab_bloco === 'A2' ? body.ab_bloco : null

  const supabase = usePremiumSupabase()
  const token = crypto.randomBytes(18).toString('base64url')

  // Cupom recalculado no servidor. Cartao nao tem caminho gratis: cupom que zera
  // cai pro Pix.
  const codigoCupom = String(body.cupom || '').trim()
  const cupomValidado = codigoCupom ? await validarCupom(supabase, codigoCupom, plano, email) : null
  const zeraPreco = !!(cupomValidado?.ok && cupomValidado.precoLiquidoCentavos === 0)
  const aplicaCupom = !!(cupomValidado?.ok && !zeraPreco)
  const valor = aplicaCupom ? cupomValidado!.precoLiquidoCentavos : PLANOS[plano].valorCentavos

  // Stripe recusa cobranca abaixo do minimo (~R$0,50). Nunca deve acontecer com
  // a completa; barra aqui se um cupom parcial derrubar muito.
  if (!Number.isFinite(valor) || valor < 100) {
    throw createError({ statusCode: 400, message: 'Valor invalido para pagamento com cartao. Use o Pix.' })
  }

  const { data: pedido, error } = await supabase
    .from('pedidos_premium')
    .insert({
      token_entrega: token, placa, placa_confirmada: true, email: email || null, telefone,
      forma_pagamento: 'cartao',
      status: 'aguardando_pagamento', valor_centavos: valor, plano,
      preview: body.preview || null,
      ambiente,
      ab_bloco: abBloco,
      // Hook de recall que a pessoa viu na consulta gratis (allowlist) + marca.
      recall_sinal: sanearSinalRecall(body.recall_sinal),
      recall_marca: sanearMarcaRecall(body.recall_marca),
      ip_address: getClientIp(event),
      ...getDispositivo(event),
      ...sanearOrigem(body.origin),
      // Cupom de recompra: marca a venda e qual pedido gerou o codigo.
      ...origemDoCupom(cupomValidado),
    })
    .select()
    .single()
  if (error || !pedido) throw createError({ statusCode: 500, message: 'Falha ao criar pedido' })

  if (aplicaCupom && cupomValidado?.cupomId) {
    await registrarUsoCupom(supabase, {
      cupomId: cupomValidado.cupomId,
      pedidoId: pedido.id,
      email,
      precoBrutoCentavos: cupomValidado.precoBrutoCentavos,
      descontoCentavos: cupomValidado.descontoCentavos,
      precoLiquidoCentavos: valor,
    })
  }

  const pi = await criarPaymentIntent({
    pedidoId: pedido.id,
    tokenEntrega: token,
    plano,
    nome: PLANOS[plano].nome,
    valorCentavos: valor,
    email: email || null,
  })

  await supabase
    .from('pedidos_premium')
    .update({ stripe_session_id: pi.id })
    .eq('id', pedido.id)

  return {
    token, plano, valor,
    clientSecret: pi.client_secret,
    cupomAplicado: aplicaCupom ? { descontoCentavos: cupomValidado!.descontoCentavos } : null,
  }
})
