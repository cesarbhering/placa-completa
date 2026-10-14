import { describe, expect, it } from 'vitest'
import { sanearRecallEua, dataEua, componenteEua, ROTULO_RECALL_EUA } from './recall-eua'

describe('recall EUA (NHTSA)', () => {
  it('sem campo ou sem campanha: null', () => {
    expect(sanearRecallEua(null)).toBeNull()
    expect(sanearRecallEua({ campanhas: [] })).toBeNull()
    expect(sanearRecallEua({ campanhas: [{ numero: '' }] })).toBeNull()
  })
  it('saneia formato e datas', () => {
    const r = sanearRecallEua({ rotulo: '', marca: 'FORD', modelo: 'FUSION', ano: '2014', campanhas: [
      { numero: '14V001000', componente: 'AIR BAGS:FRONTAL', resumo: 'Some  text', data: '21/03/2014' },
      { numero: '15V002000', componente: '', resumo: '', data: '2015-05-02T00:00:00' },
    ] })!
    expect(r.rotulo).toBe(ROTULO_RECALL_EUA)
    expect(r.ano).toBe(2014)
    expect(r.campanhas.map((c) => c.data)).toEqual(['21/03/2014', '02/05/2015'])
    expect(r.campanhas[0].resumo).toBe('Some text')
  })
  it('data e componente', () => {
    expect(dataEua('x')).toBeNull()
    expect(componenteEua('AIR BAGS:FRONTAL')).toBe('AIR BAGS · FRONTAL')
    expect(componenteEua('')).toBe('Componente não informado')
  })
})
