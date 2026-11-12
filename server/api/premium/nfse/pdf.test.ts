// @vitest-environment node
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { ErroNfseIndisponivel } from '../../../utils/nfse-provedor'

let servirPdf: (d: any) => Promise<any>
beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
  servirPdf = (await import('./[token]/pdf.get')).servirPdf
})

const pedido = { id: 'abcdef12-0000', nfse_id: 'n1', nfse_status: 'emitida', nfse_numero: '42' }
function deps(over: Record<string, any> = {}) {
  return {
    token: 'tok12345',
    flag: 'on',
    carregar: vi.fn().mockResolvedValue(pedido),
    pdf: vi.fn().mockResolvedValue(Buffer.from('%PDF')),
    ...over,
  }
}

describe('servirPdf', () => {
  it('404 on a malformed token without touching the database', async () => {
    const d = deps({ token: 'a/../b' })
    await expect(servirPdf(d)).rejects.toMatchObject({ statusCode: 404 })
    expect(d.carregar).not.toHaveBeenCalled()
  })
  it('404 when the order does not exist', async () => {
    await expect(servirPdf(deps({ carregar: vi.fn().mockResolvedValue(null) }))).rejects.toMatchObject({ statusCode: 404 })
  })
  it('404 when the flag is off', async () => {
    await expect(servirPdf(deps({ flag: '' }))).rejects.toMatchObject({ statusCode: 404 })
  })
  it('404 without nfse_id', async () => {
    const d = deps({ carregar: vi.fn().mockResolvedValue({ ...pedido, nfse_id: null }) })
    await expect(servirPdf(d)).rejects.toMatchObject({ statusCode: 404 })
    expect(d.pdf).not.toHaveBeenCalled()
  })
  it('404 when status is not emitida or cancelada', async () => {
    const d = deps({ carregar: vi.fn().mockResolvedValue({ ...pedido, nfse_status: 'enfileirada' }) })
    await expect(servirPdf(d)).rejects.toMatchObject({ statusCode: 404 })
  })
  it('success: headers and bytes', async () => {
    const r = await servirPdf(deps())
    expect(r.headers).toEqual({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="nfse-42.pdf"',
      'Cache-Control': 'private, no-cache',
    })
    expect(r.body.toString()).toBe('%PDF')
  })
  it('filename falls back to the order id when there is no number', async () => {
    const r = await servirPdf(deps({ carregar: vi.fn().mockResolvedValue({ ...pedido, nfse_numero: null }) }))
    expect(r.headers['Content-Disposition']).toBe('inline; filename="nfse-abcdef12-0000.pdf"')
  })
  it('issuer unavailable: 503 with the exact message', async () => {
    const d = deps({ pdf: vi.fn().mockRejectedValue(new ErroNfseIndisponivel()) })
    await expect(servirPdf(d)).rejects.toMatchObject({
      statusCode: 503,
      message: 'Nota fiscal temporariamente indisponível. Tente de novo em alguns minutos.',
    })
  })
  it('any other error: 404', async () => {
    const d = deps({ pdf: vi.fn().mockRejectedValue(new Error('boom')) })
    await expect(servirPdf(d)).rejects.toMatchObject({ statusCode: 404 })
  })
})
