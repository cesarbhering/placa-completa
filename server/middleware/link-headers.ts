// Agent-readiness: expoe o sitemap e o api-catalog (RFC 9727) via header
// Link em toda pagina renderizada, pra scanners/agentes acharem sem precisar
// adivinhar a URL. Pula assets, API e os proprios well-known.
const SKIP_PREFIXES = ['/api/', '/_nuxt/', '/.well-known/', '/agent-skills/', '/__nuxt_', '/cdn-cgi/']

export default defineEventHandler((event) => {
  if (getMethod(event) !== 'GET') return
  const path = event.path.split('?')[0]
  if (SKIP_PREFIXES.some((prefix) => path.startsWith(prefix))) return
  if (/\.[a-z0-9]+$/i.test(path)) return // arquivos estaticos (js, css, xml, txt, ico...)

  appendResponseHeader(
    event,
    'Link',
    '<https://placacompleta.com.br/sitemap.xml>; rel="sitemap", <https://placacompleta.com.br/.well-known/api-catalog>; rel="api-catalog"'
  )
})
