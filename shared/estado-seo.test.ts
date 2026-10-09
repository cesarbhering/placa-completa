import { describe, it, expect } from 'vitest'
import { states } from '../data/states'
import { tituloEstado, descricaoEstado } from './estado-seo'

describe('SEO /consultar-placa/[estado]', () => {
  it('RJ no formato pedido', () => {
    expect(tituloEstado('RJ', 'Rio de Janeiro')).toBe('Consulta Placa RJ pelo DETRAN e FIPE: Rio de Janeiro')
  })
  it('preposicao', () => {
    expect(descricaoEstado('RJ', 'Rio de Janeiro')).toMatch(/^Consulta de placa de veículo do Rio de Janeiro \(RJ\)/)
    expect(descricaoEstado('BA', 'Bahia')).toMatch(/veículo da Bahia/)
    expect(descricaoEstado('AL', 'Alagoas')).toMatch(/veículo de Alagoas/)
    expect(descricaoEstado('SC', 'Santa Catarina')).toMatch(/veículo de Santa Catarina/)
    expect(descricaoEstado('DF', 'Distrito Federal')).toMatch(/veículo do Distrito Federal/)
  })
  for (const s of Object.values(states as Record<string, { uf: string; name: string }>)) {
    it(`${s.uf}: tamanho e regras`, () => {
      const t = tituloEstado(s.uf, s.name), d = descricaoEstado(s.uf, s.name)
      expect(t.length).toBeGreaterThanOrEqual(50)
      expect(t.length).toBeLessThanOrEqual(60)
      expect(d.length).toBeLessThanOrEqual(160)
      for (const x of [t, d]) expect(x).not.toMatch(/gr[aá]tis|—|oficial do DETRAN|somos o DETRAN/i)
    })
  }
})
