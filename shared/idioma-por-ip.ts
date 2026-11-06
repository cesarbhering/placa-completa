import { COOKIE_IDIOMA, caminhoEn, caminhoPt, ehCaminhoEn, paginaBilingue, semBarraFinal } from './idiomas'

// Language by IP (Nov 6, 2026). Pure decision, no h3, so it can be tested
// head to head with every case. The server middleware
// (server/middleware/zz-idioma-por-ip.ts) only feeds it the request.
//
// Rules, in order:
// - Only GET of an HTML page (Accept with text/html), only on the main host.
// - Crawlers never move. Google crawls from US IPs: redirecting Googlebot to
//   /en would drop the PT site from the index.
// - Token pages (report, feedback) never move: the customer opens the link
//   they got.
// - Manual choice (cookie pc_lang) beats the IP, both ways.
// - No cookie: country outside BR goes from a PT page to its /en twin.
//   BR, missing country, XX (unknown) and T1 (Tor) stay where they are.
// - Brazil without a cookie: never any redirect.

export interface PedidoIdioma {
  metodo: string
  /** Path with query string, as h3 delivers it (event.path). */
  url: string
  host: string
  accept?: string
  userAgent?: string
  pais?: string
  cookieIdioma?: string
  /** Internal fetch of the markdown middleware: never redirected. */
  interno?: boolean
}

/**
 * Hosts where the IP redirect is active (staging included, to test the flow
 * before production). Other domains (olhonamoto, olhonocaminhao, app.) stay
 * exactly as they are.
 */
export const HOSTS_PADRAO = ['placacompleta.com.br', 'www.placacompleta.com.br', 'staging.placacompleta.com.br']

const ROBO =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|facebot|whatsapp|telegram|discord|skype|slack|linkedin|pinterest|embedly|quora|vkshare|tumblr|redditbot|bingpreview|mediapartners|adsbot|google-inspectiontool|googleother|google-extended|feedfetcher|lighthouse|pagespeed|chrome-lighthouse|headless|phantom|ahrefs|semrush|mj12|dotbot|petalbot|yandex|baidu|duckduck|sogou|exabot|applebot|gptbot|chatgpt|oai-searchbot|claude|anthropic|perplexity|bytespider|ccbot|meta-externalagent|amazonbot|curl|wget|python|go-http|java\/|okhttp|axios|node-fetch|undici/i

export function ehRobo(ua?: string): boolean {
  // No UA at all is not a browser.
  if (!ua || !ua.trim()) return true
  return ROBO.test(ua)
}

// Never redirected, even if someday they land on the bilingual list.
const PREFIXOS_FORA = [
  '/api', '/_nuxt', '/__nuxt', '/_ipx', '/_i18n', '/__sitemap__', '/sitemap', '/robots.txt', '/llms',
  '/.well-known', '/agent-skills', '/mcp', '/admin', '/dash', '/woovi-teste', '/premium/', '/feedback/',
  '/webhook', '/webhooks', '/callback', '/cdn-cgi',
]

export function rotaExcluida(path: string): boolean {
  const pt = caminhoPt(path)
  if (/\.[a-z0-9]{1,8}$/i.test(pt)) return true // static file (.png, .xml, .txt, .js...)
  if (/webhook|callback/i.test(pt)) return true
  if (pt.startsWith('/_')) return true // /_nuxt, /__nuxt_error, /_ipx, /__sitemap__...
  return PREFIXOS_FORA.some((p) => {
    // '/premium/' (trailing slash) = only what is BELOW it (the token page);
    // '/api' = the path itself and everything below it.
    if (p.endsWith('/')) return pt.startsWith(p)
    return pt === p || pt.startsWith(`${p}/`)
  })
}

function paisValido(pais?: string): string | null {
  const p = (pais || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(p) || p === 'XX' || p === 'T1') return null
  return p
}

/**
 * Where to send the request, or null to serve it as is.
 * The returned URL keeps the query string (UTMs, gclid, msclkid).
 */
export function destinoPorIdioma(p: PedidoIdioma, hosts: string[] = HOSTS_PADRAO): string | null {
  if ((p.metodo || '').toUpperCase() !== 'GET') return null
  if (p.interno) return null
  const host = (p.host || '').toLowerCase().split(':')[0]
  if (!hosts.includes(host)) return null
  if (!(p.accept || '').toLowerCase().includes('text/html')) return null
  if (ehRobo(p.userAgent)) return null

  const url = p.url || '/'
  const i = url.indexOf('?')
  const path = i >= 0 ? url.slice(0, i) : url
  const query = i >= 0 ? url.slice(i) : ''
  if (rotaExcluida(path)) return null

  const naEn = ehCaminhoEn(path)
  const pt = semBarraFinal(caminhoPt(path))
  const pagina = paginaBilingue(pt)
  if (!pagina || !pagina.redireciona) return null

  const escolha = p.cookieIdioma === 'pt' || p.cookieIdioma === 'en' ? p.cookieIdioma : null
  if (escolha === 'pt') return naEn ? pt + query : null
  if (escolha === 'en') return naEn ? null : caminhoEn(pt) + query

  // No manual choice: only a foreign country on a PT page moves. Someone on
  // /en (link, ad) stays there, even from Brazil.
  if (naEn) return null
  const pais = paisValido(p.pais)
  if (!pais || pais === 'BR') return null
  return caminhoEn(pt) + query
}

export { COOKIE_IDIOMA }
