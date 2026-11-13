import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'

// Where the visitor is: the CDN's own location headers first (nothing leaves
// the server), the external lookup only when they did not come, and then only
// with an address that parses as one. The return shape is the same either way.
const IP = '203.0.113.7'
// A header value with non-ASCII text as Node hands it over (UTF-8 bytes read as latin1).
const comoCabecalho = (s: string) => Buffer.from(s, 'utf8').toString('latin1')
const CDN = { 'cf-ipcountry': 'BR', 'cf-region-code': 'SP', 'cf-ipcity': comoCabecalho('São Paulo'), 'cf-ipcontinent': 'SA', 'cf-timezone': 'America/Sao_Paulo' }

let cabecalhos: Record<string, string> = {}
let externo: ReturnType<typeof vi.fn>
let lookupIpGeo: typeof import('./ip-geo').lookupIpGeo
let geoDosCabecalhos: typeof import('./ip-geo').geoDosCabecalhos

beforeEach(async () => {
  vi.resetModules()
  cabecalhos = {}
  externo = vi.fn(async () => ({ status: 'success', countryCode: 'BR', region: 'MG', city: 'Belo Horizonte' }))
  vi.stubGlobal('$fetch', externo)
  vi.stubGlobal('getRequestHeaders', () => cabecalhos)
  ;({ lookupIpGeo, geoDosCabecalhos } = await import('./ip-geo'))
})
afterEach(() => vi.unstubAllGlobals())

describe('location from the CDN headers', () => {
  it('uses the headers and makes no external call', async () => {
    cabecalhos = { ...CDN }
    expect(await lookupIpGeo(IP, {} as any)).toEqual({ city: 'São Paulo', uf: 'SP', country: 'BR' })
    expect(externo).not.toHaveBeenCalled()
  })

  it('same shape for a visitor outside Brazil', async () => {
    cabecalhos = { 'cf-ipcountry': 'pt', 'cf-region-code': '11', 'cf-ipcity': 'Lisbon', 'cf-timezone': 'Europe/Lisbon' }
    expect(await lookupIpGeo(IP, {} as any)).toEqual({ city: 'Lisbon', uf: '11', country: 'PT' })
  })

  it('location headers on, but the CDN does not know city or region: country only, still no external call', async () => {
    cabecalhos = { 'cf-ipcountry': 'BR', 'cf-ipcontinent': 'SA', 'cf-timezone': 'America/Sao_Paulo' }
    expect(await lookupIpGeo(IP, {} as any)).toEqual({ city: null, uf: null, country: 'BR' })
    expect(externo).not.toHaveBeenCalled()
  })

  it('only the country header (location headers not turned on yet): falls back, so UF and city are not lost', async () => {
    cabecalhos = { 'cf-ipcountry': 'BR' }
    expect(await lookupIpGeo(IP, {} as any)).toEqual({ city: 'Belo Horizonte', uf: 'MG', country: 'BR' })
    expect(externo).toHaveBeenCalledTimes(1)
  })

  it('the "unknown country" markers of the CDN do not count as a location', async () => {
    for (const pais of ['XX', 'T1', '', 'BRA', '1', '<b>']) {
      expect(geoDosCabecalhos({ ...CDN, 'cf-ipcountry': pais }), pais).toBeNull()
    }
  })

  it('header values are typed and bounded before they are used or stored', () => {
    const g = geoDosCabecalhos({ ...CDN, 'cf-region-code': 'SP<script>', 'cf-ipcity': `  Cidade\r\n${'x'.repeat(500)}` })
    expect(g?.uf).toBeNull()
    expect(g?.city?.startsWith('Cidade x')).toBe(true)
    expect(g?.city?.length).toBeLessThanOrEqual(80)
    expect(geoDosCabecalhos({ ...CDN, 'cf-ipcity': '' })).toEqual({ city: null, uf: 'SP', country: 'BR' })
  })

  it('a city already in plain text or in latin1 is kept as it came', () => {
    expect(geoDosCabecalhos({ ...CDN, 'cf-ipcity': 'Sao Paulo' })?.city).toBe('Sao Paulo')
    expect(geoDosCabecalhos({ ...CDN, 'cf-ipcity': 'São Paulo' })?.city).toBe('São Paulo')
  })

  it('no headers object: nothing', () => {
    expect(geoDosCabecalhos(null)).toBeNull()
    expect(geoDosCabecalhos({})).toBeNull()
  })
})

describe('external lookup as the fallback', () => {
  it('is called with the validated address and returns the same shape as before', async () => {
    expect(await lookupIpGeo(IP, {} as any)).toEqual({ city: 'Belo Horizonte', uf: 'MG', country: 'BR' })
    expect(externo).toHaveBeenCalledTimes(1)
    expect(String(externo.mock.calls[0][0])).toBe(`http://ip-api.com/json/${IP}?fields=status,countryCode,region,city`)
  })

  it('still works when the caller has no request at hand', async () => {
    expect(await lookupIpGeo(IP)).toEqual({ city: 'Belo Horizonte', uf: 'MG', country: 'BR' })
  })

  it('a value that is not an address never goes into the URL', async () => {
    for (const ruim of ['unknown', '', '203.0.113.7/../x', '203.0.113.7?fields=query', 'example.test', '203.0.113.7#', 'a b', '%0a']) {
      expect(await lookupIpGeo(ruim, {} as any), ruim).toBeNull()
    }
    expect(externo).not.toHaveBeenCalled()
  })

  it('an IPv6 address goes in its canonical spelling', async () => {
    await lookupIpGeo('2001:DB8::1', {} as any)
    expect(String(externo.mock.calls[0][0])).toContain('/json/2001:db8:0:0:0:0:0:1?')
  })

  it('caches by address for an hour, as before', async () => {
    await lookupIpGeo(IP, {} as any)
    await lookupIpGeo(IP, {} as any)
    await lookupIpGeo(` ${IP} `, {} as any)
    expect(externo).toHaveBeenCalledTimes(1)
  })

  it('fails open: error or timeout gives null', async () => {
    externo.mockRejectedValueOnce(new Error('timeout'))
    expect(await lookupIpGeo(IP, {} as any)).toBeNull()
    externo.mockResolvedValueOnce({ status: 'fail' })
    expect(await lookupIpGeo('198.51.100.20', {} as any)).toBeNull()
  })

  it('a failure reading the headers falls back instead of throwing', async () => {
    vi.stubGlobal('getRequestHeaders', () => { throw new Error('no event') })
    expect(await lookupIpGeo(IP, {} as any)).toEqual({ city: 'Belo Horizonte', uf: 'MG', country: 'BR' })
  })
})

describe('GET /api/geo', () => {
  async function geo(h: Record<string, string>) {
    cabecalhos = h
    vi.stubGlobal('defineEventHandler', (fn: any) => fn)
    const handler = (await import('../api/geo.get')).default as (event: any) => Promise<any>
    return handler({})
  }

  it('answers the UF from the CDN headers, with no external call', async () => {
    expect(await geo({ 'cf-connecting-ip': IP, ...CDN, 'cf-region-code': 'RJ' })).toEqual({ uf: 'RJ' })
    expect(externo).not.toHaveBeenCalled()
  })

  it('outside Brazil, or with no region, keeps the default', async () => {
    expect(await geo({ 'cf-connecting-ip': IP, 'cf-ipcountry': 'PT', 'cf-region-code': '11', 'cf-timezone': 'Europe/Lisbon' })).toEqual({ uf: 'SP' })
    expect(await geo({ 'cf-connecting-ip': IP, 'cf-ipcountry': 'BR', 'cf-timezone': 'America/Sao_Paulo' })).toEqual({ uf: 'SP' })
    expect(await geo({})).toEqual({ uf: 'SP' })
  })

  it('without the location headers it answers from the external lookup, as before', async () => {
    expect(await geo({ 'cf-connecting-ip': IP })).toEqual({ uf: 'MG' })
  })
})

// The headers only help if the caller hands the request over.
describe('callers of the geo lookup', () => {
  it('every caller passes the request as the second argument', () => {
    const chamadores = ['server/api/geo.get.ts', 'server/api/consulta.post.ts', 'server/api/cotacao-seguro.post.ts', 'server/utils/relatorio-aberturas.ts']
    for (const arquivo of chamadores) {
      const chamadas = [...readFileSync(arquivo, 'utf8').matchAll(/lookupIpGeo\(([^\n]*)/g)].map((m) => m[1])
      expect(chamadas.length, arquivo).toBeGreaterThan(0)
      for (const c of chamadas) expect(c, arquivo).toMatch(/, event\)/)
    }
  })
})
