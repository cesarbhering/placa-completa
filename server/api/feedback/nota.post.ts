import { registrarNota } from '../../utils/feedback'

// Grava a nota do clique no e-mail (uma vez so; clicar de novo devolve a
// nota ja gravada). Chamado pela pagina no navegador, nao no GET da URL: um
// leitor de links do provedor de e-mail que so busca a pagina nao vota.
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({})) || {}
  const token = String(body.token || '').trim()
  const r = await registrarNota(usePremiumSupabase(), token, body.nota)
  if (!r.existe) throw createError({ statusCode: 404, message: 'Link nao encontrado' })
  return { placa: r.placa, nota: r.nota, comentarioEnviado: r.comentarioEnviado }
})
