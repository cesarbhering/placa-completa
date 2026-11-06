import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { BASE_URL, PAGINAS_BILINGUES, caminhoEn } from './idiomas'

// Build-time helper for nuxt.config (node only, never shipped to the browser).
//
// @nuxtjs/i18n creates an /en twin for EVERY page unless told otherwise. We
// want the opposite: only the pages listed in shared/idiomas.ts get /en. So
// this scans pages/ and returns every other route name with `en: false`. A
// page added later by anyone stays PT only, without touching this file.

/** Route name the way Nuxt derives it from the file path. */
export function nomeDaRota(arquivoRelativo: string): string {
  const semExt = arquivoRelativo.replace(/\\/g, '/').replace(/\.vue$/, '')
  const partes = semExt.split('/').map((seg) => seg
    .replace(/\[\[\.\.\.(.+?)\]\]|\[\[(.+?)\]\]|\[\.\.\.(.+?)\]|\[(.+?)\]/g, (_, a, b, c, d) => a || b || c || d))
  if (partes[partes.length - 1] === 'index') partes.pop()
  return partes.join('-') || 'index'
}

export function nomesDeRotas(dirPages: string): string[] {
  const nomes: string[] = []
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome)
      if (statSync(p).isDirectory()) andar(p)
      else if (nome.endsWith('.vue')) nomes.push(nomeDaRota(relative(dirPages, p)))
    }
  }
  andar(dirPages)
  return [...new Set(nomes)].sort()
}

/** The `pages` option of @nuxtjs/i18n: every non-bilingual page without /en. */
export function paginasSoEmPortugues(dirPages: string): Record<string, { en: false }> {
  const bilingues = new Set(PAGINAS_BILINGUES.map((p) => p.nome))
  return Object.fromEntries(
    nomesDeRotas(dirPages).filter((n) => !bilingues.has(n)).map((n) => [n, { en: false as const }]),
  )
}

// Sitemap side. The PT entries keep their URL and order; the ones with an /en
// twin only gain the hreflang alternates. The /en URLs go at the end. Pages
// whose meta says noindex (terms, privacy) and token pages get no /en entry.
const SEM_EN_NO_SITEMAP = new Set(['/termos-de-uso', '/politica-de-privacidade'])

export function alternativasIdioma(pt: string) {
  return [
    { hreflang: 'pt-BR', href: `${BASE_URL}${pt}` },
    { hreflang: 'en', href: `${BASE_URL}${caminhoEn(pt)}` },
    { hreflang: 'x-default', href: `${BASE_URL}${pt}` },
  ]
}

export type UrlSitemap = string | { loc: string; alternatives: ReturnType<typeof alternativasIdioma> }

export function comVersaoEn(urls: string[]): UrlSitemap[] {
  const bilingues = new Set(PAGINAS_BILINGUES.filter((p) => p.redireciona && !p.pt.includes(':')).map((p) => p.pt))
  const pt = urls.map((u) => (bilingues.has(u) ? { loc: u, alternatives: alternativasIdioma(u) } : u))
  const en = urls.filter((u) => bilingues.has(u) && !SEM_EN_NO_SITEMAP.has(u))
    .map((u) => ({ loc: caminhoEn(u), alternatives: alternativasIdioma(u) }))
  return [...pt, ...en]
}
