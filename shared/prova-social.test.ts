import { describe, it, expect } from 'vitest'
import { PROVA_SOCIAL } from './prova-social'
import { DESCRICAO_HOME_BUSCA, GANCHO_CONSULTA, tituloCapital, descricaoCapital, descricaoTabelaFipePorPlaca } from './seo-meta'

describe('growth nov/2026', () => {
  it('prova social sem fonte e sem travessao', () => {
    expect(PROVA_SOCIAL).toMatch(/40 mil consultas/)
    expect(PROVA_SOCIAL).not.toMatch(/—|SENATRAN|DETRAN|SERPRO/i)
  })
  it('home: grátis e busca placa na description, ate 155', () => {
    expect(DESCRICAO_HOME_BUSCA).toMatch(/placa grátis/)
    expect(DESCRICAO_HOME_BUSCA).toMatch(/Busca placa/)
    expect(DESCRICAO_HOME_BUSCA.length).toBeLessThanOrEqual(155)
  })
  it('capitais: buscar placa em Fortaleza e Brasilia, gancho na description', () => {
    expect(tituloCapital('Fortaleza', 'CE')).toMatch(/^Buscar Placa em Fortaleza/)
    expect(tituloCapital('Brasília', 'DF')).toMatch(/^Buscar Placa em Brasília/)
    expect(tituloCapital('Recife', 'PE')).not.toMatch(/Buscar/)
    expect(descricaoCapital('Natal', 'RN')).toContain(GANCHO_CONSULTA)
    expect(descricaoCapital('Florianópolis', 'SC').length).toBeLessThanOrEqual(155)
  })
  it('tabela FIPE pela placa na description, ate 155 em qualquer mes', () => {
    for (const m of ['fevereiro', 'novembro']) {
      const d = descricaoTabelaFipePorPlaca(m, 2026)
      expect(d).toMatch(/tabela FIPE pela placa/)
      expect(d.length).toBeLessThanOrEqual(155)
    }
  })
})
