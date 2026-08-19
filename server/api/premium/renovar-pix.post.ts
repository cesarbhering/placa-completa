// Gera um Pix novo para um pedido que ainda nao foi pago e cujo QR venceu.
//
// Antes, o beco sem saida: o Pix expirava e a tela so oferecia "fazer nova
// consulta", jogando fora um pedido que ja tem placa, plano e e-mail
// confirmados. O provedor nao cobra por QR gerado, entao renovar sai de graca.
//
// A credencial e o token de entrega, igual ao /report: quem tem o link e dono
// do pedido. Nao usa o gate de senha porque o link chega por e-mail, fora da
// sessao que passou pelo gate.
export default defineEventHandler(async (event) => {
  const { token } = await readBody(event)
  if (!token) throw createError({ statusCode: 400, message: 'token obrigatorio' })

  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('id,status,valor_centavos,expira_em')
    .eq('token_entrega', String(token))
    .single()
  if (!pedido) throw createError({ statusCode: 404, message: 'Pedido nao encontrado' })

  // So pedido pendente. Qualquer outro status significa que ja houve cobranca:
  // gerar Pix ali seria oferecer um segundo pagamento pelo mesmo relatorio.
  if (pedido.status !== 'aguardando_pagamento') {
    throw createError({ statusCode: 409, message: 'Este pedido nao esta aguardando pagamento.' })
  }

  // E so quando o atual ja venceu. Sem isso, cada carregamento da tela poderia
  // disparar uma cobranca nova enquanto a anterior ainda vale.
  const vencido = !pedido.expira_em || new Date(pedido.expira_em).getTime() < Date.now()
  if (!vencido) {
    throw createError({ statusCode: 409, message: 'O pagamento atual ainda esta valido.' })
  }

  const pix = await criarPixTransparente({
    amountCentavos: pedido.valor_centavos,
    pedidoId: pedido.id,
    expiresIn: 900,
  })
  await supabase
    .from('pedidos_premium')
    .update({ abacatepay_id: pix.id, br_code: pix.brCode, expira_em: pix.expiresAt })
    .eq('id', pedido.id)

  return { brCode: pix.brCode, brCodeBase64: pix.brCodeBase64, expiresAt: pix.expiresAt }
})
