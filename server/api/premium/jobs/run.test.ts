// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { _resetarEmVoo, marcarEncerrando, quantasEmVoo } from '../../../utils/tarefas-em-voo'
import { _resetarLote } from '../../../utils/premium-jobs'

/** Supabase stub: every list query answers empty; `ors` records the app sweep's filter. */
function supabaseVazio(rpc: any, opts: { segurarPedido?: Promise<void> } = {}) {
  const ors: string[] = []
  const from = vi.fn((_tabela: string) => {
    const b: any = {
      maybeSingle: async () => { if (opts.segurarPedido) await opts.segurarPedido; return { data: null, error: null } },
      or: (expr: string) => { ors.push(expr); return b },
      then: (res: any, rej: any) => Promise.resolve({ data: [], error: null }).then(res, rej),
    }
    for (const m of ['select', 'eq', 'is', 'not', 'in', 'gte', 'lte', 'order', 'limit', 'update']) b[m] = () => b
    return b
  })
  return { cliente: { rpc, from }, ors }
}

function ambiente(rpc: any, opts: { segurarPedido?: Promise<void> } = {}) {
  const status: number[] = []
  const sb = supabaseVazio(rpc, opts)
  vi.stubGlobal('defineEventHandler', (f: any) => f)
  vi.stubGlobal('useRuntimeConfig', () => ({ adminSecret: 'segredo' }))
  vi.stubGlobal('createError', (e: any) => Object.assign(new Error(e.message), e))
  vi.stubGlobal('getRequestHeader', (ev: any, h: string) => ev.headers[h])
  vi.stubGlobal('readBody', async () => ({}))
  vi.stubGlobal('setResponseStatus', (_e: any, c: number) => { status.push(c) })
  vi.stubGlobal('usePremiumSupabase', () => sb.cliente)
  return { status, ors: sb.ors }
}

const COM_SEGREDO = { headers: { 'x-admin-secret': 'segredo' } }

describe('POST /api/premium/jobs/run', () => {
  beforeEach(() => { _resetarEmVoo(); _resetarLote() })
  afterEach(() => vi.unstubAllGlobals())

  it('sem segredo: 404', async () => {
    ambiente(vi.fn())
    const h = (await import('./run.post')).default as any
    await expect(h({ headers: {} })).rejects.toMatchObject({ statusCode: 404 })
  })
  it('202 com o que reivindicou (vazio); 503 depois do SIGTERM', async () => {
    const { status } = ambiente(vi.fn(async () => ({ data: [], error: null })))
    const h = (await import('./run.post')).default as any
    expect(await h(COM_SEGREDO)).toEqual({ reivindicados: 0, ids: [], em_voo: 0 })
    expect(status).toEqual([202])
    marcarEncerrando()
    expect(await h(COM_SEGREDO)).toEqual({ encerrando: true })
    expect(status).toEqual([202, 503])
  })

  it('202: also starts the report-complete sweep of app purchases in the background, with the same reply', async () => {
    const { ors } = ambiente(vi.fn(async () => ({ data: [], error: null })))
    const h = (await import('./run.post')).default as any
    expect(await h(COM_SEGREDO)).toEqual({ reivindicados: 0, ids: [], em_voo: 0 })
    await vi.waitFor(() => expect(quantasEmVoo()).toBe(0))
    expect(ors).toEqual(['canal.eq.app,forma_pagamento.eq.google_play,pix_provider.eq.google_play'])
  })

  it('409 while a batch runs in this container: the sweep still runs, so a long batch cannot starve it', async () => {
    let soltar!: () => void
    const segurarPedido = new Promise<void>((r) => { soltar = r })
    const rpc = vi.fn(async (nome: string) => nome === 'premium_jobs_reivindicar'
      ? { data: [{ id: 'job-ficticio', pedido_id: 'pedido-ficticio', fonte: 'detran' }], error: null }
      : { data: null, error: null })
    const { status, ors } = ambiente(rpc, { segurarPedido })
    const h = (await import('./run.post')).default as any
    expect(await h(COM_SEGREDO)).toMatchObject({ reivindicados: 1 })
    await vi.waitFor(() => expect(ors).toHaveLength(1))
    // The first sweep is over; only the held batch is still in flight.
    await vi.waitFor(() => expect(quantasEmVoo()).toBe(1))
    expect(await h(COM_SEGREDO)).toMatchObject({ rodando: true })
    expect(status).toEqual([202, 409])
    await vi.waitFor(() => expect(ors).toHaveLength(2))
    soltar()
    await vi.waitFor(() => expect(quantasEmVoo()).toBe(0))
  })

  it('503 after SIGTERM: no sweep starts (the new container takes over)', async () => {
    const { ors } = ambiente(vi.fn(async () => ({ data: [], error: null })))
    const h = (await import('./run.post')).default as any
    marcarEncerrando()
    expect(await h(COM_SEGREDO)).toEqual({ encerrando: true })
    await new Promise((r) => setTimeout(r, 10))
    expect(ors).toEqual([])
  })
})
