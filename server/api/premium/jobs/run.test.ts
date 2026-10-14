// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { _resetarEmVoo, marcarEncerrando } from '../../../utils/tarefas-em-voo'
import { _resetarLote } from '../../../utils/premium-jobs'

function ambiente(rpc: any) {
  const status: number[] = []
  vi.stubGlobal('defineEventHandler', (f: any) => f)
  vi.stubGlobal('useRuntimeConfig', () => ({ adminSecret: 'segredo' }))
  vi.stubGlobal('createError', (e: any) => Object.assign(new Error(e.message), e))
  vi.stubGlobal('getRequestHeader', (ev: any, h: string) => ev.headers[h])
  vi.stubGlobal('readBody', async () => ({}))
  vi.stubGlobal('setResponseStatus', (_e: any, c: number) => { status.push(c) })
  vi.stubGlobal('usePremiumSupabase', () => ({ rpc, from: () => ({}) }))
  return status
}

describe('POST /api/premium/jobs/run', () => {
  beforeEach(() => { _resetarEmVoo(); _resetarLote() })
  afterEach(() => vi.unstubAllGlobals())

  it('sem segredo: 404', async () => {
    ambiente(vi.fn())
    const h = (await import('./run.post')).default as any
    await expect(h({ headers: {} })).rejects.toMatchObject({ statusCode: 404 })
  })
  it('202 com o que reivindicou (vazio); 503 depois do SIGTERM', async () => {
    const st = ambiente(vi.fn(async () => ({ data: [], error: null })))
    const h = (await import('./run.post')).default as any
    expect(await h({ headers: { 'x-admin-secret': 'segredo' } })).toEqual({ reivindicados: 0, ids: [], em_voo: 0 })
    expect(st).toEqual([202])
    marcarEncerrando()
    expect(await h({ headers: { 'x-admin-secret': 'segredo' } })).toEqual({ encerrando: true })
    expect(st).toEqual([202, 503])
  })
})
