import { describe, it, expect } from 'vitest'
import { PLANOS, RECURSOS } from './planos'
import { OFERTA_FIPE_POR_PLACA, precoOfertaFipePorPlaca } from './oferta-fipe-por-placa'

describe('offer card on the FIPE by plate page', () => {
  it('offers the basic plan at its table price', () => {
    expect(OFERTA_FIPE_POR_PLACA.plano).toBe('basica')
    expect(precoOfertaFipePorPlaca()).toBe('R$ 29,90')
    expect(precoOfertaFipePorPlaca()).toBe('R$ ' + (PLANOS.basica.valorCentavos / 100).toFixed(2).replace('.', ','))
  })

  it('only lists items the basic plan delivers', () => {
    for (const item of OFERTA_FIPE_POR_PLACA.itens) {
      expect(item.recursos.length).toBeGreaterThan(0)
      for (const label of item.recursos) {
        const recurso = RECURSOS.find((r) => r.label === label)
        expect(recurso, `${item.texto}: feature "${label}" not found in RECURSOS`).toBeDefined()
        expect(recurso!.planos, `${item.texto}: "${label}" is not in the basic plan`).toContain('basica')
      }
    }
  })

  it('keeps the copy rules: no dash, no data source names', () => {
    const textos = [OFERTA_FIPE_POR_PLACA.titulo, OFERTA_FIPE_POR_PLACA.texto, OFERTA_FIPE_POR_PLACA.botao, ...OFERTA_FIPE_POR_PLACA.itens.map((i) => i.texto)]
    for (const t of textos) {
      expect(t).not.toMatch(/[—–]/)
      expect(t).not.toMatch(/senatran|detran/i)
    }
  })
})
