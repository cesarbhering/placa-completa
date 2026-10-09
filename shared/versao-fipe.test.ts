import { describe, it, expect } from 'vitest'
import { versaoDoNome, filtrarPelaVersaoDoNome, candidatoTemVersaoDoNome } from './versao-fipe'

const COROLLA_2004 = [
  { codigo_fipe: '002061-3', modelo: 'Corolla XEi 1.8/1.8 Flex 16V Aut.' },
  { codigo_fipe: '002028-1', modelo: 'Corolla XEi 1.8/1.8 Flex 16V Mec.' },
  { codigo_fipe: '002060-5', modelo: 'Corolla SE-G 1.8/1.8 Flex 16V Aut.' },
  { codigo_fipe: '002080-0', modelo: 'Corolla XLi 1.6 16V 110cv Aut.' },
]

describe('versaoDoNome', () => {
  it('versao colada na motorizacao (DMV4C01)', () => {
    expect(versaoDoNome('TOYOTA/COROLLA XEI18VVT')).toEqual({ versoes: ['XEI'], motor: '1.8' })
  })
  it('versao e motor separados, importado', () => {
    expect(versaoDoNome('I/TOYOTA COROLLA SEG 1.8')).toEqual({ versoes: ['SEG'], motor: '1.8' })
    expect(versaoDoNome('CHEVROLET/ONIX 1.4MT LTZ')).toEqual({ versoes: ['LTZ'], motor: '1.4' })
  })
  it('abreviacao do registro aceita o nome FIPE completo', () => {
    expect(versaoDoNome('VW/GOL 1.6 TREND').versoes).toEqual(['TREND', 'TRENDLINE'])
  })
  it('sem versao reconhecida', () => {
    expect(versaoDoNome('FIAT/UNO MILLE')).toEqual({ versoes: [], motor: null })
    expect(versaoDoNome(null)).toEqual({ versoes: [], motor: null })
  })
  it('o modelo nao vira versao', () => {
    expect(versaoDoNome('FORD/RANGER XLT 3.2').versoes).toEqual(['XLT'])
  })
})

describe('filtrarPelaVersaoDoNome', () => {
  it('Corolla XEi: tira o SE-G e o XLi, sobra so a duvida do cambio', () => {
    expect(filtrarPelaVersaoDoNome(COROLLA_2004, 'TOYOTA/COROLLA XEI18VVT').map((c) => c.codigo_fipe)).toEqual(['002061-3', '002028-1'])
  })
  it('SE-G no nome casa com SE-G na FIPE (hifen)', () => {
    expect(filtrarPelaVersaoDoNome(COROLLA_2004, 'TOYOTA/COROLLA SE-G').map((c) => c.codigo_fipe)).toEqual(['002060-5'])
  })
  it('Gol Trendline x Comfortline', () => {
    const gol = [
      { modelo: 'Gol Trendline 1.6 T.Flex 8V 5p' },
      { modelo: 'Gol Comfortline 1.6 T.Flex 8V 5p' },
      { modelo: 'Gol Highline 1.6 T.Flex 8V 5p' },
    ]
    expect(filtrarPelaVersaoDoNome(gol, 'VW/GOL TRENDLINE 1.6').map((c) => c.modelo)).toEqual(['Gol Trendline 1.6 T.Flex 8V 5p'])
    expect(filtrarPelaVersaoDoNome(gol, 'VW/GOL 1.6 COMFORT').map((c) => c.modelo)).toEqual(['Gol Comfortline 1.6 T.Flex 8V 5p'])
  })
  it('Onix LT x LTZ: LT nao casa com LTZ', () => {
    const onix = [{ modelo: 'ONIX HATCH LT 1.4 8V FlexPower 5p Mec.' }, { modelo: 'ONIX HATCH LTZ 1.4 8V FlexPower 5p Mec.' }]
    expect(filtrarPelaVersaoDoNome(onix, 'CHEVROLET/ONIX 1.4MT LT').map((c) => c.modelo)).toEqual(['ONIX HATCH LT 1.4 8V FlexPower 5p Mec.'])
    expect(filtrarPelaVersaoDoNome(onix, 'CHEVROLET/ONIX 1.4MT LTZ').map((c) => c.modelo)).toEqual(['ONIX HATCH LTZ 1.4 8V FlexPower 5p Mec.'])
  })
  it('motorizacao do nome filtra: 1.8 nao fica com 2.0', () => {
    const lista = [{ modelo: 'Corolla XEi 1.8 Flex Aut.' }, { modelo: 'Corolla XEi 2.0 Flex Aut.' }]
    expect(filtrarPelaVersaoDoNome(lista, 'TOYOTA/COROLLA XEI 2.0').map((c) => c.modelo)).toEqual(['Corolla XEi 2.0 Flex Aut.'])
  })
  it('filtro que zera volta a lista de antes', () => {
    expect(filtrarPelaVersaoDoNome(COROLLA_2004, 'TOYOTA/COROLLA ALTIS 2.0')).toEqual(COROLLA_2004)
  })
  it('candidatoTemVersaoDoNome sem versao aceita tudo', () => {
    expect(candidatoTemVersaoDoNome('qualquer', [])).toBe(true)
  })
})
