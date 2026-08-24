import crypto from 'node:crypto'
import { PLANOS, isPlanoPago } from '../../../shared/planos'

// Cria o pedido (pending) + o Pix transparente. Retorna o QR/copia-e-cola.
// Minimo de dados: email (entrega) + telefone opcional. Gated.
// O plano ('basica' | 'completa') define o valor e, la na frente, quais campos
// do SENATRAN o relatorio libera.
export default defineEventHandler(async (event) => {
  assertPremiumGate(event)
  const body = await readBody(event)
  const placa = String(body.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  const email = String(body.email || '').trim().toLowerCase()
  const telefone = String(body.telefone || '').replace(/\D/g, '') || null
  // Ambiente das consultas (GCC/SERPRO). Explicito vindo do cliente vence
  // (dropdown do homolog manda 'homolog' ou 'producao'). Sem valor: staging
  // espelha prod, entao cai em 'producao'; homolog e o resto caem em 'homolog'.
  const config = useRuntimeConfig()
  const ambiente = body.ambiente === 'producao'
    ? 'producao'
    : body.ambiente === 'homolog'
      ? 'homolog'
      : config.public.staging ? 'producao' : 'homolog'
  if (placa.length < 7) throw createError({ statusCode: 400, message: 'Placa invalida' })
  if (!email || !email.includes('@')) throw createError({ statusCode: 400, message: 'Email obrigatorio' })

  // Plano vem do cliente, entao nunca confia no preco que ele mandar: o valor
  // sai da tabela do servidor. Default 'completa' preserva o comportamento de
  // quem chamar sem o campo (checkouts antigos em cache, por exemplo).
  const plano = isPlanoPago(body.plano) ? body.plano : 'completa'

  const supabase = usePremiumSupabase()
  const token = crypto.randomBytes(18).toString('base64url')
  // Preco sai SO da tabela. Antes a completa vinha de PREMIUM_VALOR_CENTAVOS,
  // o que abria a porta pra cobrar um valor e mostrar outro na tela (a tela le
  // a tabela). Fonte unica evita a divergencia.
  const valor = PLANOS[plano].valorCentavos

  const { data: pedido, error } = await supabase
    .from('pedidos_premium')
    .insert({
      token_entrega: token, placa, placa_confirmada: true, email, telefone,
      status: 'aguardando_pagamento', valor_centavos: valor, plano,
      preview: body.preview || null,
      ambiente,
      // IP do comprador: usado pra resetar o limite gratis por hora (uma compra
      // paga zera o contador do usuario, casado por IP ou email).
      ip_address: getClientIp(event),
    })
    .select()
    .single()
  if (error || !pedido) throw createError({ statusCode: 500, message: 'Falha ao criar pedido' })

  // Cliente na AbacatePay: registra quem comprou (rastreio no dashboard) e o id
  // fica guardado no pedido. Fail-open: se falhar, o checkout segue sem o id.
  const customerId = await criarOuObterCliente({ email, telefone })

  // Nome do plano vira a descricao da cobranca; plano+externalId no metadata
  // batem com o produto do catalogo (prod_...). O `customer` inline do
  // transparente exige name+taxId (que nao coletamos), entao amarramos o
  // cliente pelo customerId no metadata (rastreavel no dashboard).
  const pix = await criarPixTransparente({
    amountCentavos: valor,
    pedidoId: pedido.id,
    expiresIn: 900,
    descricao: PLANOS[plano].nome,
    metadata: { plano, externalId: `plano-${plano}`, ...(customerId ? { customerId } : {}) },
  })
  await supabase
    .from('pedidos_premium')
    .update({ abacatepay_id: pix.id, br_code: pix.brCode, expira_em: pix.expiresAt, abacatepay_customer_id: customerId })
    .eq('id', pedido.id)

  return { token, plano, brCode: pix.brCode, brCodeBase64: pix.brCodeBase64, expiresAt: pix.expiresAt, valor }
})
