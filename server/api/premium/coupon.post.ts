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
  // E-mail e opcional aqui: sem ele a validacao pula so o limite por cliente
  // (o resto — existe, ativo, vigente, plano, limite global — continua valendo).
  // Quem cobra de verdade e o checkout.post.ts, que revalida com o e-mail.

  const supabase = usePremiumSupabase()
  // A placa vem junto porque o cupom de recuperacao e preso a ela: sem isso, a
  // validacao previa diria "invalido" pra um cupom que vai funcionar no
  // checkout, ou o contrario.
  const placa = String(body.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  const resultado = await validarCupom(supabase, codigo, plano, email || undefined, placa || undefined)
  return resultado
})
