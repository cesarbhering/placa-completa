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
    expect(modeloDoNome('VW/T CROSS TSI')).toBe('TCROSS')
    expect(modeloDoNome('VW/T-CROSS 200 TSI')).toBe('TCROSS')
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
  it('T CROSS no cadastro so lista T-Cross (TEL9A21)', () => {
    const lista = [{ modelo: 'Nivus Comfortline 1.0 200 TSI Flex Aut.' }, { modelo: 'T-Cross Sense 200 TSI 1.0 Flex 5p Aut.' }, { modelo: 'Polo 1.0 TSI Flex 12V 5p' }]
    expect(versoesParaExibir(lista, 'VW/T CROSS TSI')).toEqual([{ modelo: 'T-Cross Sense 200 TSI 1.0 Flex 5p Aut.' }])
  })
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

describe('Renault: siglas do cadastro (OUQ8G18, 15/out)', () => {
  // Shortlist real do relatorio OUQ8G18 (Duster 2014).
  const DUSTER_2014 = [
    { codigo_fipe: '025181-0', modelo: 'DUSTER 1.6 Hi-Flex 16V Mec.' },
    { codigo_fipe: '025183-6', modelo: 'DUSTER Dynamique 1.6 Flex 16V Mec.' },
    { codigo_fipe: '025182-8', modelo: 'DUSTER Expression 1.6 Hi-Flex 16V Mec.' },
    { codigo_fipe: '025191-7', modelo: 'DUSTER TECHROAD 1.6 Hi-Flex 16V Mec.' },
  ]
  it('"DUSTER 16 D 4X2" = Dynamique; "16 E 4X2" = Expression', () => {
    expect(versaoDoNome('RENAULT/DUSTER 16 D 4X2').versoes).toContain('DYNAMIQUE')
    expect(filtrarPelaVersaoDoNome(DUSTER_2014, 'RENAULT/DUSTER 16 D 4X2').map((c) => c.codigo_fipe)).toEqual(['025183-6'])
    expect(filtrarPelaVersaoDoNome(DUSTER_2014, 'RENAULT/DUSTER 16 E 4X2').map((c) => c.codigo_fipe)).toEqual(['025182-8'])
  })
  it('letra solta so vale como palavra inteira e so na Renault', () => {
    expect(versaoDoNome('RENAULT/MEGANE E-TECH').versoes).toEqual([])
    expect(versaoDoNome('RENAULT/MASTER REVES A').versoes).toEqual([])
    expect(versaoDoNome('FIAT/STRADA D 1.3').versoes).toEqual([])
    expect(versaoDoNome('VW/GOL E 1.0').versoes).toEqual([])
    expect(versaoDoNome('M.BENZ/C 200 D').versoes).toEqual([])
  })
  it('AUT/AUTH = Authentique, inclusive colado no motor', () => {
    expect(versaoDoNome('RENAULT/CLIO AUT 10 16VS')).toEqual({ versoes: ['AUTHENTIQUE', 'AUTHENT', 'AUTH'], motor: null })
    expect(versaoDoNome('RENAULT/SANDERO AUT1016V')).toEqual({ versoes: ['AUTHENTIQUE', 'AUTHENT', 'AUTH'], motor: '1.0' })
    expect(versaoDoNome('RENAULT/LOGAN AUTH 10').versoes).toContain('AUTHENTIQUE')
    const logan = [
      { modelo: 'LOGAN Authentique Hi-Flex 1.0 16V 4p' },
      { modelo: 'LOGAN Expression Hi-Flex 1.0 16V 4p' },
      { modelo: 'LOGAN Expression Hi-Flex 1.6 16V 4p Aut' },
    ]
    expect(filtrarPelaVersaoDoNome(logan, 'RENAULT/LOGAN AUT 1016V').map((c) => c.modelo)).toEqual(['LOGAN Authentique Hi-Flex 1.0 16V 4p'])
    // "Authent." abreviado na FIPE tambem casa.
    expect(filtrarPelaVersaoDoNome([{ modelo: 'DUSTER Authent. 1.6 Flex 16V Aut.(PCD)' }, { modelo: 'DUSTER Expression 1.6 Flex 16V Aut.' }], 'RENAULT/DUSTER AUTH 16').map((c) => c.modelo))
      .toEqual(['DUSTER Authent. 1.6 Flex 16V Aut.(PCD)'])
  })
  it('demais siglas e abreviacoes da FIPE (Dyna., Dynamiq., Expres., Privilege com acento)', () => {
    const casos: Array<[string, string]> = [
      ['RENAULT/LOGAN DYNA 16 M', 'DYNAMIQUE'], ['RENAULT/MEGANESD DYN 16', 'DYNAMIQUE'],
      ['RENAULT/SANDERO EXPR 10', 'EXPRESSION'], ['RENAULT/LOGAN EXP 16', 'EXPRESSION'],
      ['RENAULT/CLIO PRI 16 16VS', 'PRIVILEGE'], ['RENAULT/SANDERO PR1616VA', 'PRIVILEGE'],
      ['RENAULT/KWID INTENS 10MT', 'INTENSE'], ['RENAULT/DUSTER INT16 CVT', 'INTENSE'], ['RENAULT/CAPTUR INTEN 16A', 'INTENSE'],
      ['RENAULT/DUSTER ICO16 CVT', 'ICONIC'], ['RENAULT/KWID ZEN 2', 'ZEN'], ['RENAULT/KWID OUTSID 10MT', 'OUTSIDER'],
      ['RENAULT/SANDERO STEP 16', 'STEPWAY'], ['RENAULT/SANDERO STW 16HP', 'STEPWAY'], ['I/RENAULT CLIO CAM1016VH', 'CAMPUS'],
    ]
    for (const [nome, versao] of casos) expect(versaoDoNome(nome).versoes, nome).toContain(versao)
    expect(versaoDoNome('RENAULT/SANDERO PR1616VA').motor).toBe('1.6')
    expect(versaoDoNome('RENAULT/SANDERO EXP1016V').motor).toBe('1.0')
    expect(versaoDoNome('RENAULT/OROCH 20 DYN42AT').motor).toBeNull() // 42 = 4x2
    expect(filtrarPelaVersaoDoNome([{ modelo: 'SANDERO Privilège Hi-Flex 1.6 16V 5p Aut' }, { modelo: 'SANDERO Expression Hi-Flex 1.6 16V 5p' }], 'RENAULT/SANDERO PR1616VA').map((c) => c.modelo))
      .toEqual(['SANDERO Privilège Hi-Flex 1.6 16V 5p Aut'])
    expect(filtrarPelaVersaoDoNome([{ modelo: 'LOGAN Dyna. Hi-Flex 1.6 8V 4p' }, { modelo: 'LOGAN Expres. Hi-Flex 1.6 8V 4p' }], 'RENAULT/LOGAN DYNA 16 M').map((c) => c.modelo))
      .toEqual(['LOGAN Dyna. Hi-Flex 1.6 8V 4p'])
  })
  it('EXP nao casa com Express (Kangoo/Oroch Express e outra versao)', () => {
    const oroch = [{ modelo: 'DUSTER OROCH Express 1.6 Flex 16V Mec.' }, { modelo: 'DUSTER OROCH Expression 1.6 Flex 16V Mec' }]
    expect(filtrarPelaVersaoDoNome(oroch, 'RENAULT/OROCH EXP 16 SCE').map((c) => c.modelo)).toEqual(['DUSTER OROCH Expression 1.6 Flex 16V Mec'])
  })
  it('Stepway: nome sem STEP nao fica com Stepway; com STEP fica (FRT4D71)', () => {
    const sandero = [
      { modelo: 'SANDERO Expression Flex 1.6 16V 5p' },
      { modelo: 'SANDERO STEPWAY EXP. Flex 1.6 16V 5p' },
      { modelo: 'SANDERO Dynamique Flex 1.6 16V 5p' },
    ]
    expect(filtrarPelaVersaoDoNome(sandero, 'RENAULT/SANDERO EXP16SCE').map((c) => c.modelo)).toEqual(['SANDERO Expression Flex 1.6 16V 5p'])
    expect(filtrarPelaVersaoDoNome(sandero, 'RENAULT/SANDERO STEP 16').map((c) => c.modelo)).toEqual(['SANDERO STEPWAY EXP. Flex 1.6 16V 5p'])
  })
  it('siglas Renault vao pro prompt do juiz', async () => {
    const { siglasParaPrompt, LEGENDA_RENAULT } = await import('./versao-fipe')
    const t = siglasParaPrompt()
    expect(t).toContain('Renault: ')
    expect(t).toContain('D = Dynamique')
    expect(t).toContain('E = Expression')
    expect(t).toContain('AUT = Authentique')
    expect(t).toContain('HL = Highline') // VW segue igual
    expect(LEGENDA_RENAULT).toContain('NAO cambio automatico')
    expect(LEGENDA_RENAULT).not.toMatch(/\u2014/)
  })
  it('G. = Grand: SUZUKI G.VITARA nao casa com SX4 (NZA3648)', () => {
    const lista = [{ modelo: 'Grand Vitara 2.0 16V 4x2/4x4 5p Aut.' }, { modelo: 'Grand Vitara 2.0 16V 4x2/4x4 5p Mec.' }, { modelo: 'SX4 2.0 16V 145cv 4WD 5p Aut.' }, { modelo: 'SX4 2.0 16V 145cv 4WD 5p Mec.' }]
    expect(filtrarPeloModeloDoNome(lista, 'I/SUZUKI G.VITARA 2WD 5P').map((c) => c.modelo)).toEqual(['Grand Vitara 2.0 16V 4x2/4x4 5p Aut.', 'Grand Vitara 2.0 16V 4x2/4x4 5p Mec.'])
  })
})

describe('sinonimos e prefixo de versao (EZJ9243, 24/out/2026)', async () => {
  const { candidatoTemVersaoDoNome, lerVersaoDoNome } = await import('./versao-fipe')
  it('EXC/EXCL casam com "Excl." e "Exclusive"', () => {
    const { versoes, prefixo } = lerVersaoDoNome('CITROEN/C3 PICASSO EXC A')
    expect(candidatoTemVersaoDoNome('C3 Picasso Excl. 1.6 Flex 16V 5p Aut.', versoes, prefixo)).toBe(true)
    expect(candidatoTemVersaoDoNome('C3 Picasso Exclusive 1.6 Flex 16V 5p Mec', versoes, prefixo)).toBe(true)
    expect(candidatoTemVersaoDoNome('C3 Picasso GLX 1.6 Flex 16V 5p Aut.', versoes, prefixo)).toBe(false)
  })
  it('prefixo so no sentido cadastro -> FIPE por extenso, 3+ letras, nunca outra versao conhecida', () => {
    // LIMIT no cadastro casa "Limited"; SPORT nao casa "Sportway"; GL nao casa GLX (2 letras).
    expect(candidatoTemVersaoDoNome('Compass Limited 2.0', ['LIMIT'], true)).toBe(true)
    expect(candidatoTemVersaoDoNome('Sandero Sportway 1.6', ['SPORT'], true)).toBe(false)
    expect(candidatoTemVersaoDoNome('C3 Picasso GLX 1.6', ['GL'], true)).toBe(false)
    // LX nao casa LXS (2 letras).
    expect(candidatoTemVersaoDoNome('Civic LXS 1.8', ['LX'], true)).toBe(false)
    // Sem prefixo (sigla de marca): so exato.
    expect(candidatoTemVersaoDoNome('Compass Limited 2.0', ['LIMIT'], false)).toBe(false)
  })
})
