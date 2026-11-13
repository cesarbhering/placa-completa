import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  AB_PRECO_KEY, PRECO_COMPLETA_BRACO, _resetAbPreco, abPrecoLigadoPorEnv, adotarBracoSeVazio, aplicarCupomNoBraco,
  bracoAtual, bracoDoPedido, colunasAbPreco, configurarAbPreco, pareceBot, precoDoPlano, sortearBraco,
} from './ab-preco'
import { PLANOS } from './planos'

function fakeStore(opts: { quebra?: boolean } = {}) {
  const m = new Map<string, string>()
  return {
    m,
    getItem: (k: string) => { if (opts.quebra) throw new Error('blocked'); return m.has(k) ? m.get(k)! : null },
    setItem: (k: string, v: string) => { if (opts.quebra) throw new Error('blocked'); m.set(k, v) },
    removeItem: (k: string) => { m.delete(k) },
  }
}

let local: ReturnType<typeof fakeStore>
let sessao: ReturnType<typeof fakeStore>

function instalar(l = fakeStore(), s = fakeStore()) {
  local = l; sessao = s
  vi.stubGlobal('localStorage', l)
  vi.stubGlobal('sessionStorage', s)
}

beforeEach(() => { instalar(); _resetAbPreco() })
afterEach(() => { vi.unstubAllGlobals() })

describe('flag parsing', () => {
  it('only explicit on-like values turn the test on', () => {
    expect(abPrecoLigadoPorEnv('on')).toBe(true)
    expect(abPrecoLigadoPorEnv(' ON ')).toBe(true)
    for (const v of ['', 'off', undefined, null, 'B', '0']) expect(abPrecoLigadoPorEnv(v)).toBe(false)
  })
})

describe('sticky draw per visitor', () => {
  it('draws once and keeps the arm in localStorage across visits', () => {
    configurarAbPreco({ ligado: true })
    expect(sortearBraco(() => 0.9)).toBe('B')
    expect(local.m.get(AB_PRECO_KEY)).toBe('B')
    // "Tomorrow": new page load (module state reset except storage), different random.
    configurarAbPreco({ ligado: true })
    expect(sortearBraco(() => 0.1)).toBe('B')
    expect(bracoAtual()).toBe('B')
  })

  it('50/50 split by the random draw', () => {
    configurarAbPreco({ ligado: true })
    expect(sortearBraco(() => 0.49)).toBe('A')
    _resetAbPreco(); instalar(); configurarAbPreco({ ligado: true })
    expect(sortearBraco(() => 0.5)).toBe('B')
  })

  it('falls back to sessionStorage when localStorage is blocked', () => {
    instalar(fakeStore({ quebra: true }), fakeStore())
    configurarAbPreco({ ligado: true })
    expect(sortearBraco(() => 0.9)).toBe('B')
    expect(sessao.m.get(AB_PRECO_KEY)).toBe('B')
    expect(bracoAtual()).toBe('B')
  })

  it('keeps the arm in memory when both storages are blocked', () => {
    instalar(fakeStore({ quebra: true }), fakeStore({ quebra: true }))
    configurarAbPreco({ ligado: true })
    expect(sortearBraco(() => 0.9)).toBe('B')
    expect(sortearBraco(() => 0.1)).toBe('B')
  })

  it('an invalid stored value is ignored and redrawn', () => {
    local.m.set(AB_PRECO_KEY, 'C')
    configurarAbPreco({ ligado: true })
    expect(bracoAtual()).toBeNull()
    expect(sortearBraco(() => 0.9)).toBe('B')
  })

  it('test off: everybody A, nothing read or stored', () => {
    local.m.set(AB_PRECO_KEY, 'B')
    configurarAbPreco({ ligado: false })
    expect(bracoAtual()).toBeNull()
    expect(sortearBraco(() => 0.9)).toBe('A')
    _resetAbPreco(); instalar()
    expect(sortearBraco(() => 0.9)).toBe('A')
    expect(local.m.size).toBe(0)
  })

  it('app and bots do not participate: always A, no stamp, nothing stored', () => {
    configurarAbPreco({ ligado: true, participa: false })
    expect(sortearBraco(() => 0.9)).toBe('A')
    expect(bracoAtual()).toBeNull()
    expect(local.m.size).toBe(0)
  })

  it('adopts the arm from our own link only when none is stored', () => {
    configurarAbPreco({ ligado: true })
    expect(adotarBracoSeVazio('B')).toBe('B')
    expect(adotarBracoSeVazio('A')).toBe('B')
    expect(adotarBracoSeVazio('X')).toBe('B')
  })
})

describe('bot heuristics', () => {
  it('flags crawlers and webdriver, not regular browsers', () => {
    expect(pareceBot('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe(true)
    expect(pareceBot('Mozilla/5.0 HeadlessChrome/120')).toBe(true)
    expect(pareceBot('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile', true)).toBe(true)
    expect(pareceBot('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile')).toBe(false)
  })
})

describe('price per arm', () => {
  it('A follows the table, B is 39,90, the Basica never varies', () => {
    expect(precoDoPlano('completa', 'A')).toBe(PLANOS.completa.valorCentavos)
    expect(precoDoPlano('completa', null)).toBe(PLANOS.completa.valorCentavos)
    expect(precoDoPlano('completa', 'B')).toBe(3990)
    expect(PRECO_COMPLETA_BRACO.B).toBe(3990)
    expect(precoDoPlano('basica', 'B')).toBe(PLANOS.basica.valorCentavos)
  })

  it('a percentage coupon applies on the arm price', () => {
    const c = { tipo: 'percentual' as const, valor: 10, planos: ['completa'] }
    expect(aplicarCupomNoBraco('completa', c, 'B')).toEqual({ precoBrutoCentavos: 3990, descontoCentavos: 399, precoLiquidoCentavos: 3591 })
    expect(aplicarCupomNoBraco('completa', c, 'A')).toEqual({ precoBrutoCentavos: 4490, descontoCentavos: 449, precoLiquidoCentavos: 4041 })
  })
})

describe('server: arm recorded on the order', () => {
  it('flag off: always null and no column at all', () => {
    expect(bracoDoPedido('B', { ligado: false, canal: 'web' })).toBeNull()
    expect(colunasAbPreco(null, false)).toEqual({})
  })
  it('flag on: valid arm kept, invalid or missing = null (A price)', () => {
    expect(bracoDoPedido('B', { ligado: true, canal: 'web' })).toBe('B')
    expect(bracoDoPedido('A', { ligado: true, canal: 'web' })).toBe('A')
    expect(bracoDoPedido('b', { ligado: true, canal: 'web' })).toBeNull()
    expect(bracoDoPedido(undefined, { ligado: true, canal: 'web' })).toBeNull()
    expect(colunasAbPreco('B', true)).toEqual({ ab_preco: 'B' })
    expect(colunasAbPreco(null, true)).toEqual({ ab_preco: null })
  })
  it('the app is always outside the test', () => {
    expect(bracoDoPedido('B', { ligado: true, canal: 'app' })).toBeNull()
  })
})
