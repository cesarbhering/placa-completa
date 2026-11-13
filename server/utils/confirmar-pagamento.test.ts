// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'
import { confirmarPagamentoDoPedido } from './confirmar-pagamento'

// The rule shared by the buyer's polling and the Woovi webhook. The provider
// modules are real; only their HTTP boundary ($fetch for Pix, fetch for
// Stripe) and the database are faked.
//
// Besides a charge status, a lookup in the tables below can be:
// - 'sem resposta': network error, the provider could not be reached;
// - 'erro 500': the provider answered with an error of its own;
// - 'nao existe': the provider answered that it has no such charge.

const PEDIDO = '11111111-1111-4111-8111-111111111111'
const WOOVI = 'https://woovi.test'
const ABACATE = 'https://abacate.test'
const STRIPE = 'https://api.stripe.com/v1'
const SEM_RESPOSTA = new Error('network down')
/** An HTTP error as ofetch throws it. */
const erroHttp = (status: number) => Object.assign(new Error(`[GET] ${status}`), { status, statusCode: status })

let db: ReturnType<typeof supabaseMemoria>

function semear(extra: Record<string, any> = {}) {
  const pedido = {
    id: PEDIDO, status: 'aguardando_pagamento', abacatepay_id: 'cob-do-pedido', pix_provider: 'woovi',
    forma_pagamento: 'pix', stripe_session_id: null, expira_em: '2999-01-01T00:00:00.000Z',
    ...extra,
  }
  db.tab('pedidos_premium').push({ ...pedido })
  return pedido
}
const pedidoNoBanco = () => db.tab('pedidos_premium')[0]

/** Woovi answer for GET /api/v1/charge/{id}. Its "not found" is the 400 that lookup documents. */
function woovi(caso: string, identifier: string) {
  if (caso === 'sem resposta') return SEM_RESPOSTA
  if (caso === 'erro 500') return erroHttp(500)
  if (caso === 'nao existe') return erroHttp(400)
  return { charge: { status: caso, identifier, correlationID: PEDIDO, value: 4490, brCode: '00020101021226-teste' } }
}
/** AbacatePay answer for GET /transparents/check. Its "not found" is a 404. */
function abacate(caso: string) {
  if (caso === 'sem resposta') return SEM_RESPOSTA
  if (caso === 'erro 500') return erroHttp(500)
  if (caso === 'nao existe') return erroHttp(404)
  return { data: { status: caso }, success: true, error: null }
}

function apiPix(respostas: Record<string, any>) {
  const api = vi.fn(async (url: string, opts: any = {}) => {
    const chave = opts.query?.id ? `${url}?id=${opts.query.id}` : url
    if (!(chave in respostas)) throw new Error(`unexpected provider call: ${chave}`)
    if (respostas[chave] instanceof Error) throw respostas[chave]
    return respostas[chave]
  })
  vi.stubGlobal('$fetch', api)
  return api
}

function apiStripe(respostas: Record<string, any>) {
  const api = vi.fn(async (url: string, _opts?: any) => {
    if (!(url in respostas)) throw new Error(`unexpected Stripe call: ${url}`)
    if (respostas[url] instanceof Error) throw respostas[url]
    return { ok: true, json: async () => respostas[url] }
  })
  vi.stubGlobal('fetch', api)
  return api
}

beforeEach(() => {
  db = supabaseMemoria()
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
  vi.stubGlobal('useRuntimeConfig', () => ({
    wooviAppId: 'app-id-de-teste', wooviBase: WOOVI,
    abacatepayApiKey: 'chave-abacate-de-teste', abacatepayBase: ABACATE,
    stripeSecretKey: 'chave-stripe-de-teste',
  }))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('confirmarPagamentoDoPedido', () => {
  describe('Woovi order inside its window: only the recorded charge is asked', () => {
    it.each([
      { cobranca: 'COMPLETED', esperado: 'pago' },
      { cobranca: 'ACTIVE', esperado: 'nao_pago' },
      { cobranca: 'EXPIRED', esperado: 'nao_pago' },
      { cobranca: 'nao existe', esperado: 'nao_pago' },
      { cobranca: 'sem resposta', esperado: 'indeterminado' },
      { cobranca: 'erro 500', esperado: 'indeterminado' },
    ])('recorded charge $cobranca: $esperado', async ({ cobranca, esperado }) => {
      const pedido = semear()
      const api = apiPix({ [`${WOOVI}/api/v1/charge/cob-do-pedido`]: woovi(cobranca, 'cob-do-pedido') })

      expect(await confirmarPagamentoDoPedido(db, pedido)).toBe(esperado)

      expect(api.mock.calls.map((c) => c[0])).toEqual([`${WOOVI}/api/v1/charge/cob-do-pedido`])
      expect(api.mock.calls[0]![1]).toMatchObject({ method: 'GET', headers: { Authorization: 'app-id-de-teste' } })
    })
  })

  describe('order pointing to another provider: the original Woovi charge is the safety net', () => {
    const outroProvedor = { pix_provider: 'abacatepay', abacatepay_id: 'cob-abacate' }

    it.each([
      { gravada: 'PENDING', original: 'COMPLETED', esperado: 'pago' },
      { gravada: 'sem resposta', original: 'COMPLETED', esperado: 'pago' },
      { gravada: 'nao existe', original: 'COMPLETED', esperado: 'pago' },
      { gravada: 'PENDING', original: 'ACTIVE', esperado: 'nao_pago' },
      // An order born on the fallback provider has no original Woovi charge.
      { gravada: 'PENDING', original: 'nao existe', esperado: 'nao_pago' },
      { gravada: 'nao existe', original: 'ACTIVE', esperado: 'nao_pago' },
      { gravada: 'nao existe', original: 'nao existe', esperado: 'nao_pago' },
      { gravada: 'PENDING', original: 'sem resposta', esperado: 'indeterminado' },
      { gravada: 'PENDING', original: 'erro 500', esperado: 'indeterminado' },
      { gravada: 'sem resposta', original: 'ACTIVE', esperado: 'indeterminado' },
      { gravada: 'sem resposta', original: 'nao existe', esperado: 'indeterminado' },
      { gravada: 'nao existe', original: 'sem resposta', esperado: 'indeterminado' },
      { gravada: 'sem resposta', original: 'sem resposta', esperado: 'indeterminado' },
    ])('recorded charge $gravada, original charge $original: $esperado', async ({ gravada, original, esperado }) => {
      const pedido = semear(outroProvedor)
      apiPix({
        [`${ABACATE}/transparents/check?id=cob-abacate`]: abacate(gravada),
        [`${WOOVI}/api/v1/charge/${PEDIDO}`]: woovi(original, 'cob-original'),
      })

      expect(await confirmarPagamentoDoPedido(db, pedido)).toBe(esperado)
    })

    it('recorded charge paid: the original charge is not asked', async () => {
      const pedido = semear(outroProvedor)
      const api = apiPix({ [`${ABACATE}/transparents/check?id=cob-abacate`]: abacate('PAID') })

      expect(await confirmarPagamentoDoPedido(db, pedido)).toBe('pago')

      expect(api).toHaveBeenCalledTimes(1)
      expect(api.mock.calls[0]![1]).toMatchObject({ headers: { Authorization: 'Bearer chave-abacate-de-teste' } })
    })

    it('original charge paid: repoints the order, in the database and in the object handed in', async () => {
      const pedido = semear(outroProvedor)
      apiPix({
        [`${ABACATE}/transparents/check?id=cob-abacate`]: abacate('PENDING'),
        [`${WOOVI}/api/v1/charge/${PEDIDO}`]: woovi('COMPLETED', 'cob-original'),
      })

      await confirmarPagamentoDoPedido(db, pedido)

      expect(pedidoNoBanco()).toMatchObject({ pix_provider: 'woovi', abacatepay_id: 'cob-original', status: 'aguardando_pagamento' })
      expect(pedido).toMatchObject({ pix_provider: 'woovi', abacatepay_id: 'cob-original' })
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(PEDIDO))
    })

    it('original charge not paid: the order is left as it was', async () => {
      const pedido = semear(outroProvedor)
      const antes = { ...pedidoNoBanco() }
      apiPix({
        [`${ABACATE}/transparents/check?id=cob-abacate`]: abacate('PENDING'),
        [`${WOOVI}/api/v1/charge/${PEDIDO}`]: woovi('ACTIVE', 'cob-original'),
      })

      await confirmarPagamentoDoPedido(db, pedido)

      expect(pedidoNoBanco()).toEqual(antes)
      expect(pedido).toMatchObject(outroProvedor)
    })
  })

  it('Woovi order past its window: the original charge is asked too', async () => {
    const pedido = semear({ expira_em: '2000-01-01T00:00:00.000Z' })
    const api = apiPix({
      [`${WOOVI}/api/v1/charge/cob-do-pedido`]: woovi('EXPIRED', 'cob-do-pedido'),
      [`${WOOVI}/api/v1/charge/${PEDIDO}`]: woovi('EXPIRED', 'cob-do-pedido'),
    })

    expect(await confirmarPagamentoDoPedido(db, pedido)).toBe('nao_pago')

    expect(api.mock.calls.map((c) => c[0])).toEqual([`${WOOVI}/api/v1/charge/cob-do-pedido`, `${WOOVI}/api/v1/charge/${PEDIDO}`])
  })

  describe('card order', () => {
    const cartao = { forma_pagamento: 'cartao', abacatepay_id: null, pix_provider: null, stripe_session_id: 'cs_sessao_de_teste' }
    const SESSAO = `${STRIPE}/checkout/sessions/cs_sessao_de_teste`
    const sessao = (payment_status: string) => ({ id: 'cs_sessao_de_teste', payment_status, status: 'open', url: null })

    it.each([
      { stripe: sessao('paid'), esperado: 'pago' },
      { stripe: sessao('unpaid'), esperado: 'nao_pago' },
      { stripe: SEM_RESPOSTA, esperado: 'indeterminado' },
    ])('Checkout Session lookup -> $esperado', async ({ stripe, esperado }) => {
      const pedido = semear(cartao)
      const pix = apiPix({})
      const api = apiStripe({ [SESSAO]: stripe })

      expect(await confirmarPagamentoDoPedido(db, pedido)).toBe(esperado)

      expect(api).toHaveBeenCalledWith(SESSAO, { headers: { Authorization: 'Bearer chave-stripe-de-teste' } })
      // A card order never falls back to the original Woovi charge.
      expect(pix).not.toHaveBeenCalled()
    })

    it('PaymentIntent id: asks the PaymentIntent', async () => {
      const pedido = semear({ ...cartao, stripe_session_id: 'pi_intent_de_teste' })
      apiPix({})
      const api = apiStripe({ [`${STRIPE}/payment_intents/pi_intent_de_teste`]: { id: 'pi_intent_de_teste', status: 'succeeded' } })

      expect(await confirmarPagamentoDoPedido(db, pedido)).toBe('pago')

      expect(api).toHaveBeenCalledTimes(1)
    })

    it('unpaid at Stripe but with a paid Pix charge: pago', async () => {
      const pedido = semear({ ...cartao, abacatepay_id: 'cob-do-pedido', pix_provider: 'woovi' })
      apiStripe({ [SESSAO]: sessao('unpaid') })
      apiPix({ [`${WOOVI}/api/v1/charge/cob-do-pedido`]: woovi('COMPLETED', 'cob-do-pedido') })

      expect(await confirmarPagamentoDoPedido(db, pedido)).toBe('pago')
    })
  })
})
