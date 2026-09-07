// Grava a resposta da pesquisa. Uma vez so: a segunda tentativa nao sobrescreve
// a primeira, porque a nota que vale e a reacao de quem acabou de ler o
// relatorio, nao a de quem voltou no link depois pra trocar de ideia (e porque
// o cupom de 50% sai por resposta, e um link nao pode virar dois cupons).
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const token = String(body?.token || '').trim()
  if (!tokenFeedbackPlausivel(token)) throw createError({ statusCode: 404, message: 'Link nao encontrado' })

  const resposta = normalizarResposta(body)
  if ('erro' in resposta) throw createError({ statusCode: 400, message: resposta.erro })
  const { nota, comentario } = resposta

  const supabase = usePremiumSupabase()

  // A trava e o proprio update condicionado a respondido_em IS NULL, no banco:
  // dois cliques rapidos no botao chegam como duas requisicoes, e so uma pode
  // achar a linha em aberto. Conferir antes com um select deixaria a janela.
  const { data, error } = await supabase
    .from('feedback_solicitacoes')
    .update({ nota, comentario, respondido_em: new Date().toISOString() })
    .eq('token', token)
    .is('respondido_em', null)
    .select('id')

  if (error) throw createError({ statusCode: 500, message: 'Nao foi possivel salvar agora.' })

  if (!data?.length) {
    // Ou o link nao existe, ou ja foi respondido. Distinguir os dois casos e o
    // que a pessoa precisa: um e "link errado", o outro e "ja recebemos".
    const { data: existe } = await supabase
      .from('feedback_solicitacoes')
      .select('id')
      .eq('token', token)
      .maybeSingle()
    if (!existe) throw createError({ statusCode: 404, message: 'Link nao encontrado' })
    return { ok: true, jaRespondido: true }
  }

  // TODO (fase 2, depois do aval do Cesar na pagina): gerar aqui o cupom de 50%
  // preso a este e-mail com a mesma funcao do cupom de recuperacao
  //   select * from criar_cupom_recuperacao(<email>, 50, 168, 'feedback')
  // gravar em cupom_codigo/cupom_enviado_em e disparar o e-mail. Enquanto isso
  // nao existe, a tela nao promete prazo: diz que o cupom chega por e-mail.
  return { ok: true, jaRespondido: false }
})
