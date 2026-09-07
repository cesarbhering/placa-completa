// Grava o e-mail de entrega de um pedido que ja existe. Nasceu porque o e-mail
// saiu da frente do Pix: agora ele e pedido na tela de pagamento, enquanto a
// pessoa paga, e chega aqui.
//
// O token de entrega e a credencial (mesma regra do relatorio): quem tem o
// token e quem esta com a tela do pedido aberta. Nao da pra descobrir o e-mail
// de ninguem por aqui, so gravar um.
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const token = String(body?.token || '').trim()
  const email = String(body?.email || '').trim().toLowerCase()

  if (!token || token.length < 8) throw createError({ statusCode: 404, message: 'Pedido nao encontrado' })
  if (!email.includes('@') || email.length > 200) {
    throw createError({ statusCode: 400, message: 'Informe um e-mail válido.' })
  }

  const supabase = usePremiumSupabase()

  // So preenche o que esta vazio. Trocar um e-mail ja gravado por outro seria
  // uma forma de desviar a entrega de um pedido alheio pra quem descobrisse o
  // token; quem digitou errado fala com o suporte.
  const { data } = await supabase
    .from('pedidos_premium')
    .update({ email })
    .eq('token_entrega', token)
    .is('email', null)
    .select('id')

  if (data?.length) return { ok: true, gravado: true }

  // Sem linha atualizada: ou o pedido nao existe, ou ja tinha e-mail. O
  // segundo caso nao e erro pra quem esta na tela (ela ja vai receber), entao
  // so o pedido inexistente vira 404.
  const { data: existe } = await supabase
    .from('pedidos_premium')
    .select('id')
    .eq('token_entrega', token)
    .maybeSingle()
  if (!existe) throw createError({ statusCode: 404, message: 'Pedido nao encontrado' })
  return { ok: true, gravado: false }
})
