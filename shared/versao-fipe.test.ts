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

import { modeloDoNome, candidatoEDoModelo, filtrarPeloModeloDoNome, versoesParaExibir } from './versao-fipe'

describe('modelo do nome', () => {
  it('extrai o modelo, pulando NOVO/NOVA', () => {
    expect(modeloDoNome('CHEV/TRACKER T A')).toBe('TRACKER')
    expect(modeloDoNome('VW/NOVO GOL 1.0')).toBe('GOL')
    expect(modeloDoNome('I/BMW 320I')).toBe('320I')
    expect(modeloDoNome('HONDA/PCX 150 DLX ABS')).toBe('PCX')
    expect(modeloDoNome(null)).toBeNull()
  })
  it('casa abreviacao e hifen, nao casa outro modelo', () => {
    expect(candidatoEDoModelo('Tracker Premier 1.2 Turbo Aut.', 'TRACKER')).toBe(true)
    expect(candidatoEDoModelo('ONIX HATCH LT 1.0 12V Flex 5p Mec.', 'TRACKER')).toBe(false)
    expect(candidatoEDoModelo('C-180 Kompressor', 'C180')).toBe(true)
    expect(candidatoEDoModelo('320iA 2.0 Turbo', '320I')).toBe(true)
    expect(candidatoEDoModelo('Gol (novo) 1.0 Mi Total Flex 8V 4p', 'GOL')).toBe(true)
  })
  it('funil: zerou, volta a lista', () => {
    const onix = [{ modelo: 'ONIX HATCH LT 1.0' }, { modelo: 'ONIX HATCH 1.0 TB' }]
    expect(filtrarPeloModeloDoNome(onix, 'CHEV/TRACKER T A')).toEqual(onix)
    expect(filtrarPeloModeloDoNome([...onix, { modelo: 'Tracker LT 1.0 Turbo' }], 'CHEV/TRACKER T A')).toEqual([{ modelo: 'Tracker LT 1.0 Turbo' }])
  })
})

describe('versoesParaExibir (relatorio)', () => {
  it('TTR6F65: TRACKER com shortlist so de ONIX nao mostra nada', () => {
    expect(versoesParaExibir([{ modelo: 'ONIX HATCH LT 1.0 12V Flex 5p Mec.' }, { modelo: 'ONIX HATCH 1.0 12V TB 5p Mec.' }], 'CHEV/TRACKER T A')).toEqual([])
  })
  it('FZK5F28: PCX nao lista CB/NC/XRE', () => {
    expect(versoesParaExibir([{ modelo: 'CB 1000R/ABS' }, { modelo: 'NC 750X/NC 750X ABS/DCT' }, { modelo: 'XRE 300/ 300 ABS/ FLEX' }], 'HONDA/PCX 150 DLX ABS')).toEqual([])
    expect(versoesParaExibir([{ modelo: 'CB 1000R/ABS' }, { modelo: 'PCX 150/DLX' }], 'HONDA/PCX 150 DLX ABS')).toEqual([{ modelo: 'PCX 150/DLX' }])
  })
  it('GMF8I88: SAVEIRO CS nao lista CD', () => {
    const lista = [
      { modelo: 'Saveiro Extreme 1.6 Flex 16V CD' }, { modelo: 'Saveiro Robust 1.6 Total Flex 16V' },
      { modelo: 'Saveiro Robust 1.6 Total Flex 16V CD' }, { modelo: 'Saveiro Trendline 1.6 Total Flex 16V' },
    ]
    expect(versoesParaExibir(lista, 'VW/SAVEIRO CS RB MF').map((c) => c.modelo)).toEqual(['Saveiro Robust 1.6 Total Flex 16V'])
  })
  it('Corolla XEi continua sem o SE-G', () => {
    const l = [{ modelo: 'Corolla XEi 1.8/1.8 Flex 16V Aut.' }, { modelo: 'Corolla SE-G 1.8/1.8 Flex 16V Aut.' }]
    expect(versoesParaExibir(l, 'TOYOTA/COROLLA XEI18VVT')).toEqual([l[0]])
  })
})

describe('Saveiro RB = Robust (GMF8I88)', () => {
  it('RB no nome fica so com Robust, e CS tira a CD', () => {
    const lista = [
      { modelo: 'Saveiro Extreme 1.6 Flex 16V CD' }, { modelo: 'Saveiro Robust 1.6 Total Flex 16V' },
      { modelo: 'Saveiro Robust 1.6 Total Flex 16V CD' }, { modelo: 'Saveiro Trendline 1.6 Total Flex 16V' },
    ]
    expect(versoesParaExibir(lista, 'VW/SAVEIRO CS RB MF').map((c) => c.modelo)).toEqual(['Saveiro Robust 1.6 Total Flex 16V'])
  })
})

describe('motorizacao antes da versao (PBX2E59)', () => {
  it('"MARCH 16SV": 1.6 e versao SV', () => {
    expect(versaoDoNome('NISSAN/MARCH 16SV')).toEqual({ versoes: ['SV'], motor: '1.6' })
  })
})

describe('portas do nome (HSX1F20)', () => {
  const SPIRIT = [
    { codigo_fipe: '004265-0', modelo: 'Celta Spirit 1.0 MPFI VHC 8V 3p' },
    { codigo_fipe: '004267-6', modelo: 'Celta Spirit 1.0 MPFI VHC 8V 5p' },
  ]
  it('2P fica com a 3p; 4P com a 5p', async () => {
    const { filtrarPelasPortasDoNome } = await import('./versao-fipe')
    expect(filtrarPelasPortasDoNome(SPIRIT, 'GM/CELTA 2P SPIRIT').map((c) => c.codigo_fipe)).toEqual(['004265-0'])
    expect(filtrarPelasPortasDoNome(SPIRIT, 'GM/CELTA 4P SPIRIT').map((c) => c.codigo_fipe)).toEqual(['004267-6'])
    expect(filtrarPelaVersaoDoNome(SPIRIT, 'GM/CELTA 2P SPIRIT').map((c) => c.codigo_fipe)).toEqual(['004265-0'])
  })
  it('sem portas no nome, picape ou nada sobrando: lista intacta', async () => {
    const { filtrarPelasPortasDoNome, portasDoNome } = await import('./versao-fipe')
    expect(filtrarPelasPortasDoNome(SPIRIT, 'GM/CELTA SPIRIT')).toEqual(SPIRIT)
    expect(portasDoNome('FIAT/STRADA WORKING CS 2P')).toBeNull()
    expect(portasDoNome('VW/AMAROK CD 4P')).toBeNull()
    expect(filtrarPelasPortasDoNome([{ modelo: 'Celta 1.0 5p' }], 'GM/CELTA 2P')).toEqual([{ modelo: 'Celta 1.0 5p' }])
  })
  it('versao FIPE sem portas no nome nao sai', async () => {
    const { filtrarPelasPortasDoNome } = await import('./versao-fipe')
    const l = [{ modelo: 'Celta Spirit 1.0 3p' }, { modelo: 'Celta Spirit 1.0' }, { modelo: 'Celta Spirit 1.0 5p' }]
    expect(filtrarPelasPortasDoNome(l, 'GM/CELTA 2P SPIRIT').map((c) => c.modelo)).toEqual(['Celta Spirit 1.0 3p', 'Celta Spirit 1.0'])
  })
})

describe('picape GM: sufixo de cabine e tracao (PQH4374, 14/out)', () => {
  const S10_2015 = [
    { modelo: 'S10 Pick-Up LS 2.4 F.Power 4x2 CD' },
    { modelo: 'S10 Pick-Up LS 2.4 F.Power 4x2 CS' },
    { modelo: 'S10 Pick-Up LS 2.8 TDI 4x4 CD Dies. Mec.' },
    { modelo: 'S10 Pick-Up LS 2.8 TDI 4x4 CS Diesel' },
  ]
  it('fatos do sufixo', async () => {
    const { fatosPicapeGM } = await import('./versao-fipe')
    expect(fatosPicapeGM('CHEVROLET/S10 LS DS4')).toEqual({ cabine: 'dupla', tracao: '4X4', diesel: true, motor: '2.8' })
    expect(fatosPicapeGM('GM/S10 LT DS2')).toEqual({ cabine: 'dupla', tracao: '4X2', diesel: true, motor: '2.8' })
    expect(fatosPicapeGM('CHEV/S10 LS CS4')).toEqual({ cabine: 'simples', tracao: '4X4', diesel: false, motor: null })
    expect(fatosPicapeGM('CHEV/S10 LS CD2')).toEqual({ cabine: 'dupla', tracao: '4X2', diesel: false, motor: null })
    expect(fatosPicapeGM('FORD/RANGER XLS DS4')).toBeNull()
    expect(fatosPicapeGM('CHEVROLET/S10 LS')).toBeNull()
  })
  it('caso real: S10 LS DS4 2015 fica so com o 2.8 TDI 4x4 CD (004413-0)', async () => {
    const { filtrarPelaVersaoDoNome } = await import('./versao-fipe')
    expect(filtrarPelaVersaoDoNome(S10_2015, 'CHEVROLET/S10 LS DS4').map((c) => c.modelo)).toEqual(['S10 Pick-Up LS 2.8 TDI 4x4 CD Dies. Mec.'])
  })
  it('CS2: cabine simples 4x2', async () => {
    const { filtrarPelaVersaoDoNome } = await import('./versao-fipe')
    expect(filtrarPelaVersaoDoNome(S10_2015, 'CHEVROLET/S10 LS CS2').map((c) => c.modelo)).toEqual(['S10 Pick-Up LS 2.4 F.Power 4x2 CS'])
  })
  it('DS4 com versao Aut. e Mec.: sobram as duas (cambio decide depois)', async () => {
    const { filtrarPelaVersaoDoNome } = await import('./versao-fipe')
    const l = [...S10_2015, { modelo: 'S10 Pick-Up LS 2.8 TDI 4x4 CD Dies. Aut.' }]
    expect(filtrarPelaVersaoDoNome(l, 'CHEVROLET/S10 LS DS4').map((c) => c.modelo)).toEqual(['S10 Pick-Up LS 2.8 TDI 4x4 CD Dies. Mec.', 'S10 Pick-Up LS 2.8 TDI 4x4 CD Dies. Aut.'])
  })
})
