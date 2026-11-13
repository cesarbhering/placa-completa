// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabaseMemoria } from '../../../tests/helpers/supabase-memoria'

// GET /api/premium/status: the buyer's polling while the order is pending.
// The payment rule runs against the real provider modules; only the HTTP
// boundary ($fetch for the Pix providers, fetch for Stripe) and the database
// are faked.

const gravarHash = vi.fn()
vi.mock('../../utils/pagador-hash', async (original) => ({
  ...(await original<typeof import('../../utils/pagador-hash')>()),
  gravarPagadorHash: (...a: any[]) => gravarHash(...a),
}))

const PEDIDO = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'token-de-teste'
const WOOVI = 'https://woovi.test'
const ABACATE = 'https://abacate.test'
const STRIPE = 'https://api.stripe.com/v1'

let db: ReturnType<typeof supabaseMemoria>
let config: any
const processar = vi.fn(async () => {})

function semear(extra: Record<string, any> = {}) {
  db.tab('pedidos_premium').push({
    id: PEDIDO, status: 'aguardando_pagamento', placa: 'TESTE01', email: null, token_entrega: TOKEN,
    abacatepay_id: 'cob-do-pedido', pix_provider: 'woovi', forma_pagamento: 'pix', stripe_session_id: null,
    expira_em: '2999-01-01T00:00:00.000Z', plano: 'completa', ambiente: 'producao',
    debug_trace: [{ etapa: 'config' }], erro: 'erro-de-teste', valor_centavos: 4490,
    entregue_em: null, relatorio_snapshot: null, snapshot_em: null,
    ...extra,
  })
}
const pedidoNoBanco = () => db.tab('pedidos_premium')[0]

/** Woovi answer for GET /api/v1/charge/{id}. */
const cobrancaWoovi = (status: string, identifier: string) => ({
  charge: { status, identifier, correlationID: PEDIDO, value: 4490, brCode: '00020101021226-teste', expiresDate: '2999-01-01T00:00:00.000Z' },
})

/** Fake HTTP boundary of the Pix providers. Keys are `URL` or `URL?id=...`; an Error value is thrown. */
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

/** Fake Stripe REST API (the Stripe module uses the global fetch). */
function apiStripe(respostas: Record<string, any>) {
  const api = vi.fn(async (url: string, _opts?: any) => {
    if (!(url in respostas)) throw new Error(`unexpected Stripe call: ${url}`)
    return { ok: true, json: async () => respostas[url] }
  })
  vi.stubGlobal('fetch', api)
  return api
}

async function status(query: Record<string, any> = { token: TOKEN }) {
  const { default: handler } = await import('./status.get')
  return (handler as any)({ query })
}

beforeEach(() => {
  db = supabaseMemoria()
  processar.mockClear()
  gravarHash.mockClear()
  config = {
    wooviAppId: 'app-id-de-teste', wooviBase: WOOVI,
    abacatepayApiKey: 'chave-abacate-de-teste', abacatepayBase: ABACATE,
    stripeSecretKey: 'chave-stripe-de-teste',
    public: { gated: false },
  }
  vi.stubGlobal('defineEventHandler', (f: any) => f)
  vi.stubGlobal('getQuery', (ev: any) => ev.query || {})
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
  vi.stubGlobal('useRuntimeConfig', () => config)
  vi.stubGlobal('usePremiumSupabase', () => db)
  vi.stubGlobal('processarPedidoPago', processar)
  vi.stubGlobal('temRecallPendente', (resposta: any) => !!resposta?.recall)
  vi.stubGlobal('temMultaSP', (resposta: any) => !!resposta?.multa)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GET /api/premium/status', () => {
  it('missing token: 400', async () => {
    await expect(status({})).rejects.toMatchObject({ statusCode: 400 })
  })

  it('unknown token: 404', async () => {
    semear()
    await expect(status({ token: 'outro-token' })).rejects.toMatchObject({ statusCode: 404 })
  })

  describe('pending Pix order', () => {
    it('charge paid at the provider: answers consultando and starts the paid processing', async () => {
      semear()
      const api = apiPix({ [`${WOOVI}/api/v1/charge/cob-do-pedido`]: cobrancaWoovi('COMPLETED', 'cob-do-pedido') })

      expect(await status()).toEqual({ status: 'consultando', valorCentavos: 4490 })

      expect(api).toHaveBeenCalledTimes(1)
      expect(api).toHaveBeenCalledWith(`${WOOVI}/api/v1/charge/cob-do-pedido`, expect.objectContaining({
        method: 'GET', headers: expect.objectContaining({ Authorization: 'app-id-de-teste' }),
      }))
      expect(processar).toHaveBeenCalledTimes(1)
      expect(processar).toHaveBeenCalledWith(db, expect.objectContaining({ id: PEDIDO, abacatepay_id: 'cob-do-pedido' }))
      expect(gravarHash).toHaveBeenCalledTimes(1)
    })

    it('charge not paid: stays pending and nothing is processed', async () => {
      semear()
      const antes = { ...pedidoNoBanco() }
      const api = apiPix({ [`${WOOVI}/api/v1/charge/cob-do-pedido`]: cobrancaWoovi('ACTIVE', 'cob-do-pedido') })

      expect(await status()).toEqual({ status: 'aguardando_pagamento', valorCentavos: 4490 })

      // A Woovi order inside its window: the recorded charge is the only one asked.
      expect(api).toHaveBeenCalledTimes(1)
      expect(processar).not.toHaveBeenCalled()
      expect(gravarHash).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
    })

    it('provider does not answer: stays pending, without an error', async () => {
      semear()
      const antes = { ...pedidoNoBanco() }
      apiPix({ [`${WOOVI}/api/v1/charge/cob-do-pedido`]: new Error('network down') })

      expect(await status()).toEqual({ status: 'aguardando_pagamento', valorCentavos: 4490 })

      expect(processar).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
    })

    it('original Woovi charge paid while the order points to another provider: repoints and processes', async () => {
      semear({ pix_provider: 'abacatepay', abacatepay_id: 'cob-abacate' })
      const api = apiPix({
        [`${ABACATE}/transparents/check?id=cob-abacate`]: { data: { status: 'PENDING' }, success: true, error: null },
        [`${WOOVI}/api/v1/charge/${PEDIDO}`]: cobrancaWoovi('COMPLETED', 'cob-original'),
      })

      expect(await status()).toEqual({ status: 'consultando', valorCentavos: 4490 })

      expect(api).toHaveBeenCalledTimes(2)
      expect(pedidoNoBanco()).toMatchObject({ pix_provider: 'woovi', abacatepay_id: 'cob-original' })
      expect(processar).toHaveBeenCalledWith(db, expect.objectContaining({ id: PEDIDO, pix_provider: 'woovi', abacatepay_id: 'cob-original' }))
      expect(gravarHash).toHaveBeenCalledWith(db, expect.objectContaining({ pix_provider: 'woovi', abacatepay_id: 'cob-original' }))
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(PEDIDO))
    })

    it('original Woovi charge not paid either: stays pending and the order is not repointed', async () => {
      semear({ pix_provider: 'abacatepay', abacatepay_id: 'cob-abacate' })
      const antes = { ...pedidoNoBanco() }
      apiPix({
        [`${ABACATE}/transparents/check?id=cob-abacate`]: { data: { status: 'PENDING' }, success: true, error: null },
        [`${WOOVI}/api/v1/charge/${PEDIDO}`]: cobrancaWoovi('ACTIVE', 'cob-original'),
      })

      expect(await status()).toEqual({ status: 'aguardando_pagamento', valorCentavos: 4490 })

      expect(processar).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
    })

    it('unpaid Pix past its window: also asks the original charge, then becomes expirado', async () => {
      semear({ expira_em: '2000-01-01T00:00:00.000Z' })
      const api = apiPix({
        [`${WOOVI}/api/v1/charge/cob-do-pedido`]: cobrancaWoovi('EXPIRED', 'cob-do-pedido'),
        [`${WOOVI}/api/v1/charge/${PEDIDO}`]: cobrancaWoovi('EXPIRED', 'cob-do-pedido'),
      })

      expect(await status()).toEqual({ status: 'expirado', valorCentavos: 4490 })

      expect(api).toHaveBeenCalledTimes(2)
      expect(processar).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toMatchObject({ status: 'expirado', abacatepay_id: 'cob-do-pedido', pix_provider: 'woovi' })
    })
  })

  describe('pending card order', () => {
    const cartao = { forma_pagamento: 'cartao', abacatepay_id: null, pix_provider: null }

    it('paid Checkout Session: consultando, and no Pix provider is asked', async () => {
      semear({ ...cartao, stripe_session_id: 'cs_sessao_de_teste' })
      const pix = apiPix({})
      const stripe = apiStripe({
        [`${STRIPE}/checkout/sessions/cs_sessao_de_teste`]: { id: 'cs_sessao_de_teste', payment_status: 'paid', status: 'complete', url: null },
      })

      expect(await status()).toEqual({ status: 'consultando', valorCentavos: 4490 })

      expect(stripe).toHaveBeenCalledWith(`${STRIPE}/checkout/sessions/cs_sessao_de_teste`, { headers: { Authorization: 'Bearer chave-stripe-de-teste' } })
      expect(pix).not.toHaveBeenCalled()
      expect(processar).toHaveBeenCalledTimes(1)
    })

    it('succeeded PaymentIntent: consultando', async () => {
      semear({ ...cartao, stripe_session_id: 'pi_intent_de_teste' })
      apiPix({})
      const stripe = apiStripe({
        [`${STRIPE}/payment_intents/pi_intent_de_teste`]: { id: 'pi_intent_de_teste', status: 'succeeded' },
      })

      expect(await status()).toEqual({ status: 'consultando', valorCentavos: 4490 })

      expect(stripe).toHaveBeenCalledTimes(1)
      expect(processar).toHaveBeenCalledTimes(1)
    })

    it('unpaid card order never expires by the Pix window', async () => {
      semear({ ...cartao, stripe_session_id: 'cs_sessao_de_teste', expira_em: '2000-01-01T00:00:00.000Z' })
      const antes = { ...pedidoNoBanco() }
      const pix = apiPix({})
      apiStripe({
        [`${STRIPE}/checkout/sessions/cs_sessao_de_teste`]: { id: 'cs_sessao_de_teste', payment_status: 'unpaid', status: 'open', url: null },
      })

      expect(await status()).toEqual({ status: 'aguardando_pagamento', valorCentavos: 4490 })

      expect(pix).not.toHaveBeenCalled()
      expect(processar).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
    })
  })

  it('delivered order: no provider is asked and the loading-floor flags are exposed', async () => {
    semear({
      status: 'entregue', entregue_em: '2026-01-01T00:00:00.000Z',
      relatorio_snapshot: { consulta: { response: { recall: true, multa: false } } },
    })
    const pix = apiPix({})
    const stripe = apiStripe({})

    expect(await status()).toEqual({
      status: 'entregue', valorCentavos: 4490,
      entregue_em: '2026-01-01T00:00:00.000Z', temRecall: true, temMultaSP: false,
    })

    expect(pix).not.toHaveBeenCalled()
    expect(stripe).not.toHaveBeenCalled()
    expect(processar).not.toHaveBeenCalled()
  })
})
