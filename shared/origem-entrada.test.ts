import { describe, it, expect } from 'vitest'
import { referrerLimpo, pathLimpo, sanearEntrada } from './origem-trafego'

describe('entrada da sessao (referrer + landing_path)', () => {
  it('referrer: so o host', () => {
    expect(referrerLimpo('https://www.google.com/')).toBe('https://www.google.com')
    expect(referrerLimpo('https://www.bing.com/search?q=placa+abc1d23&form=x')).toBe('https://www.bing.com')
    expect(referrerLimpo('android-app://com.google.android.gm/')).toBeNull()
  })
  it('referrer do proprio site vira null', () => {
    expect(referrerLimpo('https://placacompleta.com.br/tabela-fipe')).toBeNull()
    expect(referrerLimpo('https://app.placacompleta.com.br/')).toBeNull()
  })
  it('landing_path: so o path', () => {
    expect(pathLimpo('/consultar-placa/bahia?utm_source=x#a')).toBe('/consultar-placa/bahia')
    expect(pathLimpo('https://evil')).toBeNull()
  })
  it('saneia payload adulterado', () => {
    expect(sanearEntrada({ referrer: 'javascript:alert(1)', landing_path: 42, extra: 'x' })).toEqual({ referrer: null, landing_path: null })
    expect(sanearEntrada(undefined)).toEqual({ referrer: null, landing_path: null })
    expect(sanearEntrada({ referrer: 'https://chatgpt.com/c/123', landing_path: '/' })).toEqual({ referrer: 'https://chatgpt.com', landing_path: '/' })
  })
})
