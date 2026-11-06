import { estadoFeedback } from '../../utils/feedback'

// Estado da solicitacao de feedback pelo token da URL (o token e a
// credencial). Resposta enxuta: placa, nota e se o comentario ja veio. E-mail
// e pedido_id nao saem daqui.
export default defineEventHandler(async (event) => {
  const token = String(getRouterParam(event, 'token') || '').trim()
  const e = await estadoFeedback(usePremiumSupabase(), token)
  if (!e.existe) throw createError({ statusCode: 404, message: 'Link nao encontrado' })
  return { placa: e.placa, nota: e.nota, comentarioEnviado: e.comentarioEnviado }
})
