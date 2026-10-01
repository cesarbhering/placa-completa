import { describe, it, expect } from 'vitest'
import { scriptsDeAnalytics, analyticsAtivo, analyticsPermitidoNoHost } from './analytics-tags'

const ADS = /googletagmanager|bat\.bing|clarity|fbevents|onesignal|uetq|gtag\(/

describe('scriptsDeAnalytics (head do nuxt.config)', () => {
  it('gated (homolog/staging): NENHUM script de ads/analytics entra no HTML', () => {
    expect(scriptsDeAnalytics({ desligado: false, gated: true })).toEqual([])
    expect(scriptsDeAnalytics({ desligado: true, gated: false })).toEqual([])
  })
  it('producao: gtag.js + config GA4/Ads + UET, iguais aos de antes, so com a guarda de host', () => {
    const s = scriptsDeAnalytics({ desligado: false, gated: false })
    expect(s).toHaveLength(3)
    expect(s[0]).toEqual({ defer: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-24H7QSPX4G' })
    expect(s[1].innerHTML).toContain("gtag('config','G-24H7QSPX4G',{site_hostname:location.hostname});gtag('config','AW-18330779331');")
    expect(s[2].innerHTML).toContain('ti:"97265456"')
    for (const x of s.slice(1)) expect(x.innerHTML).toMatch(/^if\(\[.*"placacompleta\.com\.br".*\]\.indexOf\(location\.hostname\)>=0\)\{/)
    expect(JSON.stringify(s)).toMatch(ADS)
  })
  it('a guarda inline e a mesma regra do analyticsPermitidoNoHost', () => {
    const guarda = String(scriptsDeAnalytics({ desligado: false, gated: false })[1].innerHTML).match(/^if\((.*?)\)\{/)![1]
    const roda = (host: string) => new Function('location', `return ${guarda}`)({ hostname: host })
    for (const h of ['placacompleta.com.br', 'www.placacompleta.com.br', 'olhonamoto.com.br', 'app.placacompleta.com.br', '127.0.0.1', 'homolog.placacompleta.com.br', 'localhost']) {
      expect(roda(h)).toBe(analyticsPermitidoNoHost(h))
    }
  })
})

describe('analyticsAtivo (plugins e trackConversionPaga)', () => {
  it('so com container nao gated E host de producao', () => {
    expect(analyticsAtivo(false, 'placacompleta.com.br')).toBe(true)
    expect(analyticsAtivo(false, 'app.placacompleta.com.br')).toBe(true)
    expect(analyticsAtivo(true, 'placacompleta.com.br')).toBe(false)
    expect(analyticsAtivo(false, '127.0.0.1')).toBe(false)
    expect(analyticsAtivo(false, 'homolog.placacompleta.com.br')).toBe(false)
    expect(analyticsAtivo(false, 'staging.placacompleta.com.br')).toBe(false)
  })
})
