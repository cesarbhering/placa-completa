import { describe, it, expect } from 'vitest'
import { PROVA_SOCIAL } from './prova-social'
import { DESCRICAO_HOME_BUSCA, GANCHO_CONSULTA, tituloCapital, descricaoCapital, descricaoTabelaFipePorPlaca } from './seo-meta'

describe('growth nov/2026', () => {
  it('prova social sem fonte e sem travessao', () => {
    expect(PROVA_SOCIAL).toMatch(/40 mil consultas/)
    expect(PROVA_SOCIAL).not.toMatch(/—|SENATRAN|DETRAN|SERPRO/i)
  })
  it('home: busca placa na description, sem grátis, ate 155', () => {
    expect(DESCRICAO_HOME_BUSCA).toMatch(/Busca placa/)
    expect(DESCRICAO_HOME_BUSCA).not.toMatch(/gr[aá]tis/i)
    expect(DESCRICAO_HOME_BUSCA.length).toBeLessThanOrEqual(155)
  })
  it('capitais: buscar placa em Fortaleza e Brasilia, gancho na description', () => {
    expect(tituloCapital('Fortaleza', 'CE')).toMatch(/^Buscar Placa em Fortaleza/)
    expect(tituloCapital('Brasília', 'DF')).toMatch(/^Buscar Placa em Brasília/)
    expect(tituloCapital('Recife', 'PE')).not.toMatch(/Buscar/)
    expect(descricaoCapital('Natal', 'RN')).toContain(GANCHO_CONSULTA)
    expect(GANCHO_CONSULTA).not.toMatch(/gr[aá]tis/i)
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

// Regra do Cesar (01/out): "grátis" nunca em title, meta, OG ou JSON-LD.
import { states } from '../data/states'
import { capitals } from '../data/capitals'
import { tituloEstado, descricaoEstado } from './estado-seo'
import { CONTENT } from '../composables/useSiteVariant'
describe('sem "grátis" nas superficies de busca', () => {
  it('estados, capitais, FIPE e home', () => {
    const textos: string[] = [DESCRICAO_HOME_BUSCA, descricaoTabelaFipePorPlaca('novembro', 2026), CONTENT.default.metaTitle]
    for (const s of Object.values(states) as any[]) textos.push(tituloEstado(s.uf, s.name), descricaoEstado(s.uf, s.name))
    for (const c of Object.values(capitals) as any[]) { const uf = (states as any)[c.stateSlug].uf; textos.push(tituloCapital(c.name, uf), descricaoCapital(c.name, uf)) }
    for (const t of textos) expect(t).not.toMatch(/gr[aá]tis/i)
    for (const c of Object.values(capitals) as any[]) { const d = descricaoCapital(c.name, (states as any)[c.stateSlug].uf); expect(d.length).toBeGreaterThanOrEqual(110); expect(d.length).toBeLessThanOrEqual(155) }
  })
})
