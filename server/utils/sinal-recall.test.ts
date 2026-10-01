import { describe, it, expect } from 'vitest'
import { sinalDoRecall, marcaTemRecall, RECALL_VAZIO, RECALL_INDISPONIVEL } from './sinal-recall'
import { marcaTemRecallGratis } from '../../shared/marcas-recall'
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

describe('marcaTemRecall (Toyota/Lexus + Chevrolet/GM + VW + Fiat + Stellantis + Honda + Renault)', () => {
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
  it('Honda: carro e moto, com e sem I/', () => {
    expect(marcaTemRecall('HONDA')).toBe(true)
    expect(marcaTemRecall('I/HONDA')).toBe(true)
    expect(marcaTemRecall('I/HONDA CIVIC')).toBe(true)
    expect(marcaTemRecall('HONDA/CG 160')).toBe(true)
    expect(marcaTemRecall('HONDA/CIVIC EXL CVT')).toBe(true)
    expect(marcaTemRecall('honda')).toBe(true)
    expect(marcaTemRecall('HONDAX')).toBe(false)
  })
  it('Renault: RENAULT, I/RENAULT, RENAULT/<modelo>', () => {
    expect(marcaTemRecall('RENAULT')).toBe(true)
    expect(marcaTemRecall('I/RENAULT')).toBe(true)
    expect(marcaTemRecall('I/RENAULT KOLEOS')).toBe(true)
    expect(marcaTemRecall('RENAULT/KWID ZEN 10MT')).toBe(true)
    expect(marcaTemRecall('RENAULT/SANDERO EXP 16')).toBe(true)
    expect(marcaTemRecall('renault')).toBe(true)
    expect(marcaTemRecall('RENAULTX')).toBe(false)
  })
  it('server e tela usam a MESMA lista (shared/marcas-recall)', () => {
    for (const m of ['TOYOTA', 'I/HONDA', 'RENAULT/KWID', 'NISSAN/KICKS', 'FORD/KA', 'MMC/L200', 'YAMAHA/FACTOR', 'RAMPA']) {
      expect(marcaTemRecall(m)).toBe(marcaTemRecallGratis(m))
    }
  })
  it('outras marcas e vazio nao passam', () => {
    expect(marcaTemRecall('HYUNDAI')).toBe(false)
    expect(marcaTemRecall('YAMAHA/FACTOR')).toBe(false)
    // proximas marcas ainda fora (base nao no ar)
    expect(marcaTemRecall('FORD/KA')).toBe(false)
    expect(marcaTemRecall('NISSAN/KICKS')).toBe(false)
    expect(marcaTemRecall('MMC/L200 TRITON')).toBe(false)
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
