import { sanearOrigemCheckout } from '../../../shared/origem-checkout'
import { ambienteDaConsultaPaga } from '../../utils/gcc-reserva'
import { origemDoCupom, cupomDispensaEmail } from '../../utils/cupom-recompra'
import { sanearSinalRecall, sanearMarcaRecall } from '../../../shared/eventos-funil'
import crypto from 'node:crypto'
import { sanearOrigem, opprefDoPedido, COOKIE_OPPREF } from '../../../shared/origem-trafego'
import { PLANOS, isPlanoPago } from '../../../shared/planos'

// Checkout com CARTAO (Stripe). Secundario: o Pix (checkout.post.ts) segue
// principal. Cria o pedido (forma_pagamento='cartao') + a Checkout Session
// hospedada do Stripe e devolve a URL pra redirecionar. A entrega e igual a do
// Pix: o pagamento (via webhook OU polling do /status) dispara processarPedidoPago,
// e a pessoa volta pra /premium/<token>, que polla ate o relatorio ficar pronto.
//
// v1 = a vista. Cupom parcial funciona; cupom que zera o preco (gratis) NAO vai
// pro cartao (cobranca de R$0 nao existe no Stripe) — esse caso e do Pix.
export default defineEventHandler(async (event) => {
  assertPremiumGate(event)
  if (!stripeConfigurado()) throw createError({ statusCode: 503, message: 'Cartao indisponivel no momento' })

  const body = await readBody(event)
  const placa = String(body.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  const email = String(body.email || '').trim().toLowerCase()
  const telefone = String(body.telefone || '').replace(/\D/g, '') || null
  const config = useRuntimeConfig()
  // Mesma regra do Pix: so o build de homolog deixa escolher o ambiente das
  // consultas; em prod/staging forca 'producao'.
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

  // Cupom RECALCULADO no servidor (nunca confia no preco do client), igual ao
  // Pix. Diferenca: aqui o caminho gratis nao existe. Se o cupom zerar o preco,
  // ignoramos o desconto de 100% e cobramos cheio no cartao — quem quer o gratis
  // usa o Pix, que sabe entregar sem cobranca.
  const codigoCupom = String(body.cupom || '').trim()
  const cupomValidado = codigoCupom ? await validarCupom(supabase, codigoCupom, plano, email) : null
  const zeraPreco = !!(cupomValidado?.ok && cupomValidado.precoLiquidoCentavos === 0)
  const aplicaCupom = !!(cupomValidado?.ok && !zeraPreco)
  const valor = aplicaCupom ? cupomValidado!.precoLiquidoCentavos : PLANOS[plano].valorCentavos

  // Guarda-corpo: Stripe recusa cobranca abaixo do minimo (~R$0,50 em BRL).
  // Nunca deve acontecer com a completa (R$45), mas se um cupom parcial derrubar
  // muito, melhor barrar aqui do que a Stripe estourar depois.
  if (!Number.isFinite(valor) || valor < 100) {
    throw createError({ statusCode: 400, message: 'Valor invalido para pagamento com cartao. Use o Pix.' })
  }

  const { data: pedido, error } = await supabase
    .from('pedidos_premium')
    .insert({
      token_entrega: token, placa, placa_confirmada: true,
      // Botao que abriu o checkout (shared/origem-checkout.ts); fora do enum = null.
      origem_checkout: sanearOrigemCheckout(body.origem_checkout), email: email || null, telefone,
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
      // Sem oppref na sessao, vale o do cookie __oppref do SDK oaiq (30 dias).
      ...opprefDoPedido(sanearOrigem(body.origin), getCookie(event, COOKIE_OPPREF)),
      // Cupom de recompra: marca a venda e qual pedido gerou o codigo.
      ...origemDoCupom(cupomValidado),
    })
    .select()
    .single()
  if (error || !pedido) throw createError({ statusCode: 500, message: 'Falha ao criar pedido' })

  // Uso do cupom (parcial): so registra depois que o pedido existe. Fail-open.
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

  // URLs de retorno, sempre no proprio dominio. success = a pagina do relatorio,
  // que polla o /status ate a entrega (o polling detecta o pagamento sem depender
  // do webhook). cancel = de onde a pessoa veio, se for do mesmo dominio; senao a raiz.
  const base = String(config.premiumBaseUrl || 'https://placacompleta.com.br').replace(/\/+$/, '')
  const successUrl = `${base}/premium/${token}?cartao=1`
  const cancelUrl = origemMesmoDominio(body.retornoUrl, base) || `${base}/`

  const sessao = await criarStripeSession({
    pedidoId: pedido.id,
    tokenEntrega: token,
    plano,
    nome: PLANOS[plano].nome,
    valorCentavos: valor,
    email: email || null,
    successUrl,
    cancelUrl,
  })

  await supabase
    .from('pedidos_premium')
    .update({ stripe_session_id: sessao.id })
    .eq('id', pedido.id)

  return {
    token, plano, valor, url: sessao.url,
    cupomAplicado: aplicaCupom ? { descontoCentavos: cupomValidado!.descontoCentavos } : null,
  }
})

// So aceita uma URL de retorno se ela for do proprio dominio (evita open-redirect
// via cancel_url). Devolve a URL sanitizada ou null.
function origemMesmoDominio(url: unknown, base: string): string | null {
  const s = String(url || '').trim()
  if (!s) return null
  try {
    const u = new URL(s)
    const b = new URL(base)
    return u.origin === b.origin ? u.toString() : null
  } catch {
    return null
  }
}
