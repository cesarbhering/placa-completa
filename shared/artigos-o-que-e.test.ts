import { describe, it, expect } from 'vitest'
import { ARTIGOS, LEVANTAMENTO } from './artigos-o-que-e'

describe('artigos O que e', () => {
  it('5 artigos com rota esperada', () => {
    expect(ARTIGOS.map((a) => a.slug)).toEqual(['renavam', 'gravame', 'intencao-de-gravame', 'renajud', 'multas-renainf'])
  })
  for (const a of ARTIGOS) {
    const tudo = JSON.stringify(a)
    it(`${a.slug}: title e description no padrao`, () => {
      expect((a.title + ' | PlacaCompleta').length).toBeLessThanOrEqual(70)
      expect(a.title).not.toMatch(/gr[aá]tis/i)
      expect(a.description.length).toBeGreaterThanOrEqual(110)
      expect(a.description.length).toBeLessThanOrEqual(160)
    })
    it(`${a.slug}: regras de copy`, () => {
      expect(tudo).not.toContain('—')
      expect(tudo).not.toMatch(/infosimples|wdapi|apiplacas|serpro/i)
      expect(tudo).not.toMatch(/R\$\s*\d/)
      expect(a.lead.length).toBeGreaterThan(120)
      expect(a.faq.length).toBeGreaterThanOrEqual(3)
      expect(a.dado.texto).toContain(LEVANTAMENTO.rotulo)
    })
  }
  it('N do levantamento >= 30 (minimo pra publicar %)', () => {
    expect(LEVANTAMENTO.n).toBeGreaterThanOrEqual(30)
  })
})
