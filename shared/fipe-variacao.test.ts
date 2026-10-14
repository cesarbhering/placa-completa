import { describe, expect, it } from 'vitest'
import { mesDoRotulo, variacaoFipe, fipeNoMes } from './fipe-variacao'

const serie = (de: [number, number], n: number, f: (i: number) => number) => {
  const M = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return Array.from({ length: n }, (_, i) => {
    const t = de[0] * 12 + de[1] + i
    return { label: `${M[t % 12]}/${String(Math.floor(t / 12)).slice(2)}`, price: f(i) }
  })
}

describe('variacao da FIPE', () => {
  it('rotulo', () => {
    expect(mesDoRotulo('Set/26')).toBe(2026 * 12 + 8)
    expect(mesDoRotulo('xx')).toBeNull()
  })
  it('12 e 24 meses a partir do ultimo ponto', () => {
    const h = serie([2021, 0], 69, (i) => 30000 + i * 100) // Jan/21 .. Set/26
    const v12 = variacaoFipe(h, 12)!
    expect(v12.deRotulo).toBe('Set/25')
    expect(v12.delta).toBe(1200)
    const v24 = variacaoFipe(h, 24)!
    expect(v24.deRotulo).toBe('Set/24')
  })
  it('serie curta: null', () => {
    expect(variacaoFipe(serie([2026, 0], 6, () => 1000), 12)).toBeNull()
  })
  it('FIPE no mes do evento', () => {
    const h = serie([2021, 0], 69, (i) => 30000 + i * 100)
    expect(fipeNoMes(h, '2023-06-15')).toEqual({ price: 30000 + 29 * 100, label: 'Jun/23' })
    expect(fipeNoMes(h, '2019-01-01')).toBeNull()
  })
})
