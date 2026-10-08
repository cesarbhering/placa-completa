import { describe, it, expect } from 'vitest'
import { sanearOrigem } from './origem-trafego'

describe('sanearOrigem', () => {
  it('mantem os campos conhecidos', () => {
    expect(sanearOrigem({ msclkid: 'abc123', utm_source: 'bing', utm_medium: 'cpc', utm_campaign: 'teste', oppref: null, obref: null }))
      .toEqual({ gclid: null, msclkid: 'abc123', utm_source: 'bing', utm_medium: 'cpc', utm_campaign: 'teste', oppref: null, obref: null, origem_retorno: false })
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
      .toEqual({ gclid: null, msclkid: null, utm_source: null, utm_medium: null, utm_campaign: null, oppref: null, obref: null, origem_retorno: false })
  })

  it('sem origem nenhuma devolve tudo null, sem quebrar', () => {
    const vazio = { gclid: null, msclkid: null, utm_source: null, utm_medium: null, utm_campaign: null, oppref: null, obref: null, origem_retorno: false }
    expect(sanearOrigem(undefined)).toEqual(vazio)
    expect(sanearOrigem(null)).toEqual(vazio)
    expect(sanearOrigem('bing')).toEqual(vazio)
  })

  it('string vazia nao vira origem', () => {
    expect(sanearOrigem({ gclid: '   ' }).gclid).toBeNull()
  })
})
