// Carrega a solicitacao de feedback pelo token da URL. O token E a credencial:
// nao pedimos e-mail nem nada de volta pra pessoa, ela so clica no link.
//
// Resposta enxuta de proposito. A pagina precisa saber o primeiro nome do
// veiculo (pra dizer de qual consulta estamos falando) e se ja foi respondida.
// E-mail e pedido_id NAO saem daqui: quem tiver o link nao precisa deles, e um
// link vazado nao vira vazamento de dado de cliente.
export default defineEventHandler(async (event) => {
  const token = String(getRouterParam(event, 'token') || '').trim()
  if (!tokenFeedbackPlausivel(token)) throw createError({ statusCode: 404, message: 'Link nao encontrado' })

  const supabase = usePremiumSupabase()
  const { data } = await supabase
    .from('feedback_solicitacoes')
    .select('placa,respondido_em,nota,comentario')
    .eq('token', token)
    .maybeSingle()

  if (!data) throw createError({ statusCode: 404, message: 'Link nao encontrado' })

  return {
    placa: data.placa || null,
    respondido: !!data.respondido_em,
    nota: data.nota ?? null,
  }
})
