import { describe, it, expect, vi, afterEach } from 'vitest'
import { randomBytes } from 'node:crypto'
import { cifrar, decifrar, validarDocumento, gravarTomador, lerTomador } from './tomador'

const CPF = '123.456.789-09'
const CNPJ = '12.345.678/0001-95'
const KEY = randomBytes(32).toString('base64')

function fakeSb(row: any = null) {
  const upserts: any[] = []
  return {
    upserts,
    from: () => ({
      upsert: async (r: any, opts: any) => { upserts.push({ r, opts }); return { error: null } },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
    }),
  }
}

describe('cifra do tomador', () => {
  it('round trip e formato v1', () => {
    const c = cifrar('texto', KEY)
    expect(c).toMatch(/^v1\.[^.]+\.[^.]+\.[^.]+$/)
    expect(decifrar(c, KEY)).toBe('texto')
  })
  it('iv diferente a cada chamada', () => {
    expect(cifrar('x', KEY)).not.toBe(cifrar('x', KEY))
  })
  it('chave errada lanca', () => {
    expect(() => decifrar(cifrar('x', KEY), randomBytes(32).toString('base64'))).toThrow()
  })
  it('chave de 31 bytes e rejeitada', () => {
    expect(() => cifrar('x', randomBytes(31).toString('base64'))).toThrow()
    expect(() => decifrar('v1.a.b.c', randomBytes(31).toString('base64'))).toThrow()
  })
})

describe('validarDocumento', () => {
  it('CPF e CNPJ validos, formatados ou so digitos', () => {
    expect(validarDocumento(CPF)).toEqual({ tipo: 'CPF', digitos: '12345678909' })
    expect(validarDocumento('12345678909')).toEqual({ tipo: 'CPF', digitos: '12345678909' })
    expect(validarDocumento(CNPJ)).toEqual({ tipo: 'CNPJ', digitos: '12345678000195' })
    expect(validarDocumento('12345678000195')?.tipo).toBe('CNPJ')
  })
  it('rejeita digito errado, repetidos e lixo', () => {
    expect(validarDocumento('123.456.789-10')).toBeNull()
    expect(validarDocumento('111.111.111-11')).toBeNull()
    expect(validarDocumento('11111111111111')).toBeNull()
    expect(validarDocumento('12.345.678/0001-96')).toBeNull()
    expect(validarDocumento('123')).toBeNull()
    expect(validarDocumento(null as any)).toBeNull()
  })
})

describe('gravarTomador / lerTomador', () => {
  afterEach(() => vi.restoreAllMocks())
  it('upsert sem texto claro, tipo CPF, onConflict pedido_id', async () => {
    const sb = fakeSb()
    const ok = await gravarTomador(sb, 'p1', { documento: CPF, nome: 'Fulano de Tal', origem: 'woovi' }, KEY)
    expect(ok).toBe(true)
    expect(sb.upserts).toHaveLength(1)
    const s = JSON.stringify(sb.upserts[0].r)
    expect(s).not.toContain('12345678909')
    expect(s).not.toContain('Fulano')
    expect(sb.upserts[0].r.tipo).toBe('CPF')
    expect(sb.upserts[0].r.origem).toBe('woovi')
    expect(sb.upserts[0].opts).toEqual({ onConflict: 'pedido_id' })
  })
  it('documento invalido: false e sem upsert', async () => {
    const sb = fakeSb()
    expect(await gravarTomador(sb, 'p1', { documento: '111.111.111-11', nome: 'x', origem: 'woovi' }, KEY)).toBe(false)
    expect(sb.upserts).toHaveLength(0)
  })
  it('sem chave: false e sem upsert', async () => {
    const sb = fakeSb()
    expect(await gravarTomador(sb, 'p1', { documento: CPF, nome: 'x', origem: 'woovi' }, '')).toBe(false)
    expect(sb.upserts).toHaveLength(0)
  })
  it('nunca lanca nem loga documento', async () => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sb: any = { from: () => { throw new Error(`boom ${CPF}`) } }
    expect(await gravarTomador(sb, 'p1', { documento: CPF, nome: 'x', origem: 'woovi' }, KEY)).toBe(false)
    expect(JSON.stringify(log.mock.calls)).not.toContain('123.456')
  })
  it('lerTomador decifra; null em erro', async () => {
    const row = { documento_cifrado: cifrar('12345678909', KEY), nome_cifrado: cifrar('Fulano', KEY), tipo: 'CPF' }
    expect(await lerTomador(fakeSb(row), 'p1', KEY)).toEqual({ documento: '12345678909', nome: 'Fulano', tipo: 'CPF' })
    expect(await lerTomador(fakeSb(row), 'p1', randomBytes(32).toString('base64'))).toBeNull()
    expect(await lerTomador(fakeSb(null), 'p1', KEY)).toBeNull()
  })
})

describe('decifrar valida tamanhos', () => {
  it('rejeita iv e tag com tamanho errado', () => {
    const [v, iv, tag, data] = cifrar('x', KEY).split('.')
    const curto = Buffer.alloc(8).toString('base64')
    expect(() => decifrar([v, curto, tag, data].join('.'), KEY)).toThrow()
    expect(() => decifrar([v, iv, curto, data].join('.'), KEY)).toThrow()
  })
})
