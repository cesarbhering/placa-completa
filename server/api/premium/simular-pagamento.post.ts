// Simula o pagamento de um pedido (SO em homologacao/dev). Atalho de teste pra
// nao precisar pagar um Pix real: chama o simulate-payment da AbacatePay com o
// id da cobranca do pedido. Depois disso o poll de /status detecta "pago" e
// dispara a consulta normalmente.
export default defineEventHandler(async (event) => {
  assertPremiumGate(event)
  const config = useRuntimeConfig()

  // Trava dura: so opera com chave dev da AbacatePay. Com chave de producao
  // (Pix real) simular pagamento nao faz sentido e nem e suportado.
  if (!String(config.abacatepayApiKey || '').startsWith('abc_dev_')) {
    throw createError({ statusCode: 403, message: 'Simulacao indisponivel neste ambiente.' })
  }

  const { token } = await readBody(event)
  if (!token) throw createError({ statusCode: 400, message: 'token obrigatorio' })

  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('id, abacatepay_id, pix_provider, status')
    .eq('token_entrega', String(token))
    .single()
  if (!pedido) throw createError({ statusCode: 404, message: 'Pedido nao encontrado' })
  if (!pedido.abacatepay_id) throw createError({ statusCode: 409, message: 'Pedido sem cobranca gerada' })

  const ok = await provedorDoPedido((pedido as any).pix_provider).simularPagamento(pedido.abacatepay_id)
  if (!ok) throw createError({ statusCode: 502, message: 'Falha ao simular pagamento' })
  return { ok: true }
})
