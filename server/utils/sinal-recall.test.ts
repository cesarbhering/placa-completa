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

describe('marcaTemRecall (Toyota/Lexus + Chevrolet/GM + VW + Fiat + Stellantis)', () => {
  it('Toyota, Lexus, Chevrolet, GM, VW, Fiat e Stellantis passam', () => {
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
    // Stellantis: Peugeot/Citroen/Jeep/RAM/Dodge + variantes SENATRAN
    expect(marcaTemRecall('PEUGEOT/208')).toBe(true)
    expect(marcaTemRecall('I/PEUGEOT 2008')).toBe(true)
    expect(marcaTemRecall('CITROEN/C3')).toBe(true)
    expect(marcaTemRecall('CITROËN C4')).toBe(true) // com acento
    expect(marcaTemRecall('JEEP/RENEGADE')).toBe(true)
    expect(marcaTemRecall('I/JEEP COMPASS')).toBe(true)
    expect(marcaTemRecall('RAM')).toBe(true)
    expect(marcaTemRecall('I/RAM 2500')).toBe(true)
    expect(marcaTemRecall('DODGE/JOURNEY')).toBe(true)
  })
  it('outras marcas e vazio nao passam', () => {
    expect(marcaTemRecall('HONDA')).toBe(false)
    expect(marcaTemRecall('')).toBe(false)
    expect(marcaTemRecall(null)).toBe(false)
    // nao casar 'vw' dentro de outra palavra
    expect(marcaTemRecall('BMWX')).toBe(false)
    // RAM e curto: \bRAM\b nao pode casar no meio de palavra
    expect(marcaTemRecall('RAMPA')).toBe(false)
    expect(marcaTemRecall('TRAMONTINA')).toBe(false)
    expect(marcaTemRecall('GRAN')).toBe(false)
  })
})
