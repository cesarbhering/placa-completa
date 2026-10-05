import { cupomRecompraDoPedido } from '../../utils/cupom-recompra'

// Busca LEVE do cupom de recompra pelo token do relatorio. O cupom nasce uns
// segundos depois da entrega; o relatorio repete esta chamada (5 s, ate 1 min)
// em vez de recarregar o relatorio inteiro. Devolve so codigo e validade.
export default defineEventHandler(async (event) => {
  const token = String(getQuery(event).token || '')
  if (!token || token.length > 64) throw createError({ statusCode: 400, message: 'token obrigatorio' })
  setHeader(event, 'Cache-Control', 'no-store')
  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('id,status')
    .eq('token_entrega', token)
    .maybeSingle()
  if (!pedido || pedido.status !== 'entregue') return { cupomRecompra: null }
  return { cupomRecompra: await cupomRecompraDoPedido(supabase, pedido.id) }
})
