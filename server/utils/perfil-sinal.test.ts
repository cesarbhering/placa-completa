import { describe, it, expect } from 'vitest'
import { perfilDoSinal, textoCurto, anoCurto, ufCurta, TAM_MARCA, TAM_MODELO, TAM_COR } from './perfil-sinal'

// Vehicle attributes for the signal routes: the server's own data first, the
// request body only for what the server does not have (and flagged as such).
const PAYLOAD = {
  MARCA: 'MARCA', MODELO: 'MODELO TESTE', ano: '2019', anoModelo: '2020', cor: 'Prata', uf: 'SP',
  extra: { ano_fabricacao: '2019', ano_modelo: '2020' },
}

describe('perfilDoSinal', () => {
  it('uses the same fields the result screen gets from the lookup', () => {
    expect(perfilDoSinal(PAYLOAD, {})).toEqual({
      marca: 'MARCA', modelo: 'MODELO TESTE', ano: '2020', anoFab: '2019', anoModelo: '2020', cor: 'Prata', uf: 'SP', doCorpo: false,
    })
  })

  it('ignores the body when the server holds the field', () => {
    const corpo = { marca: 'OUTRA', modelo: 'OUTRO', ano: '1999', anoFab: '1998', anoModelo: '1999', cor: 'Rosa', uf: 'AC' }
    expect(perfilDoSinal(PAYLOAD, corpo)).toEqual(perfilDoSinal(PAYLOAD, {}))
  })

  it('fills from the body only what the server lacks, and says so', () => {
    const { cor: _cor, ...semCor } = PAYLOAD
    expect(perfilDoSinal(semCor, { cor: 'Rosa', marca: 'OUTRA' })).toMatchObject({ marca: 'MARCA', cor: 'Rosa', doCorpo: true })
    expect(perfilDoSinal(semCor, { marca: 'OUTRA' })).toMatchObject({ marca: 'MARCA', cor: null, doCorpo: false })
  })

  it('without server data everything comes from the body, bounded', () => {
    const p = perfilDoSinal(null, { marca: 'm'.repeat(500), modelo: 'x'.repeat(500), cor: 'c'.repeat(500), uf: 'rj', ano: 2020, anoFab: '2019', anoModelo: '2020' })
    expect(p.marca).toHaveLength(TAM_MARCA)
    expect(p.modelo).toHaveLength(TAM_MODELO)
    expect(p.cor).toHaveLength(TAM_COR)
    expect(p).toMatchObject({ uf: 'RJ', ano: '2020', anoFab: '2019', anoModelo: '2020', doCorpo: true })
  })

  it('an empty body and no server data give an empty profile that is not "from the body"', () => {
    expect(perfilDoSinal(null, null)).toEqual({ marca: null, modelo: null, ano: null, anoFab: null, anoModelo: null, cor: null, uf: null, doCorpo: false })
    expect(perfilDoSinal(undefined, 'texto')).toMatchObject({ marca: null, doCorpo: false })
  })

  it('an imported vehicle (brand code in MARCA) resolves the brand like the screen does', () => {
    expect(perfilDoSinal({ MARCA: 'I', MODELO: 'MARCAX MODELO', listamodelo: ['MARCAX'] }, {}).marca).toBe('MARCAX')
  })
})

describe('field helpers', () => {
  it('textoCurto: strings and numbers only, control characters out, spaces collapsed, capped', () => {
    expect(textoCurto('  a \n\t b  ', 10)).toBe('a b')
    expect(textoCurto(2020, 10)).toBe('2020')
    expect(textoCurto('abcdef', 3)).toBe('abc')
    for (const v of [null, undefined, {}, [], true, '', '   ']) expect(textoCurto(v, 10)).toBeNull()
  })

  it('anoCurto: a 4-digit year, or fabrication/model', () => {
    expect(anoCurto('2020')).toBe('2020')
    expect(anoCurto(1998)).toBe('1998')
    expect(anoCurto('2019/2020')).toBe('2019/2020')
    for (const v of ['20', '20200', 'abcd', '1899', '2020 OR 1=1', '2019/20201', {}, null]) expect(anoCurto(v)).toBeNull()
  })

  it('ufCurta: one of the 27 codes', () => {
    expect(ufCurta(' sp ')).toBe('SP')
    for (const v of ['XX', 'SPA', '', null, 11]) expect(ufCurta(v)).toBeNull()
  })
})
