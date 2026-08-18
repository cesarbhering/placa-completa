// Dados do relatorio premium pelo token (superficie PAGA, token e a credencial).
export default defineEventHandler(async (event) => {
  const { token } = getQuery(event)
  if (!token) throw createError({ statusCode: 400, message: 'token obrigatorio' })
  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('status,placa,preview,consulta_id,entregue_em,criado_em,br_code,expira_em')
    .eq('token_entrega', String(token))
    .single()
  if (!pedido) throw createError({ statusCode: 404, message: 'Relatorio nao encontrado' })

  // pedido ainda nao pago: devolve o copia-e-cola pra retomar o pagamento
  // (o "Concluir" do historico local cai aqui). Nao roda consulta nenhuma.
  const pendente = pedido.status === 'aguardando_pagamento'
  const expirado = pendente && pedido.expira_em ? new Date(pedido.expira_em).getTime() < Date.now() : false

  let consulta: any = null
  if (pedido.consulta_id) {
    const { data } = await supabase
      .from('senatran_consultas')
      .select('response,placa,created_at')
      .eq('id', pedido.consulta_id)
      .single()
    consulta = data
  }
  return {
    status: pedido.status,
    placa: pedido.placa,
    preview: pedido.preview,
    entregue_em: pedido.entregue_em,
    consulta,
    brCode: pendente && !expirado ? pedido.br_code : null,
    expiraEm: pendente ? pedido.expira_em : null,
    expirado,
  }
})
