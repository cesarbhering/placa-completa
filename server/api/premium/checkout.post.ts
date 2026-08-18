import crypto from 'node:crypto'

// Cria o pedido (pending) + o Pix transparente. Retorna o QR/copia-e-cola.
// Minimo de dados: email (entrega) + telefone opcional. Gated.
export default defineEventHandler(async (event) => {
  assertPremiumGate(event)
  const body = await readBody(event)
  const placa = String(body.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  const email = String(body.email || '').trim().toLowerCase()
  const telefone = String(body.telefone || '').replace(/\D/g, '') || null
  if (placa.length < 7) throw createError({ statusCode: 400, message: 'Placa invalida' })
  if (!email || !email.includes('@')) throw createError({ statusCode: 400, message: 'Email obrigatorio' })

  const config = useRuntimeConfig()
  const supabase = usePremiumSupabase()
  const token = crypto.randomBytes(18).toString('base64url')
  const valor = parseInt(String(config.premiumValorCentavos), 10) || 4500

  const { data: pedido, error } = await supabase
    .from('pedidos_premium')
    .insert({
      token_entrega: token, placa, placa_confirmada: true, email, telefone,
      status: 'aguardando_pagamento', valor_centavos: valor, preview: body.preview || null,
    })
    .select()
    .single()
  if (error || !pedido) throw createError({ statusCode: 500, message: 'Falha ao criar pedido' })

  const pix = await criarPixTransparente({ amountCentavos: valor, pedidoId: pedido.id, expiresIn: 900 })
  await supabase
    .from('pedidos_premium')
    .update({ abacatepay_id: pix.id, br_code: pix.brCode, expira_em: pix.expiresAt })
    .eq('id', pedido.id)

  return { token, brCode: pix.brCode, brCodeBase64: pix.brCodeBase64, expiresAt: pix.expiresAt, valor }
})
