// Agent-readiness (MVP): GET / com Accept: text/markdown devolve um resumo
// conciso da home em markdown em vez do HTML completo. So dispara quando o
// cliente prioriza text/markdown explicitamente (agentes/scanners) - browsers
// normais mandam text/html primeiro e continuam recebendo a pagina de sempre.
const HOME_MARKDOWN = `# PlacaCompleta

Consulta veicular completa por placa: dados do veiculo, historico, tabela FIPE
e indicadores de multa e leilao, em um relatorio unico.

## Como consultar
Digite a placa em https://placacompleta.com.br e receba o relatorio completo.
Existe um resumo gratuito e um relatorio premium mais detalhado.

## Para agentes e LLMs
Endpoint dedicado, sem necessidade de navegar a interface:
- Texto simples: https://placacompleta.com.br/llms?query=ABC1D23
- JSON estruturado: https://placacompleta.com.br/llms/json?query=ABC1D23
- Indice de skills: https://placacompleta.com.br/.well-known/skills/index.json
`

function prefersMarkdown(accept: string | undefined): boolean {
  if (!accept) return false
  const firstType = accept.split(',')[0]?.split(';')[0]?.trim().toLowerCase()
  return firstType === 'text/markdown'
}

export default defineEventHandler((event) => {
  if (event.path !== '/' && event.path !== '') return
  if (getMethod(event) !== 'GET') return

  const accept = getHeader(event, 'accept')
  if (!prefersMarkdown(accept)) return

  setResponseHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')
  return HOME_MARKDOWN
})
