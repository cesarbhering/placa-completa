import { cupomBumpDoPedido } from '../../utils/cupom-bump'

// Oferta de segunda placa (pedido acoplado) pelo token do relatorio. Cria o
// cupom na primeira chamada (idempotente) e devolve so codigo, validade e
// preco. Nunca devolve o e-mail a que o cupom esta preso.
export default defineEventHandler(async (event) => {
  const token = String(getQuery(event).token || '')
  if (!token || token.length > 64) throw createError({ statusCode: 400, message: 'token obrigatorio' })
  setHeader(event, 'Cache-Control', 'no-store')
  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('id,status,email,valor_centavos,google_play_order_id,pix_provider,cupom_origem')
    .eq('token_entrega', token)
    .maybeSingle()
  if (!pedido) return { bump: null }
  return { bump: await cupomBumpDoPedido(supabase, pedido) }
})
