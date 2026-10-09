import { describe, it, expect } from 'vitest'
import { fipeEIncerta } from './fipe-incerta'

const TRACKERS = [
  { codigo_fipe: '004526-8', modelo: 'TRACKER 1.0 Turbo 12V Flex Aut.', valor: 107653 },
  { codigo_fipe: '004522-5', modelo: 'TRACKER LT 1.0 Turbo 12V Flex Aut.', valor: 122041 },
  { codigo_fipe: '004532-2', modelo: 'TRACKER LTZ 1.0 Turbo 12V Flex Aut.', valor: 137281 },
]

describe('fipeEIncerta', () => {
  it('ambiguo ou confianca baixa', () => {
    expect(fipeEIncerta({ fipeCandidato: { decididoPor: 'ambiguo', candidatos: TRACKERS } })).toBe(true)
    expect(fipeEIncerta({ fipeCandidato: { decididoPor: 'haiku', confianca: 'baixa', candidatos: TRACKERS } })).toBe(true)
  })
  it('TTR6F65: nao localizado com confianca media e 3 versoes vira versao nao identificada', () => {
    expect(fipeEIncerta({ fipe: null, fipeNaoLocalizado: true, fipeCandidato: { decididoPor: 'haiku', confianca: 'media', candidatos: TRACKERS } })).toBe(true)
  })
  it('nao localizado com uma versao so continua "nao localizado"', () => {
    expect(fipeEIncerta({ fipe: null, fipeNaoLocalizado: true, fipeCandidato: { decididoPor: 'haiku', confianca: 'media', candidatos: [TRACKERS[0]] } })).toBe(false)
  })
  it('decisao confiante com valor nao e incerta', () => {
    expect(fipeEIncerta({ fipe: 'R$ 1,00', fipeCandidato: { decididoPor: 'regra', confianca: 'alta', candidatos: [TRACKERS[0]] } })).toBe(false)
    expect(fipeEIncerta(null)).toBe(false)
  })
})
