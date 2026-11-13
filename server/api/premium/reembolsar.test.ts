// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabaseMemoria } from '../../../tests/helpers/supabase-memoria'
import { provedorDoPedido } from '../../utils/pix-provider'

// POST /api/premium/reembolsar: operator-only retry of a refund. The Pix
// provider modules are real; only their HTTP boundary ($fetch) and the
// database are faked.

const cancelarNota = vi.fn(async () => {})
vi.mock('../../utils/nfse', () => ({ cancelarNfse: (...a: any[]) => cancelarNota(...a) }))

const SEGREDO = 'segredo-de-teste'
const TOKEN = 'token-de-teste'
const PEDIDO = '11111111-1111-4111-8111-111111111111'
const WOOVI = 'https://woovi.test'
const ESTORNO = `${WOOVI}/api/v1/charge/cob-do-pedido/refund`

let db: ReturnType<typeof supabaseMemoria>
let config: any
let api: ReturnType<typeof vi.fn>
const gate = vi.fn()

function semear(extra: Record<string, any> = {}) {
  db.tab('pedidos_premium').push({ id: PEDIDO, token_entrega: TOKEN, status: 'falha', abacatepay_id: 'cob-do-pedido', pix_provider: 'woovi', ...extra })
}
const pedidoNoBanco = () => db.tab('pedidos_premium')[0]

async function reembolsar(headers: Record<string, string>, body: any = { token: TOKEN }) {
  const { default: handler } = await import('./reembolsar.post')
  return (handler as any)({ headers, body })
}
const comSegredo = { 'x-admin-secret': SEGREDO }

beforeEach(() => {
  db = supabaseMemoria()
  config = { adminSecret: SEGREDO, wooviAppId: 'app-id-de-teste', wooviBase: WOOVI, public: { gated: false } }
  api = vi.fn(async () => ({ refund: { status: 'IN_PROCESSING' } }))
  cancelarNota.mockClear()
  gate.mockReset()
  vi.stubGlobal('defineEventHandler', (f: any) => f)
  vi.stubGlobal('useRuntimeConfig', () => config)
  vi.stubGlobal('createError', (e: any) => Object.assign(new Error(e.message), e))
  vi.stubGlobal('getRequestHeader', (ev: any, nome: string) => ev.headers[nome])
  vi.stubGlobal('readBody', async (ev: any) => ev.body)
  vi.stubGlobal('usePremiumSupabase', () => db)
  vi.stubGlobal('provedorDoPedido', provedorDoPedido)
  vi.stubGlobal('assertPremiumGate', gate)
  vi.stubGlobal('$fetch', api)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('POST /api/premium/reembolsar', () => {
  it.each([
    ['no header', {}],
    ['a wrong secret', { 'x-admin-secret': 'errado' }],
  ])('%s: 404 and no refund is requested, even with the order token', async (_caso, headers) => {
    semear()
    const antes = { ...pedidoNoBanco() }

    await expect(reembolsar(headers)).rejects.toMatchObject({ statusCode: 404 })

    expect(api).not.toHaveBeenCalled()
    expect(pedidoNoBanco()).toEqual(antes)
  })

  it('right secret: refunds the charge at its provider and marks the order reembolsado', async () => {
    semear()

    expect(await reembolsar(comSegredo)).toEqual({ ok: true, error: null })

    expect(api).toHaveBeenCalledTimes(1)
    expect(api).toHaveBeenCalledWith(ESTORNO, expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ Authorization: 'app-id-de-teste' }),
    }))
    expect(pedidoNoBanco()).toMatchObject({ status: 'reembolsado' })
    expect(cancelarNota).toHaveBeenCalledWith(db, PEDIDO)
  })

  it('order already refunded: idempotent, no second refund', async () => {
    semear({ status: 'reembolsado' })

    expect(await reembolsar(comSegredo)).toEqual({ ok: true, jaReembolsado: true })

    expect(api).not.toHaveBeenCalled()
    expect(cancelarNota).not.toHaveBeenCalled()
  })

  it('refund refused by the provider: reports the error and keeps the order status', async () => {
    semear()
    api.mockRejectedValue(Object.assign(new Error('refused'), { data: { error: 'INSUFFICIENT_FUNDS' } }))

    expect(await reembolsar(comSegredo)).toEqual({ ok: false, error: 'INSUFFICIENT_FUNDS' })

    expect(pedidoNoBanco()).toMatchObject({ status: 'falha' })
    expect(cancelarNota).not.toHaveBeenCalled()
  })

  it('protected environment: the operator secret is what counts, the premium gate is not consulted', async () => {
    config.public.gated = true
    semear()

    await expect(reembolsar({})).rejects.toMatchObject({ statusCode: 404 })
    expect(await reembolsar(comSegredo)).toEqual({ ok: true, error: null })

    expect(gate).not.toHaveBeenCalled()
  })

  it.each([
    ['missing token', 400, {}],
    ['unknown token', 404, { token: 'outro-token' }],
  ])('right secret, %s: %i', async (_caso, statusCode, body) => {
    semear()

    await expect(reembolsar(comSegredo, body)).rejects.toMatchObject({ statusCode })

    expect(api).not.toHaveBeenCalled()
  })

  it('right secret, order without a charge: 409', async () => {
    semear({ abacatepay_id: null })

    await expect(reembolsar(comSegredo)).rejects.toMatchObject({ statusCode: 409 })

    expect(api).not.toHaveBeenCalled()
  })
})
