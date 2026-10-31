import { describe, it, expect } from 'vitest'
import { cambioPorSufixo, cambioDoNome, cambioDaVersaoFipe, opcoesDeCambio, versaoFipeAutomatica } from './cambio-nome'

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
    // Renault: cambio colado no fim (A = automatico, M = manual)
    ['RENAULT/DUSTER 20 D 4X2A', 'automatico'],
    ['RENAULT/SANDERO PR1616VA', 'automatico'],
    ['I/RENAULT FLUENCE DYN20A', 'automatico'],
    ['RENAULT/CAPTUR INTEN 16A', 'automatico'],
    ['RENAULT/CAPTUR ZEN 16M', 'manual'],
    ['RENAULT/OROCH INTENSE16M', 'manual'],
  ])('%s -> %s', (desc, esperado) => {
    expect(cambioDoNome(desc)).toBe(esperado)
  })
  it.each([
    'RENAULT/LOGAN AUTH 1.0',       // Authentique nao e automatico
    'RENAULT/SANDERO AUTHENTIQUE',
    // Renault: AUT e Authentique, nao automatico (OUQ8G18, 15/out)
    'RENAULT/CLIO AUT 10 16VS',
    'RENAULT/LOGAN AUT 1016V',
    'I/RENAULT CLIO AUT 10H3P',
    'RENAULT/DUSTER 16 D 4X2',
    'RENAULT/MASTER REVES A',       // A solto nao e cambio
    'FIAT/STRADA 16A',              // colado so vale na Renault
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

describe('MT/AT soltos e colados ao motor (21/out/2026, BCK2C28)', () => {
  it('decide o cambio', async () => {
    const { cambioDoNome } = await import('./cambio-nome')
    expect(cambioDoNome('CHEV/PRISMA 1.4MT LT')).toBe('manual')
    expect(cambioDoNome('CHEV/ONIX 1.0AT LTZ')).toBe('automatico')
    expect(cambioDoNome('CHEV/CRUZE 1.8MT LT')).toBe('manual')
    expect(cambioDoNome('HONDA/CIVIC 16V AT6')).toBe('automatico')
    expect(cambioDoNome('CHEV/ONIX 1.0 TAT')).toBe('automatico')
    expect(cambioDoNome('CHEV/ONIX 1.0 TMT')).toBe('manual')
    expect(cambioDoNome('CHEV/PRISMA LT MT')).toBe('manual')
    expect(cambioDoNome('FIAT/PALIO ATTRACTIV')).toBeNull()
  })
})

describe('opcoesDeCambio com a manual sem "Mec." (NJD2I54, BCK2C28)', () => {
  it('par so de cambio, manual sem marca: reconhece', async () => {
    const { opcoesDeCambio } = await import('./cambio-nome')
    const par = opcoesDeCambio([{ modelo: 'Hilux CD SRV D4-D 4x4 3.0  TDI Dies' }, { modelo: 'Hilux CD SRV D4-D 4x4 3.0 TDI Diesel Aut' }])
    expect(par?.manual.modelo).toBe('Hilux CD SRV D4-D 4x4 3.0  TDI Dies')
    expect(par?.automatico.modelo).toBe('Hilux CD SRV D4-D 4x4 3.0 TDI Diesel Aut')
    expect(opcoesDeCambio([{ modelo: 'PRISMA Sed. LT 1.4 8V FlexPower 4p' }, { modelo: 'PRISMA Sed. LT 1.4 8V FlexPower 4p Aut.' }])).not.toBeNull()
  })
  it('versoes diferentes alem do cambio: nao e duvida so de cambio', async () => {
    const { opcoesDeCambio } = await import('./cambio-nome')
    expect(opcoesDeCambio([{ modelo: 'Hilux CD SR D4-D 4x4 3.0 TDI Dies' }, { modelo: 'Hilux CD SRV D4-D 4x4 3.0 TDI Diesel Aut' }])).toBeNull()
    expect(opcoesDeCambio([{ modelo: 'ONIX HATCH LT 1.0 Flex' }, { modelo: 'ONIX HATCH LTZ 1.4 Flex Aut.' }])).toBeNull()
  })
})

describe('sufixo "A"/"M" no fim do nome (Cesar, 23/out/2026)', () => {
  it('TST1A23: "C3 PICASSO EXC A" e automatico', () => {
    expect(cambioPorSufixo('CITROEN/C3 PICASSO EXC A')).toBe('automatico')
    expect(cambioDoNome('CITROEN/C3 PICASSO EXC A')).toBe('automatico')
  })
  it('"TRACKER T A" e automatico; "HB20 1.0M 1.0 M" e manual', () => {
    expect(cambioDoNome('CHEV/TRACKER T A')).toBe('automatico')
    expect(cambioPorSufixo('HYUNDAI/HB20 1.0M 1.0 M')).toBe('manual')
    expect(cambioDoNome('HYUNDAI/HB20 1.0M 1.0 M')).toBe('manual')
    expect(cambioDoNome('PEUGEOT/208 GRIFFE A')).toBe('automatico')
  })
  it('"CLASSE A" da Mercedes NAO e automatico', () => {
    expect(cambioDoNome('M.BENZ/CLASSE A')).toBeNull()
    expect(cambioDoNome('MERCEDES-BENZ/CLASSE A')).toBeNull()
    expect(cambioDoNome('I/M.BENZ A 200 CLASSE A')).toBeNull()
    expect(cambioDoNome('MERCEDES-BENZ/CLASSE A 160')).toBeNull()
  })
  it('letra que nao e o ultimo token, nome curto ou BMW M nao contam', () => {
    expect(cambioPorSufixo('CITROEN/C3 A EXC')).toBeNull()
    expect(cambioPorSufixo('FIAT/UNO A')).toBeNull()
    expect(cambioPorSufixo('BMW/X5 XDRIVE M')).toBeNull()
    expect(cambioPorSufixo('I/BMW X5 M')).toBeNull()
  })
  it('semSufixo ignora a regra (pra saber se foi ela que decidiu)', () => {
    expect(cambioDoNome('CITROEN/C3 PICASSO EXC A', { semSufixo: true })).toBeNull()
    expect(cambioDoNome('HYUNDAI/HB20 1.0M 1.0 M', { semSufixo: true })).toBe('manual')
  })
})
