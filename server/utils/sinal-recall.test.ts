import { describe, it, expect } from 'vitest'
import { sinalDoRecall, marcaTemRecall, RECALL_VAZIO, RECALL_INDISPONIVEL } from './sinal-recall'
import type { RecallResposta } from './recall-toyota'

const resp = (matches: any[]): RecallResposta => ({ matches })

describe('sinalDoRecall', () => {
  it('sem resposta (null) -> INDISPONIVEL (nao sabemos)', () => {
    expect(sinalDoRecall(null)).toEqual(RECALL_INDISPONIVEL)
    expect(sinalDoRecall(undefined)).toEqual(RECALL_INDISPONIVEL)
    expect(sinalDoRecall({} as any)).toEqual(RECALL_INDISPONIVEL) // sem matches[]
  })
  it('respondeu com zero matches -> VAZIO (nao consta)', () => {
    expect(sinalDoRecall(resp([]))).toEqual(RECALL_VAZIO)
  })
  it('so suave -> consta suave', () => {
    expect(sinalDoRecall(resp([{ nivel: 'suave' }]))).toEqual({ consta: true, nivel: 'suave' })
  })
  it('firme tem precedencia sobre suave', () => {
    expect(sinalDoRecall(resp([{ nivel: 'suave' }, { nivel: 'firme' }]))).toEqual({ consta: true, nivel: 'firme' })
  })
})

describe('marcaTemRecall (Toyota/Lexus + Chevrolet/GM + VW + Fiat)', () => {
  it('Toyota, Lexus, Chevrolet, GM, VW e Fiat passam', () => {
    expect(marcaTemRecall('TOYOTA')).toBe(true)
    expect(marcaTemRecall('toyota')).toBe(true)
    expect(marcaTemRecall('Lexus')).toBe(true)
    expect(marcaTemRecall('CHEVROLET')).toBe(true)
    expect(marcaTemRecall('GM')).toBe(true)
    expect(marcaTemRecall('GM - CHEVROLET')).toBe(true)
    expect(marcaTemRecall('General Motors')).toBe(true)
    // variantes VW que o SENATRAN manda
    expect(marcaTemRecall('VOLKSWAGEN')).toBe(true)
    expect(marcaTemRecall('VW')).toBe(true)
    expect(marcaTemRecall('VW/GOL')).toBe(true)
    expect(marcaTemRecall('I/VW FOX')).toBe(true)
    // variantes Fiat
    expect(marcaTemRecall('FIAT')).toBe(true)
    expect(marcaTemRecall('FIAT/PALIO')).toBe(true)
    expect(marcaTemRecall('I/FIAT 500')).toBe(true)
  })
  it('outras marcas e vazio nao passam', () => {
    expect(marcaTemRecall('HONDA')).toBe(false)
    expect(marcaTemRecall('')).toBe(false)
    expect(marcaTemRecall(null)).toBe(false)
    // nao casar 'vw' dentro de outra palavra
    expect(marcaTemRecall('BMWX')).toBe(false)
  })
})
