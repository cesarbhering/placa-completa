import { describe, it, expect } from 'vitest'
import { sanearOrigem, sanearUtmContent, UTM_CONTENT_MAX, origemLembrada, lembrarOrigem, dominioDeEntrada, hostDaRequisicao } from './origem-trafego'
import { utmContentDoChatgpt } from '~/composables/useAnalytics'

describe('sanearOrigem', () => {
  it('mantem os campos conhecidos', () => {
    expect(sanearOrigem({ msclkid: 'abc123', utm_source: 'bing', utm_medium: 'cpc', utm_campaign: 'teste', oppref: null, obref: null }))
      .toEqual({ gclid: null, msclkid: 'abc123', utm_source: 'bing', utm_medium: 'cpc', utm_campaign: 'teste', utm_content: null, oppref: null, obref: null, origem_retorno: false })
  })

  it('descarta campo desconhecido', () => {
    const r: any = sanearOrigem({ gclid: 'g1', hackeado: 'drop table' })
    expect(r.gclid).toBe('g1')
    expect(r.hackeado).toBeUndefined()
  })

  it('corta no limite de cada campo', () => {
    const longo = 'x'.repeat(500)
    const r = sanearOrigem({ gclid: longo, utm_source: longo, utm_campaign: longo })
    expect(r.gclid).toHaveLength(200)
    expect(r.utm_source).toHaveLength(100)
    expect(r.utm_campaign).toHaveLength(150)
  })

  it('valor que nao e string vira null', () => {
    expect(sanearOrigem({ gclid: 42, msclkid: null, utm_source: {} }))
      .toEqual({ gclid: null, msclkid: null, utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, oppref: null, obref: null, origem_retorno: false })
  })

  it('sem origem nenhuma devolve tudo null, sem quebrar', () => {
    const vazio = { gclid: null, msclkid: null, utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, oppref: null, obref: null, origem_retorno: false }
    expect(sanearOrigem(undefined)).toEqual(vazio)
    expect(sanearOrigem(null)).toEqual(vazio)
    expect(sanearOrigem('bing')).toEqual(vazio)
  })

  it('string vazia nao vira origem', () => {
    expect(sanearOrigem({ gclid: '   ' }).gclid).toBeNull()
  })
})

describe('utm_content (variacoes do OpenAI Ads, 01/nov/2026)', () => {
  it('saneia: trim, controle vira espaco, espacos juntos, ate 120', () => {
    expect(sanearUtmContent('  var_042  ')).toBe('var_042')
    expect(sanearUtmContent('linha1\nlinha2\t\u0000fim')).toBe('linha1 linha2 fim')
    expect(sanearUtmContent('a   b')).toBe('a b')
    expect(sanearUtmContent('x'.repeat(300))).toHaveLength(UTM_CONTENT_MAX)
    expect(UTM_CONTENT_MAX).toBe(120)
    expect(sanearUtmContent('   ')).toBeNull()
    expect(sanearUtmContent(42)).toBeNull()
    expect(sanearUtmContent(undefined)).toBeNull()
    expect(sanearUtmContent('acentuação ok')).toBe('acentuação ok')
  })

  it('sanearOrigem leva utm_content saneado pro insert', () => {
    const r = sanearOrigem({ utm_source: 'chatgpt_ads', utm_content: ' v17\n ', utm_medium: 'cpc' })
    expect(r.utm_content).toBe('v17')
    expect(sanearOrigem({ utm_content: 'y'.repeat(200) }).utm_content).toHaveLength(120)
  })

  it('utm_content sozinho conta como marca e entra na origem lembrada de anuncio', () => {
    const mem = new Map<string, string>()
    const ls = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) }, removeItem: (k: string) => { mem.delete(k) } }
    lembrarOrigem(ls, { oppref: 'gAAAAAtoken', utm_source: 'chatgpt_ads', utm_content: 'v03' })
    expect(origemLembrada(ls)?.utm_content).toBe('v03')
  })

  it('funil: utm_content no extra so quando utm_source=chatgpt_ads', () => {
    expect(utmContentDoChatgpt({ utm_source: 'chatgpt_ads', utm_content: ' v09 ' })).toBe('v09')
    expect(utmContentDoChatgpt({ utm_source: 'ChatGPT_Ads', utm_content: 'v09' })).toBe('v09')
    expect(utmContentDoChatgpt({ utm_source: 'bing', utm_content: 'v09' })).toBeNull()
    expect(utmContentDoChatgpt({ utm_source: 'chatgpt_ads' })).toBeNull()
    expect(utmContentDoChatgpt(null)).toBeNull()
  })
})

describe('dominioDeEntrada (Cesar 27/11/2026)', () => {
  it('our three domains, with or without www, port or trailing dot', () => {
    expect(dominioDeEntrada('placacompleta.com.br')).toBe('placacompleta')
    expect(dominioDeEntrada('www.placacompleta.com.br')).toBe('placacompleta')
    expect(dominioDeEntrada('olhonamoto.com.br')).toBe('olhonamoto')
    expect(dominioDeEntrada('WWW.OlhoNaMoto.com.br:443')).toBe('olhonamoto')
    expect(dominioDeEntrada('olhonocaminhao.com.br.')).toBe('olhonocaminhao')
  })
  it('our subdomains', () => {
    expect(dominioDeEntrada('app.placacompleta.com.br')).toBe('app')
    expect(dominioDeEntrada('staging.placacompleta.com.br')).toBe('staging')
  })
  it('any other host is null (never stored as typed)', () => {
    for (const h of ['', null, undefined, 'evil.com', 'placacompleta.com.br.evil.com', 'xolhonamoto.com.br', 'foo.placacompleta.com.br', 'a'.repeat(300)]) {
      expect(dominioDeEntrada(h)).toBeNull()
    }
  })
  it('takes the first value of a forwarded list', () => {
    expect(dominioDeEntrada('olhonocaminhao.com.br, 10.0.0.1')).toBe('olhonocaminhao')
  })
  it('reads the original host from the proxy header, else Host', () => {
    expect(hostDaRequisicao({ node: { req: { headers: { 'x-forwarded-host': 'olhonamoto.com.br', host: 'app:3000' } } } })).toBe('olhonamoto.com.br')
    expect(hostDaRequisicao({ node: { req: { headers: { host: 'placacompleta.com.br' } } } })).toBe('placacompleta.com.br')
    expect(hostDaRequisicao({})).toBe('')
  })
})
