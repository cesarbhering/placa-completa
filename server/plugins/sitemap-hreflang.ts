import { parDeIdiomas } from '../../shared/idiomas'

// English version (Nov 6, 2026). With @nuxtjs/i18n installed, the sitemap
// module tags every page it discovers with hreflang pt-BR + x-default, even
// with autoI18n off. Only pages that really have an /en twin
// (shared/idiomas.ts) keep hreflang; everything else goes back to the plain
// entry it had before, so the PT sitemap does not change.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('sitemap:resolved' as any, (ctx: { urls: any[] }) => {
    for (const u of ctx.urls) {
      if (!u || typeof u !== 'object' || !u.alternatives) continue
      const loc = String(u.loc || '')
      let path = loc
      try { path = new URL(loc, 'https://placacompleta.com.br').pathname } catch { /* keep as is */ }
      const par = parDeIdiomas(path)
      if (!par || !par.pagina.redireciona) delete u.alternatives
    }
  })
})
