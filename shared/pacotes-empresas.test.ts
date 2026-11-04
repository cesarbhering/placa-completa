import { describe, it, expect } from 'vitest'
import { PACOTES_EMPRESAS, precoPorConsulta, economiaPacote } from './pacotes-empresas'
import { PLANOS } from './planos'
import { VOLUMES_EMPRESA } from './empresas'

describe('pacotes para empresas', () => {
  it('precos fixados pelo Cesar (04/nov)', () => {
    const [p10, p50] = PACOTES_EMPRESAS
    expect(p10).toMatchObject({ consultas: 10, totalCentavos: 34900 })
    expect(p50).toMatchObject({ consultas: 50, totalCentavos: 149000 })
    expect(precoPorConsulta(p10)).toBe(3490)
    expect(precoPorConsulta(p50)).toBe(2980)
  })
  it('economia contra a Completa avulsa', () => {
    expect(PLANOS.completa.valorCentavos).toBe(4490)
    expect(economiaPacote(PACOTES_EMPRESAS[0])).toEqual({ centavos: 10000, pct: 22, avulsoCentavos: 44900 })
    expect(economiaPacote(PACOTES_EMPRESAS[1])).toEqual({ centavos: 75500, pct: 34, avulsoCentavos: 224500 })
  })
  it('todo pacote sai mais barato por consulta que o avulso e aponta pra uma faixa do formulario', () => {
    for (const p of PACOTES_EMPRESAS) {
      expect(precoPorConsulta(p)).toBeLessThan(PLANOS.completa.valorCentavos)
      expect(VOLUMES_EMPRESA as readonly string[]).toContain(p.volumeFaixa)
    }
  })
})
