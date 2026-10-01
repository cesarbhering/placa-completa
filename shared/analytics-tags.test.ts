import { describe, it, expect } from 'vitest'
import { scriptsDeAnalytics, analyticsAtivo } from './analytics-tags'

describe('scriptsDeAnalytics (head do nuxt.config)', () => {
  it('gated (homolog/staging): NENHUM script de ads/analytics entra no HTML', () => {
    expect(scriptsDeAnalytics({ desligado: false, gated: true })).toEqual([])
    expect(scriptsDeAnalytics({ desligado: true, gated: false })).toEqual([])
  })
  it('producao (qualquer host): os mesmos scripts de sempre, sem guarda nenhuma', () => {
    const s = scriptsDeAnalytics({ desligado: false, gated: false })
    expect(s).toHaveLength(3)
    expect(s[0]).toEqual({ defer: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-24H7QSPX4G' })
    expect(s[1].innerHTML).toMatch(/^window\.dataLayer=.*gtag\('config','AW-18330779331'\);$/)
    expect(s[2].innerHTML).toMatch(/^\(function\(w,d,t,r,u\).*ti:"97265456".*"uetq"\);$/)
    expect(JSON.stringify(s)).not.toContain('location.hostname)>=0')
  })
})

describe('analyticsAtivo', () => {
  it('desliga so em gated', () => {
    expect(analyticsAtivo(true)).toBe(false)
    expect(analyticsAtivo(false)).toBe(true)
    expect(analyticsAtivo(undefined)).toBe(true)
  })
})
