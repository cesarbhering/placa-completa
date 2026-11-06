import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { REDES_SOCIAIS, SAME_AS } from '../shared/redes-sociais'
import ptMsgs from '../i18n/locales/pt-BR'

describe('redes sociais', () => {
  it('perfis oficiais', () => {
    expect(SAME_AS).toEqual(['https://www.linkedin.com/company/placacompleta/', 'https://x.com/PlacaCompleta', 'https://www.tiktok.com/@placacompleta/', 'https://www.instagram.com/placa.completa/'])
  })
  it('rodape: links com aria-label, nova aba e rel seguro, SVG inline', () => {
    const app = readFileSync('app.vue', 'utf8')
    for (const r of REDES_SOCIAIS) {
      const a = app.match(new RegExp(`<a href="${r.url.replace(/[.?/@]/g, '\\$&')}"[^>]*>`))?.[0] || ''
      // The label comes from i18n since the English version (Nov 6, 2026):
      // :aria-label="t('rodape.linkedin')", and the PT text is in pt-BR.ts.
      const chave = a.match(/:aria-label="t\('([\w.]+)'\)"/)?.[1]
      expect(chave, r.url).toBeTruthy()
      expect(chave!.split('.').reduce((o: any, k) => o?.[k], ptMsgs)).toBe(r.label)
      expect(a).toContain('target="_blank"')
      expect(a).toContain('rel="noopener noreferrer"')
    }
    expect(app).toMatch(/footer__redes[\s\S]*<svg/)
  })
  it('sameAs no schema Organization da home', () => {
    expect(readFileSync('pages/index.vue', 'utf8')).toMatch(/'@type': 'Organization',[\s\S]{0,300}sameAs: SAME_AS/)
  })
})
