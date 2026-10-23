import { localizarPedidoPlay, purchaseTokenValido, responderPedidoPlay } from '../../../utils/google-play-pedido'

// GET /api/premium/google-play/pedido?purchaseToken=...
//
// O app pergunta pelo comprovante que guardou e descobre o token de entrega,
// mesmo que a compra tenha sido concluida (e consumida) pelo servidor sem ele.
//   200 { token_entrega, status, placa }  pedido existe
//   202 { pendente: true }                compra registrada, pedido ainda nao
//   410 { cancelada: true }               compra recusada de vez (estorno/cancelada)
//   404                                   comprovante desconhecido
export default defineEventHandler(async (event) => {
  assertPremiumGate(event)
  const purchaseToken = purchaseTokenValido(getQuery(event).purchaseToken)
  if (!purchaseToken) throw createError({ statusCode: 400, message: 'Compra sem comprovante.' })
  return responderPedidoPlay(event, await localizarPedidoPlay(usePremiumSupabase(), purchaseToken))
})
