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
  const resultado = await validarCupom(supabase, codigo, plano, email || undefined)
  // Origem e pedido que gerou o cupom de recompra sao internos: quem recebeu o
  // codigo compartilhado nao precisa (nem deve) ver o id do pedido de outra pessoa.
  const { origem, pedidoOrigemId: _p, ...publico } = resultado
  // So o fato de que este cupom vale sem e-mail (recompra) vai pro navegador.
  return { ...publico, dispensaEmail: origem === 'recompra' }
})
