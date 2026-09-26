import { describe, it, expect } from 'vitest'
import { podeReprocessar } from './self-heal-debounce'

describe('podeReprocessar (debounce do self-heal)', () => {
  it('1o disparo por chave passa; repeticao dentro da janela e bloqueada', () => {
    const m = new Map<string, number>()
    expect(podeReprocessar('recall:ABC1D23', 90_000, 1_000, m)).toBe(true)
    expect(podeReprocessar('recall:ABC1D23', 90_000, 1_500, m)).toBe(false) // 0,5s depois
    expect(podeReprocessar('recall:ABC1D23', 90_000, 90_500, m)).toBe(false) // 89,5s depois
  })

  it('depois da janela, dispara de novo', () => {
    const m = new Map<string, number>()
    expect(podeReprocessar('recall:ABC1D23', 90_000, 1_000, m)).toBe(true)
    expect(podeReprocessar('recall:ABC1D23', 90_000, 91_001, m)).toBe(true) // >90s depois
  })

  it('recall e multas da MESMA placa debouncam separado', () => {
    const m = new Map<string, number>()
    expect(podeReprocessar('recall:ABC1D23', 90_000, 1_000, m)).toBe(true)
    expect(podeReprocessar('multas:ABC1D23', 90_000, 1_000, m)).toBe(true) // chave diferente
    expect(podeReprocessar('recall:ABC1D23', 90_000, 2_000, m)).toBe(false) // recall ja disparou
  })

  it('placas diferentes sao independentes', () => {
    const m = new Map<string, number>()
    expect(podeReprocessar('recall:AAA1A11', 90_000, 1_000, m)).toBe(true)
    expect(podeReprocessar('recall:BBB2B22', 90_000, 1_000, m)).toBe(true)
  })

  it('marca o disparo so quando passa (chamada bloqueada nao desliza a janela)', () => {
    const m = new Map<string, number>()
    expect(podeReprocessar('x', 90_000, 1_000, m)).toBe(true) // marca em 1000
    expect(podeReprocessar('x', 90_000, 50_000, m)).toBe(false) // bloqueado; NAO remarca
    // a janela conta do 1o disparo (1000), nao do 50000: em 91_001 passa
    expect(podeReprocessar('x', 90_000, 91_001, m)).toBe(true)
  })
})
