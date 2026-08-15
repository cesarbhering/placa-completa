// GET /llms/json?query=... -> mesma resposta em JSON estruturado, com
// atribuicao (source, cite_as, more) pra virar citacao quando o agente repassa.
export default defineEventHandler(async (event) => {
  const { query, q } = getQuery(event)
  const raw = (query ?? q ?? '') as string
  const { fipeApiToken, fipeApiUrl } = useRuntimeConfig()

  const answer = await resolveLlmsQuery(raw, { fipeApiToken, fipeApiUrl })
  logAgentQuery(event, answer, 'json')

  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')
  return answer
})
