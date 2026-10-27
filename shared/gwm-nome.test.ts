import { describe, it, expect } from 'vitest'
import { fatosGwm, versoesGwm, filtrarGwm } from './gwm-nome'
import { filtrarPelaVersaoDoNome, faltaVersaoDoNome, candidatoTemVersaoDoNome } from './versao-fipe'
import { ehHibrido, ehEletricoPuro, propulsao } from './propulsao'

const H6 = [
  { codigo_fipe: '096008-0', modelo: 'Haval H6 19 1.5 (Hibrido)' },
  { codigo_fipe: '096001-2', modelo: 'Haval H6 2 1.5 (Hibrido)' },
  { codigo_fipe: '096016-0', modelo: 'Haval H6 35 1.5 AWD' },
  { codigo_fipe: '096003-9', modelo: 'Haval H6 GT 1.5 AWD (Hibrido)' },
]
const cod = (l: any[]) => l.map((c) => c.codigo_fipe)

describe('GWM/Haval: token HEV/PHEV e versao', () => {
  it('fatos do nome', () => {
    expect(fatosGwm('I/GWM HAVAL H6 HEV2')).toEqual({ hibrido: 'hev', versao: '2', gt: false })
    expect(fatosGwm('GWM/HAVAL H6 PHEV19')).toEqual({ hibrido: 'phev', versao: '19', gt: false })
    expect(fatosGwm('I/GWM HAVAL H6 GT')).toEqual({ hibrido: null, versao: null, gt: true })
    expect(fatosGwm('I/TOYOTA HILUX CDSRXA4FD')).toBeNull()
    expect(versoesGwm('I/GWM HAVAL H6 HEV2')).toEqual(['2'])
  })
  it('THX8888 "HEV2": so a "H6 2" (096001-2)', () => {
    expect(cod(filtrarPelaVersaoDoNome(H6, 'I/GWM HAVAL H6 HEV2'))).toEqual(['096001-2'])
  })
  it('"PHEV19" -> 096008-0; "PHEV35" -> 096016-0; "H6 GT" -> 096003-9', () => {
    expect(cod(filtrarPelaVersaoDoNome(H6, 'I/GWM HAVAL H6 PHEV19'))).toEqual(['096008-0'])
    expect(cod(filtrarPelaVersaoDoNome(H6, 'I/GWM HAVAL H6 PHEV35'))).toEqual(['096016-0'])
    expect(cod(filtrarPelaVersaoDoNome(H6, 'I/GWM HAVAL H6 GT'))).toEqual(['096003-9'])
  })
  it('numero de versao nunca casa com a motorizacao ("1.5")', () => {
    expect(candidatoTemVersaoDoNome('Haval H6 2 1.5 (Hibrido)', ['5'])).toBe(false)
    expect(candidatoTemVersaoDoNome('Haval H6 2 1.5 (Hibrido)', ['2'])).toBe(true)
  })
  it('sigla eliminatoria: versao que nao esta na lista nao deixa o cambio decidir', () => {
    expect(faltaVersaoDoNome(H6.filter((c) => c.codigo_fipe !== '096001-2'), 'I/GWM HAVAL H6 HEV2')).toBe(true)
  })
  it('sem GT no nome, GT sai; HEV sem numero tira AWD', () => {
    expect(cod(filtrarGwm(H6, 'I/GWM HAVAL H6 HEV'))).toEqual(['096008-0', '096001-2'])
  })
})

describe('hibrido nao e eletrico', () => {
  it('HEV, PHEV, "(Hibrido)", Hybrid e DM-i sao hibridos', () => {
    for (const t of ['I/GWM HAVAL H6 HEV2', 'HAVAL H6 PHEV19', 'Haval H6 2 1.5 (Hibrido)', 'Híbrido', 'Corolla Altis Hybrid', 'I/BYD SONG PLUS PREM DM-I']) {
      expect(ehHibrido(t), t).toBe(true)
      expect(ehEletricoPuro(t), t).toBe(false)
      expect(propulsao(t), t).toBe('hibrido')
    }
  })
  it('BEV (BYD Dolphin, "Elétrico") e eletrico', () => {
    expect(propulsao('I/BYD DOLPHIN', 'Elétrico')).toBe('eletrico')
    expect(propulsao('Dolphin GS 180 (Elétrico)')).toBe('eletrico')
    expect(propulsao('HÍBRIDO (GASOLINA/ELÉTRICO)')).toBe('hibrido')
    expect(propulsao('Flex')).toBeNull()
  })
})

describe('icv5: categoria hibrido antes de eletrico', () => {
  it('HIBRIDO e HEV nao viram eletrico; ELETRICO puro sim', async () => {
    const { inferirCategoria } = await import('../server/utils/icv5')
    expect(inferirCategoria('SUV', 'HÍBRIDO (GASOLINA/ELÉTRICO)')).toBe('hibrido')
    expect(inferirCategoria('SUV', 'HEV')).toBe('hibrido')
    expect(inferirCategoria('HATCH', 'ELÉTRICO')).toBe('eletrico')
    expect(inferirCategoria('HATCH', 'FLEX')).toBe('hatch')
  })
})
