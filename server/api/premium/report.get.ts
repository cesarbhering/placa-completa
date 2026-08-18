import { filtrarPorPlano, camposRestantes } from '../../../shared/planos'

// Dados do relatorio premium pelo token (superficie PAGA, token e a credencial).
// O corte por plano acontece AQUI, no servidor: o que a basica nao comprou nunca
// chega ao cliente. Borrar no CSS deixaria o dado no DOM.
export default defineEventHandler(async (event) => {
  const { token } = getQuery(event)
  if (!token) throw createError({ statusCode: 400, message: 'token obrigatorio' })
  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('status,placa,plano,preview,consulta_id,entregue_em,criado_em,br_code,expira_em')
    .eq('token_entrega', String(token))
    .single()
  if (!pedido) throw createError({ statusCode: 404, message: 'Relatorio nao encontrado' })

  // pedido ainda nao pago: devolve o copia-e-cola pra retomar o pagamento
  // (o "Concluir" do historico local cai aqui). Nao roda consulta nenhuma.
  const pendente = pedido.status === 'aguardando_pagamento'
  const expirado = pendente && pedido.expira_em ? new Date(pedido.expira_em).getTime() < Date.now() : false

  const plano = pedido.plano || 'completa'

  let consulta: any = null
  let restantes = 0
  if (pedido.consulta_id) {
    const { data } = await supabase
      .from('senatran_consultas')
      .select('response,placa,created_at')
      .eq('id', pedido.consulta_id)
      .single()
    if (data) {
      restantes = camposRestantes(data.response, plano)
      consulta = { ...data, response: filtrarPorPlano(data.response, plano) }
    }
  }
  return {
    status: pedido.status,
    placa: pedido.placa,
    plano,
    // quantos campos a completa ainda entregaria alem deste plano (upsell)
    camposRestantes: restantes,
    preview: pedido.preview,
    entregue_em: pedido.entregue_em,
    consulta,
    brCode: pendente && !expirado ? pedido.br_code : null,
    expiraEm: pendente ? pedido.expira_em : null,
    expirado,
  }
})
