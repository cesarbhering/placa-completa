import { describe, it, expect } from 'vitest'
import { ALIQUOTAS_IPVA, CONFERIDO_EM, aliquotaIpvaDoVeiculo, faixaAliquotaIpva, aliquotaConferida, combustivelIpva, faixasDecididas, veiculoIpvaDoRegistro, ehUtilitarioDeCarga } from './ipva-uf'
import { calcularICV5 } from '../server/utils/icv5'

const flex = { combustivel: 'comum' as const }

describe('IPVA rate table', () => {
  it('has the 27 states', () => {
    expect(Object.keys(ALIQUOTAS_IPVA).sort()).toHaveLength(27)
  })
  it('every checked state names an official source and the check date', () => {
    for (const [uf, r] of Object.entries(ALIQUOTAS_IPVA)) {
      if (!r.fonte) continue
      expect(r.fonte.url, uf).toMatch(/^https?:\/\/[^/]+\.(gov\.br|leg\.br)\//)
      expect(r.fonte.nome.trim().length, uf).toBeGreaterThan(5)
      expect(r.conferidoEm, uf).toBe(CONFERIDO_EM)
    }
  })
  it('every state has a single rate or tiers, never both', () => {
    for (const [uf, r] of Object.entries(ALIQUOTAS_IPVA)) {
      expect((r.aliquota != null) !== (r.faixas != null), uf).toBe(true)
    }
  })
  it('every state is checked except MA (no official source read)', () => {
    expect(Object.keys(ALIQUOTAS_IPVA).filter((uf) => !aliquotaConferida(uf))).toEqual(['MA'])
  })
  it('keeps the corrected rates (MS, PR, PE, DF)', () => {
    expect(aliquotaIpvaDoVeiculo('MS', flex)).toBe(0.03)
    expect(aliquotaIpvaDoVeiculo('PR', flex)).toBe(0.019)
    expect(aliquotaIpvaDoVeiculo('PE', flex)).toBe(0.024)
    expect(aliquotaIpvaDoVeiculo('DF', flex)).toBe(0.03)
  })
})

describe('aliquotaIpvaDoVeiculo never guesses a tier', () => {
  it('power tiers (CE, GO) need the power', () => {
    expect(aliquotaIpvaDoVeiculo('CE', flex)).toBeNull()
    expect(aliquotaIpvaDoVeiculo('CE', { ...flex, potenciaCv: 82 })).toBe(0.025)
    expect(aliquotaIpvaDoVeiculo('CE', { ...flex, potenciaCv: 100 })).toBe(0.025)
    expect(aliquotaIpvaDoVeiculo('CE', { ...flex, potenciaCv: 150 })).toBe(0.03)
    expect(aliquotaIpvaDoVeiculo('CE', { ...flex, potenciaCv: 181 })).toBe(0.035)
    expect(aliquotaIpvaDoVeiculo('GO', { ...flex, potenciaCv: 116 })).toBe(0.0375)
    expect(aliquotaIpvaDoVeiculo('GO', { ...flex, potenciaCv: 75 })).toBe(0.03)
  })
  it('AL counts HP: a power near the border that lands in two tiers gets no rate', () => {
    expect(aliquotaIpvaDoVeiculo('AL', { ...flex, potenciaCv: 75 })).toBe(0.0275)
    expect(aliquotaIpvaDoVeiculo('AL', { ...flex, potenciaCv: 120 })).toBe(0.03)
    expect(aliquotaIpvaDoVeiculo('AL', { ...flex, potenciaCv: 200 })).toBe(0.0325)
    // 81 cv is 79.9 HP: tier 1 read as HP, tier 2 read as cv.
    expect(aliquotaIpvaDoVeiculo('AL', { ...flex, potenciaCv: 81 })).toBeNull()
  })
  it('North: AM and RO by engine size, TO by HP', () => {
    expect(aliquotaIpvaDoVeiculo('AM', { ...flex, cilindradaCc: 999 })).toBe(0.015)
    expect(aliquotaIpvaDoVeiculo('AM', { ...flex, cilindradaCc: 1598 })).toBe(0.02)
    expect(aliquotaIpvaDoVeiculo('AM', { combustivel: 'hibrido' })).toBe(0.015)
    expect(aliquotaIpvaDoVeiculo('RO', { ...flex, cilindradaCc: 999 })).toBe(0.02)
    expect(aliquotaIpvaDoVeiculo('RO', { ...flex, cilindradaCc: 1400 })).toBe(0.03)
    expect(aliquotaIpvaDoVeiculo('TO', { ...flex, potenciaCv: 90 })).toBe(0.025)
    expect(aliquotaIpvaDoVeiculo('TO', { ...flex, potenciaCv: 101 })).toBeNull()
    expect(aliquotaIpvaDoVeiculo('TO', { ...flex, potenciaCv: 150 })).toBe(0.035)
  })
  it('engine-size tiers (MT) need the engine size', () => {
    expect(aliquotaIpvaDoVeiculo('MT', flex)).toBeNull()
    expect(aliquotaIpvaDoVeiculo('MT', { ...flex, cilindradaCc: 999 })).toBe(0.02)
    expect(aliquotaIpvaDoVeiculo('MT', { ...flex, cilindradaCc: 1000 })).toBe(0.02)
    expect(aliquotaIpvaDoVeiculo('MT', { ...flex, cilindradaCc: 1598 })).toBe(0.03)
  })
  it('value tiers (PI, SE) use the FIPE value', () => {
    expect(aliquotaIpvaDoVeiculo('PI', flex)).toBeNull()
    expect(aliquotaIpvaDoVeiculo('PI', { ...flex, valorFipe: 150000 })).toBe(0.025)
    expect(aliquotaIpvaDoVeiculo('PI', { ...flex, valorFipe: 150001 })).toBe(0.03)
    expect(aliquotaIpvaDoVeiculo('SE', { ...flex, valorFipe: 119999 })).toBe(0.025)
    expect(aliquotaIpvaDoVeiculo('SE', { ...flex, valorFipe: 120000 })).toBe(0.03)
  })
  it('fuel follows the source: a fuel with its own rule gets that rate, or none when not modeled', () => {
    expect(aliquotaIpvaDoVeiculo('RJ', { combustivel: 'hibrido' })).toBe(0.015)
    expect(aliquotaIpvaDoVeiculo('RJ', { combustivel: 'eletrico' })).toBe(0.005)
    expect(aliquotaIpvaDoVeiculo('RJ', { combustivel: 'etanol' })).toBe(0.02)
    expect(aliquotaIpvaDoVeiculo('BA', { combustivel: 'diesel' })).toBe(0.03)
    expect(aliquotaIpvaDoVeiculo('RN', { combustivel: 'gnv' })).toBe(0.015)
    expect(aliquotaIpvaDoVeiculo('PR', { combustivel: 'gnv' })).toBe(0.01)
    expect(aliquotaIpvaDoVeiculo('SP', { combustivel: 'eletrico' })).toBeNull()
    expect(aliquotaIpvaDoVeiculo('DF', { combustivel: 'hibrido' })).toBeNull()
  })
  it('a fuel without its own rule follows the general rate (MG, BA electric, SP diesel)', () => {
    expect(aliquotaIpvaDoVeiculo('MG', { combustivel: 'diesel' })).toBe(0.04)
    expect(aliquotaIpvaDoVeiculo('MG', { combustivel: 'eletrico' })).toBe(0.04)
    expect(aliquotaIpvaDoVeiculo('BA', { combustivel: 'eletrico' })).toBe(0.025)
    expect(aliquotaIpvaDoVeiculo('SP', { combustivel: 'diesel' })).toBe(0.04)
  })
  it('unknown fuel: the general rate where no fuel has its own rule, else only if all rules agree', () => {
    expect(aliquotaIpvaDoVeiculo('MG', {})).toBe(0.04)
    expect(aliquotaIpvaDoVeiculo('SC', {})).toBe(0.02)
    expect(aliquotaIpvaDoVeiculo('SP', {})).toBeNull()
    expect(aliquotaIpvaDoVeiculo('RJ', {})).toBeNull()
    // AM: electric and hybrid pay 1.5%, the same as the up-to-1,000 cm3 tier.
    expect(aliquotaIpvaDoVeiculo('AM', { cilindradaCc: 999 })).toBe(0.015)
    expect(aliquotaIpvaDoVeiculo('AM', { cilindradaCc: 1598 })).toBeNull()
  })
  it('unknown state gives no rate', () => {
    expect(aliquotaIpvaDoVeiculo('XX', flex)).toBeNull()
    expect(aliquotaIpvaDoVeiculo('', flex)).toBeNull()
  })
  it('a tier decided on the server counts when the power is not at hand', () => {
    expect(aliquotaIpvaDoVeiculo('CE', { ...flex, aliquotaFaixa: 0.03 })).toBe(0.03)
    expect(aliquotaIpvaDoVeiculo('CE', { ...flex, potenciaCv: 82, aliquotaFaixa: 0.035 })).toBe(0.025)
  })
  it('range and what decides it', () => {
    expect(faixaAliquotaIpva('CE')).toEqual({ min: 0.025, max: 0.035, depende: 'potencia' })
    expect(faixaAliquotaIpva('MT')).toEqual({ min: 0.02, max: 0.03, depende: 'cilindrada' })
    expect(faixaAliquotaIpva('SP')).toEqual({ min: 0.04, max: 0.04, depende: null })
  })
})

describe('faixasDecididas (free lookup)', () => {
  it('gives each power/engine-size state the tier of this car as rate and label only', () => {
    const f = faixasDecididas({ potenciaCv: 82, cilindradaCc: 999 })
    expect(f.CE).toEqual({ aliquota: 0.025, rotulo: 'até 100 cv' })
    expect(f.GO).toEqual({ aliquota: 0.03, rotulo: 'até 100 cv' })
    expect(f.AM).toEqual({ aliquota: 0.015, rotulo: 'até 1.000 cilindradas' })
    expect(f.MT).toEqual({ aliquota: 0.02, rotulo: 'até 1.000 cilindradas' })
    expect(f.RO).toEqual({ aliquota: 0.02, rotulo: 'até 1.000 cilindradas' })
    expect(Object.keys(f).sort()).toEqual(['AM', 'CE', 'GO', 'MT', 'RO'])
    expect(JSON.stringify(f)).not.toMatch(/\b82\b|\b999\b/)
  })
  it('never sends the HP states (AL, TO), whose cv/HP border gap revealed the exact power', () => {
    for (let cv = 40; cv <= 400; cv++) {
      const f = faixasDecididas({ potenciaCv: cv, cilindradaCc: 1598 })
      expect(f.AL).toBeUndefined()
      expect(f.TO).toBeUndefined()
    }
  })
  it('the labels of all states together reveal no more than 3 power bands and 2 engine-size bands', () => {
    const porPotencia = new Set<string>()
    for (let cv = 40; cv <= 400; cv++) porPotencia.add(JSON.stringify(faixasDecididas({ potenciaCv: cv })))
    expect(porPotencia.size).toBeLessThanOrEqual(3)
    const porCilindrada = new Set<string>()
    for (let cc = 50; cc <= 6000; cc += 10) porCilindrada.add(JSON.stringify(faixasDecididas({ cilindradaCc: cc })))
    expect(porCilindrada.size).toBeLessThanOrEqual(2)
  })
  it('leaves out a state when the data is missing', () => {
    expect(faixasDecididas({})).toEqual({})
    expect(faixasDecididas({ cilindradaCc: 1598 }).MT).toEqual({ aliquota: 0.03, rotulo: 'acima de 1.000 cilindradas' })
  })
})

describe('cargo pickups and utilities get no car rate', () => {
  it('registry tipo CAMINHONETE with espécie CARGA', () => {
    expect(ehUtilitarioDeCarga('CAMINHONETE', 'CARGA')).toBe(true)
    expect(ehUtilitarioDeCarga('CAMIONETA', 'MISTO')).toBe(false)
    expect(aliquotaIpvaDoVeiculo('SP', { ...flex, utilitarioCarga: true })).toBeNull()
    expect(aliquotaIpvaDoVeiculo('MG', { utilitarioCarga: true })).toBeNull()
  })
  it('the report builds the same vehicle for the 12-month and the 5-year cost', () => {
    const reg = { codigoCombustivel: '16', potencia: 82, cilindrada: 999, descricaoMarcaModelo: 'VW/GOL', descricaoTipoVeiculo: 'AUTOMOVEL', descricaoEspecie: 'PASSAGEIRO' }
    expect(veiculoIpvaDoRegistro(reg, 'Gol 1.0 Flex', 50000)).toEqual({ valorFipe: 50000, potenciaCv: 82, cilindradaCc: 999, combustivel: 'comum', utilitarioCarga: false })
    expect(veiculoIpvaDoRegistro({ ...reg, descricaoTipoVeiculo: 'CAMINHONETE', descricaoEspecie: 'CARGA' }).utilitarioCarga).toBe(true)
    expect(veiculoIpvaDoRegistro(null)).toMatchObject({ combustivel: null, utilitarioCarga: false })
  })
})

describe('combustivelIpva', () => {
  it('reads the registry code and the fuel text', () => {
    expect(combustivelIpva(16)).toBe('comum')
    expect(combustivelIpva('2')).toBe('comum')
    expect(combustivelIpva(1)).toBe('etanol')
    expect(combustivelIpva(3)).toBe('diesel')
    expect(combustivelIpva(null, 'Álcool/Gasolina')).toBe('comum')
    expect(combustivelIpva(null, 'ALCOOL')).toBe('etanol')
    expect(combustivelIpva(null, 'Diesel')).toBe('diesel')
    expect(combustivelIpva(null, 'Elétrico')).toBe('eletrico')
    expect(combustivelIpva(null, 'Gasolina/Elétrico')).toBe('hibrido')
    expect(combustivelIpva(16, 'Corolla Cross XRX Hybrid')).toBe('hibrido')
    expect(combustivelIpva(17)).toBe('gnv')
    expect(combustivelIpva('06')).toBe('eletrico')
    // A registry code we don't map decides nothing, and the model name only
    // counts when it names a hybrid or an electric.
    expect(combustivelIpva(18)).toBeNull()
    expect(combustivelIpva(5, 'Gasolina')).toBeNull()
    expect(combustivelIpva(18, 'Corolla Altis Hybrid')).toBe('hibrido')
    // Code and text must agree: electric code with a hybrid text is unknown.
    expect(combustivelIpva(6, 'Corolla Altis Hybrid')).toBeNull()
    expect(combustivelIpva(6, 'Elétrico')).toBe('eletrico')
    expect(combustivelIpva(3, 'Diesel')).toBe('diesel')
    expect(combustivelIpva(null, 'Gasolina/GNV')).toBe('gnv')
    expect(combustivelIpva(null, '')).toBeNull()
  })
})

describe('5-year cost (ICV5) follows the same rule', () => {
  const base = { valorFipe: 50000, anoFabricacao: 2020, categoria: 'hatch' }
  it('uses the decided rate', () => {
    expect(calcularICV5({ ...base, uf: 'PE', veiculo: flex })!.ipvaAnual).toBe(1200)
    expect(calcularICV5({ ...base, uf: 'CE', veiculo: { ...flex, potenciaCv: 82 } })!.ipvaAnual).toBe(1250)
  })
  it('is not computed when the rate depends on data we do not hold', () => {
    expect(calcularICV5({ ...base, uf: 'CE', veiculo: flex })).toBeNull()
    expect(calcularICV5({ ...base, uf: 'SP' })).toBeNull()
  })
  it('an unknown fuel still gets the rate where no fuel has its own rule', () => {
    expect(calcularICV5({ ...base, uf: 'MG' })!.ipvaAnual).toBe(2000)
  })
})
