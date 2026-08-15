// GET /llms?query=... -> resposta em texto pra agentes/LLMs (reverse mullet).
// Sem barreira de UA: aqui o bot e bem-vindo. Espelha o padrao do post.
export default defineEventHandler(async (event) => {
  const { query, q } = getQuery(event)
  const raw = (query ?? q ?? '') as string
  const { fipeApiToken, fipeApiUrl } = useRuntimeConfig()

  const answer = await resolveLlmsQuery(raw, { fipeApiToken, fipeApiUrl })
  logAgentQuery(event, answer, 'text')

  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')
  return renderLlmsText(answer)
})
