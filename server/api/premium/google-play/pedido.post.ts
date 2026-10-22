import { gravarEmailNaCompra, localizarPedidoPlay, purchaseTokenValido, responderPedidoPlay } from '../../../utils/google-play-pedido'
import { gravarEmailTardio } from '../../../utils/entrega-tardia-envio'

// POST /api/premium/google-play/pedido { purchaseToken, email }
//
// Mesmo contrato do GET, e de quebra entrega o e-mail que o app tem e o
// servidor nao: pedido criado pela notificacao da Play nasce sem e-mail.
// - Pedido sem e-mail: grava e, se o relatorio ja existe, envia agora (mesma
//   regra da tela do Pix, server/utils/entrega-tardia-envio.ts).
// - Compra ainda sem pedido: guarda na compra; o pedido nasce com ele e a
//   entrega normal manda o e-mail.
// Idempotente: e-mail ja gravado nunca e trocado nem reenviado.
export default defineEventHandler(async (event) => {
  assertPremiumGate(event)
  const body = await readBody(event)
  const purchaseToken = purchaseTokenValido(body?.purchaseToken)
  if (!purchaseToken) throw createError({ statusCode: 400, message: 'Compra sem comprovante.' })
  const email = String(body?.email || '').trim().toLowerCase()
  if (email && (!email.includes('@') || email.length > 200)) throw createError({ statusCode: 400, message: 'Informe um e-mail válido.' })

  const supabase = usePremiumSupabase()
  const achado = await localizarPedidoPlay(supabase, purchaseToken)
  let emailGravado = false
  if (email && achado?.tipo === 'pedido') {
    emailGravado = (await gravarEmailTardio(supabase, achado.token_entrega, email, '/premium/google-play/pedido')).gravado
  } else if (email && achado?.tipo === 'pendente') {
    emailGravado = await gravarEmailNaCompra(supabase, achado.compraId, email)
  }
  return { ...responderPedidoPlay(event, achado), ...(email ? { email_gravado: emailGravado } : {}) }
})
