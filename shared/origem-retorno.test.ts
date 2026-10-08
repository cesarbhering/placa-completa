import { describe, it, expect } from 'vitest'
import { sanearOrigem, lembrarOrigem, origemLembrada, ehOrigemDeAnuncio, CHAVE_ORIGEM_30D, ORIGEM_LEMBRADA_MS } from './origem-trafego'

function memoria() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}
const T0 = Date.UTC(2026, 9, 8, 12)
const DIA = 24 * 60 * 60 * 1000

describe('origem de anuncio lembrada por 30 dias', () => {
  it('clique no Bing fica guardado e volta numa sessao nova', () => {
    const ls = memoria()
    lembrarOrigem(ls, { msclkid: 'abc', utm_source: 'bing', utm_medium: 'cpc' }, T0)
    expect(origemLembrada(ls, T0 + 5 * DIA)).toEqual({ msclkid: 'abc', utm_source: 'bing', utm_medium: 'cpc' })
  })

  it('vale ate 30 dias do clique; depois some e apaga', () => {
    const ls = memoria()
    lembrarOrigem(ls, { gclid: 'g1' }, T0)
    expect(origemLembrada(ls, T0 + ORIGEM_LEMBRADA_MS)).toEqual({ gclid: 'g1' })
    expect(origemLembrada(ls, T0 + ORIGEM_LEMBRADA_MS + 1)).toBeUndefined()
    expect(ls.m.has(CHAVE_ORIGEM_30D)).toBe(false)
  })

  it('nao lembra utm que nao e anuncio (e-mail, social)', () => {
    const ls = memoria()
    lembrarOrigem(ls, { utm_source: 'email', utm_medium: 'email', utm_campaign: 'recompra' }, T0)
    expect(ls.m.size).toBe(0)
  })

  it('clique novo substitui o anterior (ultimo clique)', () => {
    const ls = memoria()
    lembrarOrigem(ls, { gclid: 'velho' }, T0)
    lembrarOrigem(ls, { msclkid: 'novo' }, T0 + DIA)
    expect(origemLembrada(ls, T0 + 2 * DIA)).toEqual({ msclkid: 'novo' })
  })

  it('conteudo corrompido ou adulterado vira undefined e e apagado', () => {
    const ls = memoria()
    ls.setItem(CHAVE_ORIGEM_30D, '{nao e json')
    expect(origemLembrada(ls, T0)).toBeUndefined()
    expect(ls.m.size).toBe(0)
    ls.setItem(CHAVE_ORIGEM_30D, JSON.stringify({ origem: { gclid: 'g', hackeado: 'x' }, em: T0 }))
    expect(origemLembrada(ls, T0)).toEqual({ gclid: 'g' })
    ls.setItem(CHAVE_ORIGEM_30D, JSON.stringify({ origem: { gclid: 'g' }, em: T0 + DIA }))
    expect(origemLembrada(ls, T0)).toBeUndefined() // data no futuro
  })

  it('ehOrigemDeAnuncio', () => {
    expect(ehOrigemDeAnuncio({ oppref: 'opp_1' })).toBe(true)
    expect(ehOrigemDeAnuncio({ utm_source: 'bing', utm_medium: 'CPC' })).toBe(true)
    expect(ehOrigemDeAnuncio({ utm_source: 'bing' })).toBe(false)
    expect(ehOrigemDeAnuncio(undefined)).toBe(false)
  })
})

describe('sanearOrigem: origem_retorno', () => {
  it("'1' com marca de anuncio vira true", () => {
    expect(sanearOrigem({ msclkid: 'abc', origem_retorno: '1' }).origem_retorno).toBe(true)
  })
  it('sem marca de anuncio fica false (flag sozinha nao vale)', () => {
    expect(sanearOrigem({ origem_retorno: '1' }).origem_retorno).toBe(false)
  })
  it('clique desta visita (sem flag) e false; lixo e false', () => {
    expect(sanearOrigem({ gclid: 'g' }).origem_retorno).toBe(false)
    expect(sanearOrigem({ gclid: 'g', origem_retorno: 'sim' }).origem_retorno).toBe(false)
  })
})
