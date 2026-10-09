import { describe, it, expect } from 'vitest'
import { validarEscolha, aplicarEscolha, MAX_TROCAS } from './fipe-escolha'
import { fipeEIncerta } from '../../shared/fipe-incerta'

const SNAP = {
  valorCusto: {
    fipe: null, fipeNaoLocalizado: true,
    fipeCandidato: { decididoPor: 'ambiguo', confianca: 'baixa', candidatos: [
      { codigo_fipe: '025311-1', modelo: 'MARCH SV 1.6 16V FlexStart 5p Aut.', valor: 52000 },
      { codigo_fipe: '025310-3', modelo: 'MARCH SV 1.6 16V FlexStart 5p Mec.', valor: 48000 },
    ] },
  },
}

describe('validarEscolha', () => {
  it('versao da shortlist de uma FIPE em duvida', () => {
    expect(validarEscolha(SNAP, '025310-3')).toMatchObject({ ok: true, candidato: { codigo_fipe: '025310-3', valor: 48000 } })
  })
  it('recusa codigo fora da lista, invalido ou FIPE ja decidida', () => {
    expect(validarEscolha(SNAP, '999999-9')).toMatchObject({ ok: false, motivo: 'fora da lista' })
    expect(validarEscolha(SNAP, '../x')).toMatchObject({ ok: false })
    const decidida = { valorCusto: { fipe: 'R$ 1', fipeCandidato: { decididoPor: 'regra', confianca: 'alta', candidatos: SNAP.valorCusto.fipeCandidato.candidatos } } }
    expect(validarEscolha(decidida, '025310-3')).toMatchObject({ ok: false, motivo: 'fipe ja decidida' })
  })
  it('depois de escolher, pode trocar, ate o teto', () => {
    const escolhido = { valorCusto: { ...SNAP.valorCusto, fipe: 'R$ 48.000,00', fipeNaoLocalizado: undefined, fipeEscolhaCliente: { codigo_fipe: '025310-3', trocas: 0 } } }
    expect(validarEscolha(escolhido, '025311-1').ok).toBe(true)
    const noTeto = { valorCusto: { ...escolhido.valorCusto, fipeEscolhaCliente: { codigo_fipe: '025310-3', trocas: MAX_TROCAS } } }
    expect(validarEscolha(noTeto, '025311-1')).toMatchObject({ ok: false, motivo: 'limite de trocas' })
  })
})

describe('aplicarEscolha', () => {
  it('valor da versao escolhida, shortlist preservada, cambio gravado', () => {
    const novo = { fipe: 'R$ 48.000,00', fipeModelo: 'MARCH SV 1.6 16V FlexStart 5p Mec.', fipeCodigo: '025310-3', historico: [{ label: 'Jan/25', price: 1 }, { label: 'Fev/25', price: 2 }], quedaAno: 5, seguroAnual: 2000, fipeCandidato: null, fipeNaoLocalizado: true }
    const vc = aplicarEscolha(SNAP.valorCusto, novo, { codigo_fipe: '025310-3', modelo: 'MARCH SV 1.6 16V FlexStart 5p Mec.' }, new Date('2026-10-09T12:00:00Z'))
    expect(vc.fipe).toBe('R$ 48.000,00')
    expect(vc.fipeCandidato).toEqual(SNAP.valorCusto.fipeCandidato)
    expect(vc.fipeNaoLocalizado).toBeUndefined()
    expect(vc.fipeEscolhaCliente).toEqual({ codigo_fipe: '025310-3', modelo: 'MARCH SV 1.6 16V FlexStart 5p Mec.', cambio: 'manual', em: '2026-10-09T12:00:00.000Z', trocas: 0 })
    expect(fipeEIncerta(vc)).toBe(false)
    const troca = aplicarEscolha(vc, { ...novo, fipe: 'R$ 52.000,00' }, { codigo_fipe: '025311-1', modelo: 'MARCH SV 1.6 16V FlexStart 5p Aut.' })
    expect(troca.fipeEscolhaCliente).toMatchObject({ cambio: 'automatico', trocas: 1 })
  })
  it('sem escolha, continua em duvida', () => {
    expect(fipeEIncerta(SNAP.valorCusto)).toBe(true)
  })
})
