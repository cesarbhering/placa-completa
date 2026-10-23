import { gravarEmailTardio } from '../../utils/entrega-tardia-envio'

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

  const r = await gravarEmailTardio(usePremiumSupabase(), token, email, '/premium/email')
  // Pedido que ja tinha e-mail nao e erro pra quem esta na tela (ela ja vai
  // receber), entao so o pedido inexistente vira 404. A regra (so preenche o
  // que esta vazio, envia uma vez so) mora em server/utils/entrega-tardia-envio.ts.
  if (!r.existe) throw createError({ statusCode: 404, message: 'Pedido nao encontrado' })
  return { ok: true, gravado: r.gravado, enviadoAgora: r.enviadoAgora }
})
