// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const reconciliar = vi.fn(async () => ({ enfileiradas: 1, atualizadas: 2, emails: 3, cancelamentos: 4 }))
vi.mock('../../../utils/nfse', () => ({ reconciliarNfse: reconciliar }))

function ambiente(nfse = 'on') {
  const status: number[] = []
  vi.stubGlobal('defineEventHandler', (f: any) => f)
  vi.stubGlobal('useRuntimeConfig', () => ({ adminSecret: 'segredo', nfse }))
  vi.stubGlobal('createError', (e: any) => Object.assign(new Error(e.message), e))
  vi.stubGlobal('getRequestHeader', (ev: any, h: string) => ev.headers[h])
  vi.stubGlobal('setResponseStatus', (_e: any, c: number) => { status.push(c) })
  vi.stubGlobal('usePremiumSupabase', () => ({}))
  return status
}

describe('POST /api/premium/nfse/reconciliar', () => {
  beforeEach(() => reconciliar.mockClear())
  afterEach(() => vi.unstubAllGlobals())

  it('without the secret: 404 and nothing runs', async () => {
    ambiente()
    const h = (await import('./reconciliar.post')).default as any
    await expect(h({ headers: {} })).rejects.toMatchObject({ statusCode: 404 })
    await expect(h({ headers: { 'x-admin-secret': 'errado' } })).rejects.toMatchObject({ statusCode: 404 })
    expect(reconciliar).not.toHaveBeenCalled()
  })

  it('flag off: 404', async () => {
    ambiente('')
    const h = (await import('./reconciliar.post')).default as any
    await expect(h({ headers: { 'x-admin-secret': 'segredo' } })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('202 with the counters', async () => {
    const st = ambiente()
    const h = (await import('./reconciliar.post')).default as any
    expect(await h({ headers: { 'x-admin-secret': 'segredo' } })).toEqual({ enfileiradas: 1, atualizadas: 2, emails: 3, cancelamentos: 4 })
    expect(st).toEqual([202])
  })
})
