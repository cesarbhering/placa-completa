import { COOKIE_IDIOMA, caminhoEn, paginaBilingue, parDeIdiomas } from '~/shared/idiomas'

// Language helpers for pages and components (Nov 6, 2026).
//
// `rota('/sobre')` gives the link in the current language: '/en/sobre' when
// the visitor is in English AND the page has an English twin; otherwise the
// PT path. Do not use the module's localePath for that: it would point to
// /en/blog, which does not exist (only the pages in shared/idiomas.ts do).
export function useIdioma() {
  const { locale, t } = useI18n()
  const emIngles = computed(() => locale.value === 'en')

  function rota(ptPath: string): string {
    if (!emIngles.value) return ptPath
    const [path, resto] = splitHash(ptPath)
    return paginaBilingue(path) ? caminhoEn(path) + resto : ptPath
  }

  return { locale, t, emIngles, rota }
}

function splitHash(p: string): [string, string] {
  const i = p.search(/[?#]/)
  return i >= 0 ? [p.slice(0, i), p.slice(i)] : [p, '']
}

/** Saves the manual choice for one year; the IP middleware respects it. */
export function gravarEscolhaIdioma(idioma: 'pt' | 'en') {
  if (!import.meta.client) return
  const umAno = 60 * 60 * 24 * 365
  const seguro = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${COOKIE_IDIOMA}=${idioma}; Max-Age=${umAno}; Path=/; SameSite=Lax${seguro}`
}

export { parDeIdiomas }
