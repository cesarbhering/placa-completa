import { isPlanoPago } from '../../../shared/planos'

// Valida um cupom SEM aplicar nada (nao cria pedido, nao registra uso).
// Chamado no blur do input de cupom e de novo, silenciosamente, antes de
// pagar — o preco que aparece aqui e so pra exibicao; o checkout.post.ts
// recalcula tudo de novo antes de cobrar.
export default defineEventHandler(async (event) => {
  assertPremiumGate(event)
  const body = await readBody(event)
  const codigo = String(body.codigo || '')
  const plano = isPlanoPago(body.plano) ? body.plano : 'completa'
  const email = String(body.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, message: 'Email obrigatorio para validar cupom.' })
  }

  const supabase = usePremiumSupabase()
  const resultado = await validarCupom(supabase, codigo, plano, email)
  return resultado
})
