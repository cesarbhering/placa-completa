import { describe, it, expect } from 'vitest'
import { cambioDoNome, cambioDaVersaoFipe, opcoesDeCambio, versaoFipeAutomatica } from './cambio-nome'

describe('cambioDoNome (camada 1)', () => {
  it.each([
    ['CHEVROLET/ONIX 1.4MT LT', 'manual'],
    ['CHEV/ONIX 10TAT PR', 'automatico'],
    ['CHEV/ONIX PLUS 10TMT LT', 'manual'],
    ['HYUNDAI/HB20S 1.6M COMF', 'manual'],
    ['HYUNDAI/CRETA 1.6A ATTITU', 'automatico'],
    ['HYUNDAI/HB20 1.0M SENSE', 'manual'],
    ['VW/POLO TSI AT6', 'automatico'],
    ['I/AUDI A3 SPORTBACK 1.4 TIPTRONIC', 'automatico'],
    ['HONDA/FIT EX CVT', 'automatico'],
    ['FORD/FOCUS SE AT', 'automatico'],
    ['FIAT/ARGO DRIVE 1.3 AMT', 'automatico'],
    ['I/VW JETTA 2.0 TSI DCT', 'automatico'],
    ['RENAULT/SANDERO EXP 16 MT', 'manual'],
    ['TOYOTA/COROLLA XEI AUT', 'automatico'],
  ])('%s -> %s', (desc, esperado) => {
    expect(cambioDoNome(desc)).toBe(esperado)
  })
  it.each([
    'RENAULT/LOGAN AUTH 1.0',       // Authentique nao e automatico
    'RENAULT/SANDERO AUTHENTIQUE',
    'TOYOTA/COROLLA XEI18VVT',      // sem pista
    'NISSAN/MARCH 16SV',
    'FIAT/UNO MILLE 1.0A',          // "A" depois da cilindrada so vale na Hyundai
    'CHEVROLET/CELTA 1.0L LT',
    '',
  ])('%s -> sem pista', (desc) => {
    expect(cambioDoNome(desc)).toBeNull()
  })
  it('as duas coisas no mesmo nome: nao decide', () => {
    expect(cambioDoNome('VW/GOL MT AT')).toBeNull()
  })
})

describe('versoes FIPE', () => {
  it('automatizados contam como automatico', () => {
    for (const m of ['500 Cult 1.4 Flex 8V EVO Dualogic', 'up! move 1.0 I-Motion', 'Corsa 1.4 Easytronic', 'Fit EX CVT', 'A3 Tiptronic']) expect(versaoFipeAutomatica(m), m).toBe(true)
    expect(cambioDaVersaoFipe('Corolla XEi 1.8/1.8 Flex 16V Mec.')).toBe('manual')
    expect(cambioDaVersaoFipe('Corolla XEi 1.8/1.8 Flex 16V Aut.')).toBe('automatico')
    expect(cambioDaVersaoFipe('Corolla XEi 1.8')).toBeNull()
  })
  it('opcoesDeCambio: so quando sao exatamente uma manual e uma automatica', () => {
    const a = { modelo: 'MARCH SV 1.6 16V FlexStart 5p Aut.' }, m = { modelo: 'MARCH SV 1.6 16V FlexStart 5p Mec.' }
    expect(opcoesDeCambio([a, m])).toEqual({ manual: m, automatico: a })
    expect(opcoesDeCambio([a, m, { modelo: 'MARCH SL 1.6 Aut.' }])).toBeNull()
    expect(opcoesDeCambio([a, { modelo: 'MARCH SL 1.6 Aut.' }])).toBeNull()
  })
})
