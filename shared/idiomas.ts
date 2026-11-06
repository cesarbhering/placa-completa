// English version of the site (Nov 6, 2026). Portuguese stays the default
// locale, unprefixed, with no new URL; English lives under /en.
//
// This list is the single source of truth for "which pages have /en":
// nuxt.config uses it to enable only these routes in @nuxtjs/i18n, the IP
// middleware uses it to decide whether it may redirect, app.vue uses it for
// hreflang and the footer for the PT | EN switcher. A page that is not listed
// stays PT only: no /en route, no redirect.

export const IDIOMA_PADRAO = 'pt-BR'
export const IDIOMA_EN = 'en'
export const PREFIXO_EN = '/en'
export const COOKIE_IDIOMA = 'pc_lang'
export const BASE_URL = 'https://placacompleta.com.br'

export interface PaginaBilingue {
  /** Route name Nuxt generates from pages/ (e.g. 'feedback-token'). */
  nome: string
  /** PT path. ":param" matches any single segment. */
  pt: string
  /**
   * false = the page exists under /en, but the IP never sends anyone there
   * (token links: the customer opens what they received, and the language
   * comes from their own choice).
   */
  redireciona: boolean
}

export const PAGINAS_BILINGUES: PaginaBilingue[] = [
  { nome: 'sobre', pt: '/sobre', redireciona: true },
  { nome: 'contato', pt: '/contato', redireciona: true },
  { nome: 'para-empresas', pt: '/para-empresas', redireciona: true },
  { nome: 'consulta-veicular-completa', pt: '/consulta-veicular-completa', redireciona: true },
  { nome: 'termos-de-uso', pt: '/termos-de-uso', redireciona: true },
  { nome: 'politica-de-privacidade', pt: '/politica-de-privacidade', redireciona: true },
  { nome: 'feedback-token', pt: '/feedback/:token', redireciona: false },
]

export function semBarraFinal(p: string): string {
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p
}

function casa(padrao: string, path: string): boolean {
  const a = padrao.split('/')
  const b = path.split('/')
  if (a.length !== b.length) return false
  return a.every((seg, i) => (seg.startsWith(':') ? b[i] !== '' : seg === b[i]))
}

/** Bilingual page matching a PT path (no query string), or null. */
export function paginaBilingue(ptPath: string): PaginaBilingue | null {
  const p = semBarraFinal(ptPath || '/')
  return PAGINAS_BILINGUES.find((x) => casa(x.pt, p)) || null
}

export function ehCaminhoEn(path: string): boolean {
  return path === PREFIXO_EN || path.startsWith(`${PREFIXO_EN}/`)
}

/** '/en/sobre' -> '/sobre'; '/en' -> '/'. A PT path comes back unchanged. */
export function caminhoPt(path: string): string {
  if (!ehCaminhoEn(path)) return path
  return path.slice(PREFIXO_EN.length) || '/'
}

/** '/sobre' -> '/en/sobre'; '/' -> '/en'. */
export function caminhoEn(ptPath: string): string {
  return ptPath === '/' ? PREFIXO_EN : `${PREFIXO_EN}${ptPath}`
}

/**
 * PT/EN pair for a path (in either language), or null when the page only
 * exists in PT.
 */
export function parDeIdiomas(path: string): { pt: string; en: string; pagina: PaginaBilingue } | null {
  const pt = semBarraFinal(caminhoPt(path || '/'))
  const pagina = paginaBilingue(pt)
  if (!pagina) return null
  return { pt, en: caminhoEn(pt), pagina }
}
