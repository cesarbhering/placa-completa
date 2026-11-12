// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'

const SECRET = 'segredo-de-teste'
let raw = ''; let headers: Record<string, string> = {}; let config: any
const aplicar = vi.fn(async () => {}); const supa = vi.fn()
let pedido: any = { id: 'p1' }
vi.mock('../../../utils/nfse', () => ({ aplicarEstadoNfse: (...a: any[]) => aplicar(...a) }))

beforeEach(() => {
  aplicar.mockClear(); supa.mockClear(); pedido = { id: 'p1' }
  config = { nfse: 'on', nfseWebhookSecret: SECRET }
  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('readRawBody', async () => raw)
  vi.stubGlobal('getRequestHeader', (_e: any, h: string) => headers[h.toLowerCase()])
  vi.stubGlobal('setResponseStatus', () => {})
  vi.stubGlobal('useRuntimeConfig', () => config)
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message || o.statusMessage || 'err'), o))
  vi.stubGlobal('usePremiumSupabase', () => { supa(); return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: pedido, error: null }) }) }) }) } })
})
afterEach(() => vi.unstubAllGlobals())

const sign = (b: string) => 'sha256=' + createHmac('sha256', SECRET).update(b).digest('hex')
async function chamar(corpo: string, assinatura?: string) {
  raw = corpo; headers = assinatura ? { 'x-nfse-assinatura': assinatura } : {}
  const { default: h } = await import('./webhook.post')
  return h({} as any)
}
const BODY = JSON.stringify({ evento: 'nota.emitida', nota: { id: 'n1', referencia: 'p1', estado: 'emitida' } })

describe('NFS-e webhook route', () => {
  it('missing signature: 401, no db call', async () => {
    const r: any = await chamar(BODY)
    expect(r).toEqual({ erro: 'assinatura_invalida' }); expect(supa).not.toHaveBeenCalled(); expect(aplicar).not.toHaveBeenCalled()
  })
  it('bad signature: 401, no db call', async () => {
    const r: any = await chamar(BODY, 'sha256=' + '0'.repeat(64))
    expect(r).toEqual({ erro: 'assinatura_invalida' }); expect(supa).not.toHaveBeenCalled()
  })
  it('signature of a different length: 401, no throw', async () => {
    expect(await chamar(BODY, 'sha256=abc')).toEqual({ erro: 'assinatura_invalida' })
  })
  it('valid signature: applies state and answers ok', async () => {
    expect(await chamar(BODY, sign(BODY))).toEqual({ ok: true })
    expect(aplicar).toHaveBeenCalledTimes(1)
    expect((aplicar.mock.calls[0] as any[])[2]).toMatchObject({ id: 'n1', estado: 'emitida' })
  })
  it('unknown order: still ok, nothing applied', async () => {
    pedido = null
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await chamar(BODY, sign(BODY))).toEqual({ ok: true })
    expect(aplicar).not.toHaveBeenCalled(); warn.mockRestore()
  })
  it('invalid JSON with valid signature: 400', async () => {
    const b = 'not json'
    await expect(chamar(b, sign(b))).rejects.toMatchObject({ statusCode: 400 })
  })
  it('flag off: 404', async () => {
    config = { nfse: '', nfseWebhookSecret: SECRET }
    await expect(chamar(BODY, sign(BODY))).rejects.toMatchObject({ statusCode: 404 })
  })
  it('no secret: 404', async () => {
    config = { nfse: 'on', nfseWebhookSecret: '' }
    await expect(chamar(BODY, sign(BODY))).rejects.toMatchObject({ statusCode: 404 })
  })
})
