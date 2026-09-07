import { describe, it, expect } from 'vitest'
import { camposLazyPendentes, marcadorDe, faltaPlanta } from './relatorio-lazy-fill'

const snapBase = (extra: any = {}) => ({
  consulta: { placa: 'CSD0B36', response: [{ chassi: '9BGKS48F08G123456', anoModelo: 2008 }] },
  camposRestantes: 0,
  valorCusto: { fipe: 1 },
  chassiOrigem: null,
  historicoLeilao: { nivel: 'nenhum' },
  ...extra,
})

describe('campos que valem uma segunda tentativa', () => {
  it('chassi presente e origem vazia: tenta de novo', () => {
    expect(camposLazyPendentes(snapBase(), 'completa')).toEqual(['chassiOrigem'])
  })

  it('nao tenta duas vezes: o marcador segura', () => {
    const snap = snapBase({ [marcadorDe('chassiOrigem')]: '2026-09-07T15:00:00.000Z' })
    expect(camposLazyPendentes(snap, 'completa')).toEqual([])
  })

  it('campo ja preenchido nao e tocado', () => {
    const snap = snapBase({ chassiOrigem: { fabricante: 'General Motors do Brasil' } })
    expect(camposLazyPendentes(snap, 'completa')).toEqual([])
  })

  it('sem chassi de 17 caracteres nao ha o que decodificar', () => {
    const snap = snapBase({ consulta: { placa: 'X', response: [{ chassi: '123' }] } })
    expect(camposLazyPendentes(snap, 'completa')).toEqual([])
  })

  it('basica nao compra origem do chassi nem historico de leilao', () => {
    const snap = snapBase({ valorCusto: null, historicoLeilao: null })
    expect(camposLazyPendentes(snap, 'basica')).toEqual(['valorCusto'])
  })

  it('varios buracos de uma vez', () => {
    const snap = snapBase({ valorCusto: null, historicoLeilao: null })
    expect(camposLazyPendentes(snap, 'completa')).toEqual(['chassiOrigem', 'historicoLeilao', 'valorCusto'])
  })

  it('snapshot sem consulta nao gera tentativa', () => {
    expect(camposLazyPendentes({ consulta: null }, 'completa')).toEqual([])
    expect(camposLazyPendentes(null, 'completa')).toEqual([])
  })

  it('resposta achatada em objeto (nao array) tambem e lida', () => {
    const snap = snapBase({ consulta: { placa: 'X', response: { chassi: '9BGKS48F08G123456' } } })
    expect(camposLazyPendentes(snap, 'completa')).toEqual(['chassiOrigem'])
  })
})

describe('planta em relatorio antigo', () => {
  const comOrigem = (co: any, extra: any = {}) => ({
    consulta: { placa: 'X', response: [{ chassi: '9BWAA05U0CT015779' }] },
    chassiOrigem: co, valorCusto: {}, historicoLeilao: {}, ...extra,
  })

  it('origem sem planta: vale um decode novo', () => {
    expect(faltaPlanta(comOrigem({ fabricante: 'Volkswagen', planta: null }))).toBe(true)
  })

  it('origem que ja passou pelo decode novo nao repete', () => {
    expect(faltaPlanta(comOrigem({ plantaDetalhe: null }))).toBe(false)
    expect(faltaPlanta(comOrigem({ fabricante: 'VW' }, { planta_em: '2026-09-07T12:00:00Z' }))).toBe(false)
  })

  it('sem origem nenhuma, quem resolve e o lazy fill de campo vazio', () => {
    expect(faltaPlanta(comOrigem(null))).toBe(false)
  })
})
