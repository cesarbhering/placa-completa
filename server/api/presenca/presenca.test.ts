// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _zerarPresenca, resumoPresenca } from '../../utils/presenca'

// Made-up values only: nothing here is a real plate or a real order token.
const PLACA = 'ABC1D23'
const ID = '0123456789abcdef0123456789abcdef'
const UA_CELULAR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const SEGREDO = 'segredo-de-teste'

let headers: Record<string, string>
let body: any
let status: number | null
let config: any
const respostaHeaders: Record<string, string> = {}
const lerCorpo = vi.fn(async () => body)

vi.stubGlobal('defineEventHandler', (f: any) => f)
vi.stubGlobal('setResponseStatus', (_e: any, s: number) => { status = s })
vi.stubGlobal('setHeader', (_e: any, nome: string, valor: string) => { respostaHeaders[nome] = valor })
vi.stubGlobal('getHeader', (_e: any, nome: string) => headers[nome.toLowerCase()])
vi.stubGlobal('getRequestHeader', (_e: any, nome: string) => headers[nome.toLowerCase()])
vi.stubGlobal('readBody', lerCorpo)
vi.stubGlobal('useRuntimeConfig', () => config)
vi.stubGlobal('createError', (e: any) => Object.assign(new Error(e.message), e))
vi.mock('../../utils/dispositivo', () => ({ getDispositivo: () => ({ dispositivo: 'celular', sistema: 'ios', canal: 'web', app_versao: null }) }))

const beacon = (await import('./index.post')).default as any
const resumo = (await import('./resumo.post')).default as any

beforeEach(() => {
  _zerarPresenca()
  headers = { 'user-agent': UA_CELULAR, 'content-type': 'application/json', 'content-length': '64' }
  body = { id: ID, pagina: '/placa/:placa' }
  status = null
  config = { adminSecret: SEGREDO }
  lerCorpo.mockClear()
  for (const k of Object.keys(respostaHeaders)) delete respostaHeaders[k]
})

describe('POST /api/presenca (public beacon)', () => {
  it('a body without a declared size (chunked) or above 1 KB is never read (rev-804)', async () => {
    for (const cl of [undefined, '0', '1025', '20000000', 'abc']) {
      if (cl === undefined) delete headers['content-length']
      else headers['content-length'] = cl
      lerCorpo.mockClear()
      await beacon({})
      expect(status).toBe(204)
      expect(lerCorpo).not.toHaveBeenCalled()
    }
    expect(resumoPresenca().online).toBe(0)
  })

  it('a form posted from another site does not count; only JSON does (rev-804)', async () => {
    for (const tipo of ['application/x-www-form-urlencoded', 'text/plain', 'multipart/form-data', '']) {
      headers['content-type'] = tipo
      await beacon({})
      expect(status).toBe(204)
    }
    expect(lerCorpo).not.toHaveBeenCalled()
    expect(resumoPresenca().online).toBe(0)
    headers['content-type'] = 'application/json; charset=utf-8'
    await beacon({})
    expect(resumoPresenca().online).toBe(1)
  })

  it('counts the tab on its page and answers 204 with nothing to read', async () => {
    expect(await beacon({})).toBeNull()
    expect(status).toBe(204)
    expect(resumoPresenca()).toMatchObject({ online: 1, por_pagina: [{ path: '/placa/:placa', n: 1 }], por_dispositivo: { celular: 1 } })
  })

  it('a raw path with a plate and a query is stored as its pattern only', async () => {
    body = { id: ID, pagina: `/placa/${PLACA}?utm_source=google#x`, placa: PLACA, email: 'joao@example.com' }
    await beacon({})
    const r = resumoPresenca()
    expect(r.por_pagina).toEqual([{ path: '/placa/:placa', n: 1 }])
    expect(JSON.stringify(r)).not.toMatch(new RegExp(`${PLACA}|utm|example`, 'i'))
  })

  it('"checkout" counts as checkout; an unknown path as "outra"', async () => {
    body = { id: ID, pagina: 'checkout' }
    await beacon({})
    body = { id: ID.replace('0', 'f'), pagina: '/wp-login.php' }
    await beacon({})
    expect(resumoPresenca().por_pagina).toEqual([{ path: 'checkout', n: 1 }, { path: 'outra', n: 1 }])
  })

  it.each([
    ['no id', { pagina: '/' }],
    ['an invalid id', { id: 'curto', pagina: '/' }],
    ['an id with markup', { id: '<script>alert(1)</script>xxxxxxxx', pagina: '/' }],
    ['a body that is not an object', 'texto'],
    ['no body', null],
  ])('%s: 204 and not counted', async (_caso, corpo) => {
    body = corpo
    expect(await beacon({})).toBeNull()
    expect(status).toBe(204)
    expect(resumoPresenca().online).toBe(0)
  })

  it('a body that fails to parse: 204 and not counted', async () => {
    lerCorpo.mockRejectedValueOnce(new Error('json invalido'))
    expect(await beacon({})).toBeNull()
    expect(status).toBe(204)
    expect(resumoPresenca().online).toBe(0)
  })

  it('the checkout probe (x-pc-sonda: 1) is not a person', async () => {
    headers['x-pc-sonda'] = '1'
    await beacon({})
    expect(resumoPresenca().online).toBe(0)
    expect(lerCorpo).not.toHaveBeenCalled()
  })

  it.each([
    ['a crawler', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['a headless browser', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36'],
    ['no user agent', ''],
  ])('%s is not a person', async (_caso, ua) => {
    headers['user-agent'] = ua
    await beacon({})
    expect(resumoPresenca().online).toBe(0)
    expect(lerCorpo).not.toHaveBeenCalled()
  })

  it('a body bigger than any of ours is not even read', async () => {
    headers['content-length'] = '5000'
    await beacon({})
    expect(lerCorpo).not.toHaveBeenCalled()
    expect(resumoPresenca().online).toBe(0)
  })

  it('fail-open: a header read that throws still answers 204', async () => {
    vi.stubGlobal('getHeader', () => { throw new Error('boom') })
    try {
      expect(await beacon({})).toBeNull()
      expect(status).toBe(204)
    } finally {
      vi.stubGlobal('getHeader', (_e: any, nome: string) => headers[nome.toLowerCase()])
    }
  })
})

describe('POST /api/presenca/resumo (operator only)', () => {
  const chamar = async (h: Record<string, string>) => {
    headers = h
    return resumo({ headers: h })
  }

  it.each([
    ['no header', {}],
    ['a wrong secret', { 'x-admin-secret': 'errado' }],
    ['a wrong secret of the same length', { 'x-admin-secret': 'segredo-de-testE' }],
  ])('%s: 404, and nothing of the summary goes out', async (_caso, h) => {
    await expect(chamar(h)).rejects.toMatchObject({ statusCode: 404 })
    expect(respostaHeaders).toEqual({})
  })

  it('secret not configured: 404 whatever is sent', async () => {
    config.adminSecret = ''
    await expect(chamar({})).rejects.toMatchObject({ statusCode: 404 })
    await expect(chamar({ 'x-admin-secret': '' })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('right secret: counts only, never cached', async () => {
    await beacon({})
    const r = await chamar({ 'x-admin-secret': SEGREDO })
    expect(r).toMatchObject({ online: 1, por_pagina: [{ path: '/placa/:placa', n: 1 }], janela_s: 120 })
    expect(typeof r.atualizado_em).toBe('string')
    expect(JSON.stringify(r)).not.toContain(ID)
    expect(respostaHeaders['cache-control']).toBe('no-store')
  })
})
