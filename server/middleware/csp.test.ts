import { describe, it, expect, vi } from 'vitest'

vi.stubGlobal('defineEventHandler', (f: any) => f)
const { POLICY } = await import('./csp')

const diretiva = (nome: string) => (POLICY.split('; ').find((d) => d.startsWith(nome + ' ')) || '').split(' ')

describe('CSP report-only allowlist', () => {
  it('connect-src allows the Google endpoints that flooded the report log', () => {
    const c = diretiva('connect-src')
    for (const host of ['https://analytics.google.com', 'https://stats.g.doubleclick.net', 'https://ad.doubleclick.net', 'https://www.googleadservices.com']) {
      expect(c).toContain(host)
    }
  })
  it('script-src allows the Google Ads view-through script', () => {
    expect(diretiva('script-src')).toContain('https://googleads.g.doubleclick.net')
  })
  it('img-src allows the quickchart FIPE chart', () => {
    expect(diretiva('img-src')).toContain('https://quickchart.io')
  })
  it('keeps reporting to the same endpoint', () => {
    expect(POLICY).toContain('report-uri /api/csp-report')
  })
})
