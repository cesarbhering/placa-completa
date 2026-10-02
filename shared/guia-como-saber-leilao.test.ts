import { describe, it, expect } from 'vitest'
import { PASSOS, SINAIS, FAQ_COMO_SABER, LEVANTAMENTO_SINAL } from './guia-como-saber-leilao'

describe('guia como saber se o carro e de leilao', () => {
  it('5 passos, 5 perguntas, N >= 30', () => {
    expect(PASSOS.length).toBe(5)
    expect(FAQ_COMO_SABER.length).toBe(5)
    expect(LEVANTAMENTO_SINAL.n).toBeGreaterThanOrEqual(30)
    expect(LEVANTAMENTO_SINAL.pct).toBe(`${(100 * LEVANTAMENTO_SINAL.positivos / LEVANTAMENTO_SINAL.n).toFixed(1).replace('.', ',')}%`)
  })
  it('regras de copy', () => {
    const tudo = JSON.stringify({ PASSOS, SINAIS, FAQ_COMO_SABER })
    expect(tudo).not.toMatch(/—|R\$\s*\d|\d+\s*%|infosimples|wdapi|apiplacas/i)
  })
})
