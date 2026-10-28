import { describe, it, expect } from 'vitest'
import { familiaModelo, passagemCompativelComVeiculo, historicoCompativelComVeiculo } from './leilao-exibicao'

const SPIN = { modelo: 'CHEV/SPIN 1.8L AT LTZ' }
const onix = (nivel: string) => ({
  nivel,
  fonte: 'superbid',
  veiculo_na_fonte: { marca: 'CHEVROLET', modelo: 'ONIX 1.4 AT LTZ', ano_fab: 2017, ano_mod: 2018 },
})

describe('familiaModelo', () => {
  it('tira marca, motor e versao', () => {
    expect(familiaModelo('CHEV/SPIN 1.8L AT LTZ')).toBe('SPIN')
    expect(familiaModelo('SPIN 1.8 LTZ')).toBe('SPIN')
    expect(familiaModelo('ONIX 1.4 AT LTZ', 'CHEVROLET')).toBe('ONIX')
    expect(familiaModelo('I/HYUNDAI HB20S 1.6A')).toBe('HB20S')
    expect(familiaModelo('FIAT/NOVO UNO 1.0')).toBe('UNO')
    expect(familiaModelo('VW/T-CROSS 200 TSI')).toBe('TCROSS')
    expect(familiaModelo('PEUGEOT/208 GRIFFE')).toBe('208')
    expect(familiaModelo('')).toBeNull()
    expect(familiaModelo(null)).toBeNull()
  })
})

describe('passagemCompativelComVeiculo (caso PCU1D83)', () => {
  it('SPIN x ONIX possivel: descarta', () => {
    expect(passagemCompativelComVeiculo(onix('possivel'), SPIN)).toBe(false)
  })
  it('SPIN x ONIX provavel: descarta', () => {
    expect(passagemCompativelComVeiculo(onix('provavel'), SPIN)).toBe(false)
  })
  it('confirmado mantem mesmo com modelo divergente', () => {
    expect(passagemCompativelComVeiculo(onix('confirmado'), SPIN)).toBe(true)
  })
  it('ONIX PLUS x ONIX mantem', () => {
    const p = { nivel: 'possivel', veiculo_na_fonte: { modelo: 'ONIX PLUS 1.0 TURBO' } }
    expect(passagemCompativelComVeiculo(p, { modelo: 'CHEV/ONIX 1.4 LTZ' })).toBe(true)
  })
  it('HB20S x HB20 mantem (prefixo)', () => {
    const p = { nivel: 'possivel', veiculo_na_fonte: { modelo: 'HB20S 1.6 COMFORT' } }
    expect(passagemCompativelComVeiculo(p, { modelo: 'HYUNDAI/HB20 1.0M' })).toBe(true)
  })
  it('GRAND SIENA x SIENA mantem', () => {
    const p = { nivel: 'possivel', veiculo_na_fonte: { modelo: 'GRAND SIENA ATTRACTIVE' } }
    expect(passagemCompativelComVeiculo(p, { modelo: 'FIAT/SIENA EL 1.0' })).toBe(true)
  })
  it('modelo ausente mantem', () => {
    expect(passagemCompativelComVeiculo({ nivel: 'possivel', veiculo_na_fonte: null }, SPIN)).toBe(true)
    expect(passagemCompativelComVeiculo({ nivel: 'possivel', veiculo_na_fonte: { modelo: '' } }, SPIN)).toBe(true)
    expect(passagemCompativelComVeiculo(onix('possivel'), { modelo: null })).toBe(true)
    expect(passagemCompativelComVeiculo(onix('possivel'), null)).toBe(true)
  })
})

describe('historicoCompativelComVeiculo', () => {
  const base = {
    resumo: { tem_indicio: true, nivel_max: 'possivel', n_confirmado: 0, n_provavel: 0, n_possivel: 1, possiveis_ambiguos: 0, fontes_com_passagem: ['superbid'] },
    passagens: [onix('possivel')],
    linha_do_tempo: [{ data: '2024-01-01' }],
    recorrencia: { texto: 'x' },
  }
  it('zero passagens: resumo sem indicio', () => {
    const h = historicoCompativelComVeiculo(base, SPIN)!
    expect(h.passagens).toEqual([])
    expect(h.resumo).toMatchObject({ tem_indicio: false, nivel_max: null, n_possivel: 0, n_provavel: 0, n_confirmado: 0, fontes_com_passagem: [] })
    expect(h.linha_do_tempo).toBeNull()
    expect(h.recorrencia).toBeNull()
  })
  it('sobra passagem: resumo recontado', () => {
    const outra = { nivel: 'provavel', fonte: 'copart', veiculo_na_fonte: { modelo: 'SPIN LTZ' } }
    const h = historicoCompativelComVeiculo({ ...base, passagens: [onix('possivel'), outra], resumo: { ...base.resumo, nivel_max: 'provavel', n_provavel: 1, fontes_com_passagem: ['superbid', 'copart'] } }, SPIN)!
    expect(h.passagens).toEqual([outra])
    expect(h.resumo).toMatchObject({ tem_indicio: true, nivel_max: 'provavel', n_provavel: 1, n_possivel: 0, fontes_com_passagem: ['copart'] })
  })
  it('nada removido: mesmo objeto', () => {
    expect(historicoCompativelComVeiculo(base, { modelo: 'CHEV/ONIX 1.4' })).toBe(base)
    expect(historicoCompativelComVeiculo(null, SPIN)).toBeNull()
  })
})
