// QR da cobranca ja existente, pra tela de retomada do pagamento.
//
// Sob demanda de proposito: o /report e carregado toda vez que alguem abre o
// relatorio, e chamar o provedor de pagamento ali deixaria a pagina refem de
// uma latencia externa que so interessa a quem ainda nao pagou.
//
// NAO cria cobranca nova: busca a que ja existe. Gerar outra duplicaria o
// pedido, o que e pior que a pessoa ficar so com o copia-e-cola.
//
// O token e a credencial, como no /report.
export default defineEventHandler(async (event) => {
  const { token } = getQuery(event)
  if (!token) throw createError({ statusCode: 400, message: 'token obrigatorio' })

  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('status,abacatepay_id,br_code,expira_em')
    .eq('token_entrega', String(token))
    .single()

  if (!pedido || pedido.status !== 'aguardando_pagamento' || !pedido.abacatepay_id) {
    return { brCode: null, brCodeBase64: null }
  }
  if (pedido.expira_em && new Date(pedido.expira_em).getTime() < Date.now()) {
    return { brCode: null, brCodeBase64: null }
  }

  const chk = await checarPix(pedido.abacatepay_id)
  return {
    // o copia-e-cola ja temos guardado; o QR so o provedor tem
    brCode: chk?.brCode || pedido.br_code || null,
    brCodeBase64: chk?.brCodeBase64 || null,
  }
})
