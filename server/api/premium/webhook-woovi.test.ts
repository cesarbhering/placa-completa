// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { lerPayloadWoovi, ehPingWoovi } from '../../utils/woovi-webhook-payload'
import { supabaseMemoria } from '../../../tests/helpers/supabase-memoria'

// 06/out: registro do webhook recusado. Payload EXATO do teste da Woovi:
const TESTE_WOOVI = '"{\\"data_criacao\\":\\"2026-10-06T20:47:17.290Z\\",\\"evento\\":\\"teste_webhook\\",\\"event\\":\\"OPENPIX:CHARGE_COMPLETED\\"}"'

const verificar = vi.fn(() => false)
// Only the signature check is faked (it needs the provider's RSA key); the
// rest of the module, including the charge lookups, stays real.
vi.mock('../../utils/woovi', async (original) => ({
  ...(await original<typeof import('../../utils/woovi')>()),
  chavesPublicas: async () => ['k'],
  verificarAssinatura: (...a: any[]) => verificar(...a),
}))
const gravarHash = vi.fn()
vi.mock('../../utils/pagador-hash', () => ({ gravarPagadorHash: (...a: any[]) => gravarHash(...a), sanearPayloadWebhook: (p: any) => p }))
const financeiro = vi.fn(async () => {})
vi.mock('../../utils/woovi-financeiro', () => ({ encaminharWebhookFinanceiro: (...a: any[]) => financeiro(...a) }))

let raw = ''; let headers: Record<string, string> = {}
const processar = vi.fn(); const supa = vi.fn()
beforeEach(() => {
  verificar.mockReset(); verificar.mockReturnValue(false); processar.mockReset(); supa.mockReset()
  gravarHash.mockReset(); financeiro.mockClear()
  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('readRawBody', async () => raw)
  vi.stubGlobal('getRequestHeader', (_e: any, h: string) => headers[h])
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
  vi.stubGlobal('usePremiumSupabase', () => { supa(); throw new Error('nao devia tocar no banco') })
  vi.stubGlobal('processarPedidoPago', processar)
})
afterEach(() => vi.unstubAllGlobals())

async function chamar(corpo: string, assinatura?: string) {
  raw = corpo; headers = assinatura ? { 'x-webhook-signature': assinatura } : {}
  const { default: h } = await import('./webhook-woovi')
  return h({ method: 'POST' } as any)
}

describe('payload da Woovi', () => {
  it('parse duplo do JSON string', () => {
    expect(lerPayloadWoovi(TESTE_WOOVI)).toEqual({ data_criacao: '2026-10-06T20:47:17.290Z', evento: 'teste_webhook', event: 'OPENPIX:CHARGE_COMPLETED' })
    expect(lerPayloadWoovi('{"event":"x"}')).toEqual({ event: 'x' })
    expect(lerPayloadWoovi('lixo')).toEqual({})
    expect(lerPayloadWoovi('')).toEqual({})
  })
  it('ping se evento OU event disser teste', () => {
    expect(ehPingWoovi({ evento: 'teste_webhook', event: 'OPENPIX:CHARGE_COMPLETED' })).toBe(true)
    expect(ehPingWoovi({ event: 'OPENPIX:CHARGE_COMPLETED' })).toBe(false)
  })
})

describe('handler', () => {
  it('teste da Woovi SEM assinatura: 200, nada processado', async () => {
    expect(await chamar(TESTE_WOOVI)).toEqual({ ok: true, ping: true })
    expect(processar).not.toHaveBeenCalled(); expect(supa).not.toHaveBeenCalled()
  })
  it('teste da Woovi COM assinatura (mesmo invalida): 200, nada processado', async () => {
    expect(await chamar(TESTE_WOOVI, 'assinatura-qualquer')).toEqual({ ok: true, ping: true })
    expect(verificar).not.toHaveBeenCalled(); expect(processar).not.toHaveBeenCalled(); expect(supa).not.toHaveBeenCalled()
  })
  it('evento real com assinatura invalida: 401', async () => {
    const real = JSON.stringify({ event: 'OPENPIX:CHARGE_COMPLETED', charge: { correlationID: 'p1', status: 'COMPLETED' } })
    await expect(chamar(real, 'falsa')).rejects.toMatchObject({ statusCode: 401 })
    expect(processar).not.toHaveBeenCalled(); expect(supa).not.toHaveBeenCalled()
  })
  it('evento real duplamente codificado com assinatura invalida: 401', async () => {
    const real = JSON.stringify(JSON.stringify({ event: 'OPENPIX:CHARGE_COMPLETED', charge: { correlationID: 'p1' } }))
    await expect(chamar(real, 'falsa')).rejects.toMatchObject({ statusCode: 401 })
  })
})

// A valid signature proves the provider sent the message. Whether the order
// was paid is answered by the provider API, asked with our own credential.
// The provider modules are real here; only their HTTP boundary ($fetch) and
// the database are faked.
describe('payment confirmation with our own credential', () => {
  const PEDIDO = '11111111-1111-4111-8111-111111111111'
  const OUTRO_PEDIDO = '22222222-2222-4222-8222-222222222222'
  const RENOVACAO_ANTIGA = `${PEDIDO}-rantiga`
  const WOOVI = 'https://woovi.test'
  const ABACATE = 'https://abacate.test'
  const ASSINATURA = 'assinatura-valida'
  let db: ReturnType<typeof supabaseMemoria>

  function semear(extra: Record<string, any> = {}) {
    db.tab('pedidos_premium').push({
      id: PEDIDO, status: 'aguardando_pagamento', placa: 'TESTE01', email: null, token_entrega: 'token-de-teste',
      abacatepay_id: 'cob-do-pedido', pix_provider: 'woovi', forma_pagamento: 'pix', stripe_session_id: null,
      expira_em: '2999-01-01T00:00:00.000Z', plano: 'completa', ambiente: 'producao', valor_centavos: 4490,
      ...extra,
    })
  }
  const pedidoNoBanco = () => db.tab('pedidos_premium')[0]
  const eventoGravado = () => db.tab('webhook_events')[0]

  /** Signed OPENPIX:CHARGE_COMPLETED as the provider sends it, payer included. */
  function eventoPago(charge: Record<string, any> = {}) {
    const payer = { name: 'PAGADOR DE TESTE', taxID: { taxID: '00000000000', type: 'BR:CPF' } }
    return JSON.stringify({
      event: 'OPENPIX:CHARGE_COMPLETED',
      charge: {
        status: 'COMPLETED', correlationID: PEDIDO, identifier: 'cob-do-pedido', value: 4490,
        transactionID: 'transacao-de-teste', paidAt: '2026-01-01T00:00:00.000Z', payer,
        ...charge,
      },
      pix: { value: 4490, time: '2026-01-01T00:00:00.000Z', endToEndId: 'E-teste', payer },
    })
  }
  /** A signed event that is not a payment. */
  const eventoExpirou = (correlationID: string) => JSON.stringify({
    event: 'OPENPIX:CHARGE_EXPIRED', charge: { status: 'EXPIRED', correlationID, identifier: 'cob-do-pedido', value: 4490 },
  })

  /** Woovi answer for GET /api/v1/charge/{id}, where id is an identifier or a correlationID. */
  const cobrancaWoovi = (status: string, identifier: string, correlationID: string = PEDIDO) => ({
    charge: { status, identifier, correlationID, value: 4490, brCode: '00020101021226-teste', expiresDate: '2999-01-01T00:00:00.000Z' },
  })
  const naWoovi = (id: string) => `${WOOVI}/api/v1/charge/${id}`
  const COBRANCA_DO_PEDIDO = naWoovi('cob-do-pedido')
  /** The original charge: its correlationID is the order id. */
  const COBRANCA_ORIGINAL = naWoovi(PEDIDO)
  const COBRANCA_ABACATE = `${ABACATE}/transparents/check?id=cob-abacate`
  /** An HTTP error as ofetch throws it. Woovi answers 400 for a charge it does not know. */
  const erroHttp = (status: number) => Object.assign(new Error(`[GET] ${status}`), { status, statusCode: status })
  const NAO_EXISTE = erroHttp(400)
  const SEM_REDE = new Error('network down')

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
  const consultadas = (api: ReturnType<typeof apiPix>) => api.mock.calls.map((c) => c[0])

  beforeEach(() => {
    verificar.mockReturnValue(true)
    db = supabaseMemoria()
    vi.stubGlobal('usePremiumSupabase', () => db)
    vi.stubGlobal('useRuntimeConfig', () => ({
      wooviAppId: 'app-id-de-teste', wooviBase: WOOVI,
      abacatepayApiKey: 'chave-abacate-de-teste', abacatepayBase: ABACATE,
      public: {},
    }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  describe('the charge recorded on the order', () => {
    it('paid at the provider: processes the order and flags the event as processed', async () => {
      semear()
      const api = apiPix({ [COBRANCA_DO_PEDIDO]: cobrancaWoovi('COMPLETED', 'cob-do-pedido') })

      expect(await chamar(eventoPago(), ASSINATURA)).toEqual({ ok: true })

      expect(consultadas(api)).toEqual([COBRANCA_DO_PEDIDO])
      expect(api.mock.calls[0]![1]).toMatchObject({ method: 'GET', headers: { Authorization: 'app-id-de-teste' } })
      expect(processar).toHaveBeenCalledTimes(1)
      expect(processar).toHaveBeenCalledWith(db, expect.objectContaining({ id: PEDIDO, pix_provider: 'woovi', abacatepay_id: 'cob-do-pedido' }))
      expect(gravarHash).toHaveBeenCalledTimes(1)
      expect(eventoGravado()).toMatchObject({ provider: 'woovi', event: 'OPENPIX:CHARGE_COMPLETED', abacatepay_id: 'cob-do-pedido', processado: true })
    })

    it('not paid at the provider: 200, nothing processed, order untouched', async () => {
      semear()
      const antes = { ...pedidoNoBanco() }
      const api = apiPix({ [COBRANCA_DO_PEDIDO]: cobrancaWoovi('ACTIVE', 'cob-do-pedido'), [COBRANCA_ORIGINAL]: cobrancaWoovi('ACTIVE', 'cob-do-pedido') })

      expect(await chamar(eventoPago(), ASSINATURA)).toEqual({ ok: true, naoConfirmado: true })

      for (const chamada of api.mock.calls) expect(chamada[1]).toMatchObject({ method: 'GET', headers: { Authorization: 'app-id-de-teste' } })
      expect(processar).not.toHaveBeenCalled()
      expect(gravarHash).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
      expect(eventoGravado()).not.toHaveProperty('processado', true)
    })

    it('not paid: logs one line with the order id and no payer data', async () => {
      semear()
      apiPix({ [COBRANCA_DO_PEDIDO]: cobrancaWoovi('ACTIVE', 'cob-do-pedido'), [COBRANCA_ORIGINAL]: cobrancaWoovi('ACTIVE', 'cob-do-pedido') })

      await chamar(eventoPago(), ASSINATURA)

      expect(console.warn).toHaveBeenCalledTimes(1)
      const linha = vi.mocked(console.warn).mock.calls[0]!.join(' ')
      expect(linha).toContain(PEDIDO)
      expect(linha).not.toContain('PAGADOR DE TESTE')
      expect(linha).not.toContain('00000000000')
      expect(linha).not.toContain('\n')
    })
  })

  describe('the event body is not proof', () => {
    it('identifier and value from the event are never looked up nor trusted', async () => {
      semear()
      const antes = { ...pedidoNoBanco() }
      const api = apiPix({ [COBRANCA_DO_PEDIDO]: cobrancaWoovi('ACTIVE', 'cob-do-pedido'), [COBRANCA_ORIGINAL]: cobrancaWoovi('ACTIVE', 'cob-do-pedido') })

      expect(await chamar(eventoPago({ identifier: 'cob-de-outra-conta', value: 1 }), ASSINATURA)).toEqual({ ok: true, naoConfirmado: true })

      // Asked: the charge recorded on the order, then the charge of the
      // correlationID, which maps to the order. Never the identifier.
      expect(consultadas(api)).toEqual([COBRANCA_DO_PEDIDO, COBRANCA_ORIGINAL])
      expect(processar).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
    })

    it('identifier and value from the event do not block a payment the provider confirms', async () => {
      semear()
      const api = apiPix({ [COBRANCA_DO_PEDIDO]: cobrancaWoovi('COMPLETED', 'cob-do-pedido') })

      expect(await chamar(eventoPago({ identifier: 'cob-de-outra-conta', value: 1 }), ASSINATURA)).toEqual({ ok: true })

      expect(consultadas(api)).toEqual([COBRANCA_DO_PEDIDO])
      expect(processar).toHaveBeenCalledWith(db, expect.objectContaining({ id: PEDIDO, abacatepay_id: 'cob-do-pedido' }))
    })
  })

  describe('a paid charge of the order that is not the recorded one', () => {
    it('the original, while the order points to another provider: repoints like the polling and processes', async () => {
      semear({ pix_provider: 'abacatepay', abacatepay_id: 'cob-abacate' })
      apiPix({
        [COBRANCA_ABACATE]: { data: { status: 'PENDING' }, success: true, error: null },
        [COBRANCA_ORIGINAL]: cobrancaWoovi('COMPLETED', 'cob-original'),
      })

      expect(await chamar(eventoPago({ identifier: 'cob-original' }), ASSINATURA)).toEqual({ ok: true })

      expect(pedidoNoBanco()).toMatchObject({ pix_provider: 'woovi', abacatepay_id: 'cob-original' })
      expect(processar).toHaveBeenCalledWith(db, expect.objectContaining({ id: PEDIDO, pix_provider: 'woovi', abacatepay_id: 'cob-original' }))
      expect(gravarHash).toHaveBeenCalledWith(db, expect.objectContaining({ pix_provider: 'woovi', abacatepay_id: 'cob-original' }))
      expect(eventoGravado()).toMatchObject({ abacatepay_id: 'cob-original', processado: true })
    })

    it('the original, while the order points to a renewal still inside its window: repointed and delivered', async () => {
      semear({ abacatepay_id: 'cob-renovada' })
      const api = apiPix({
        [naWoovi('cob-renovada')]: cobrancaWoovi('ACTIVE', 'cob-renovada', `${PEDIDO}-rnova`),
        [COBRANCA_ORIGINAL]: cobrancaWoovi('COMPLETED', 'cob-original'),
      })

      expect(await chamar(eventoPago({ identifier: 'cob-original' }), ASSINATURA)).toEqual({ ok: true })

      expect(consultadas(api)).toEqual([naWoovi('cob-renovada'), COBRANCA_ORIGINAL])
      expect(pedidoNoBanco()).toMatchObject({ pix_provider: 'woovi', abacatepay_id: 'cob-original' })
      expect(processar).toHaveBeenCalledWith(db, expect.objectContaining({ id: PEDIDO, abacatepay_id: 'cob-original' }))
    })

    it('an older renewal: the order is repointed to it and delivered', async () => {
      semear()
      const api = apiPix({
        [COBRANCA_DO_PEDIDO]: cobrancaWoovi('ACTIVE', 'cob-do-pedido', `${PEDIDO}-rnova`),
        [naWoovi(RENOVACAO_ANTIGA)]: cobrancaWoovi('COMPLETED', 'cob-antiga', RENOVACAO_ANTIGA),
      })

      expect(await chamar(eventoPago({ correlationID: RENOVACAO_ANTIGA, identifier: 'cob-antiga' }), ASSINATURA)).toEqual({ ok: true })

      expect(consultadas(api)).toEqual([COBRANCA_DO_PEDIDO, naWoovi(RENOVACAO_ANTIGA)])
      expect(api.mock.calls[1]![1]).toMatchObject({ method: 'GET', headers: { Authorization: 'app-id-de-teste' } })
      expect(pedidoNoBanco()).toMatchObject({ pix_provider: 'woovi', abacatepay_id: 'cob-antiga' })
      expect(processar).toHaveBeenCalledTimes(1)
      expect(processar).toHaveBeenCalledWith(db, expect.objectContaining({ id: PEDIDO, pix_provider: 'woovi', abacatepay_id: 'cob-antiga' }))
      expect(gravarHash).toHaveBeenCalledWith(db, expect.objectContaining({ abacatepay_id: 'cob-antiga' }))
      expect(eventoGravado()).toMatchObject({ abacatepay_id: 'cob-antiga', processado: true })
    })

    it('a correlationID of another order does not deliver this one', async () => {
      semear()
      const antes = { ...pedidoNoBanco() }
      const deOutroPedido = `${OUTRO_PEDIDO}-rantiga`
      // The event reaches this order through the charge identifier. The
      // correlationID it carries belongs to another order and is paid.
      const api = apiPix({
        [COBRANCA_DO_PEDIDO]: cobrancaWoovi('ACTIVE', 'cob-do-pedido'),
        [naWoovi(deOutroPedido)]: cobrancaWoovi('COMPLETED', 'cob-de-outro-pedido', deOutroPedido),
      })

      expect(await chamar(eventoPago({ correlationID: deOutroPedido, identifier: 'cob-do-pedido' }), ASSINATURA)).toEqual({ ok: true, naoConfirmado: true })

      expect(consultadas(api)).toEqual([COBRANCA_DO_PEDIDO])
      expect(processar).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
    })

    it('the provider ties the charge to another order: this one is not delivered', async () => {
      semear()
      const antes = { ...pedidoNoBanco() }
      apiPix({
        [COBRANCA_DO_PEDIDO]: cobrancaWoovi('ACTIVE', 'cob-do-pedido'),
        [naWoovi(RENOVACAO_ANTIGA)]: cobrancaWoovi('COMPLETED', 'cob-de-outro-pedido', `${OUTRO_PEDIDO}-rantiga`),
      })

      expect(await chamar(eventoPago({ correlationID: RENOVACAO_ANTIGA, identifier: 'cob-antiga' }), ASSINATURA)).toEqual({ ok: true, naoConfirmado: true })

      expect(processar).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
    })
  })

  describe('a charge that does not exist in our account is not an error', () => {
    it('the charge the event names does not exist: 200, nothing processed, no resend asked', async () => {
      semear()
      const antes = { ...pedidoNoBanco() }
      const inexistente = `${PEDIDO}-rinexistente`
      apiPix({ [COBRANCA_DO_PEDIDO]: cobrancaWoovi('ACTIVE', 'cob-do-pedido'), [naWoovi(inexistente)]: NAO_EXISTE })

      expect(await chamar(eventoPago({ correlationID: inexistente, identifier: 'cob-inexistente' }), ASSINATURA)).toEqual({ ok: true, naoConfirmado: true })

      expect(processar).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
    })

    it('order born on the fallback provider, with no Woovi charge at all: 200', async () => {
      semear({ pix_provider: 'abacatepay', abacatepay_id: 'cob-abacate' })
      apiPix({ [COBRANCA_ABACATE]: { data: { status: 'PENDING' }, success: true, error: null }, [COBRANCA_ORIGINAL]: NAO_EXISTE })

      expect(await chamar(eventoPago({ identifier: 'cob-de-outra-conta' }), ASSINATURA)).toEqual({ ok: true, naoConfirmado: true })

      expect(processar).not.toHaveBeenCalled()
    })

    it('the charge the event names does not exist, even with the order own charge unreachable: 200', async () => {
      semear()
      const inexistente = `${PEDIDO}-rinexistente`
      apiPix({ [COBRANCA_DO_PEDIDO]: SEM_REDE, [naWoovi(inexistente)]: NAO_EXISTE })

      expect(await chamar(eventoPago({ correlationID: inexistente, identifier: 'cob-inexistente' }), ASSINATURA)).toEqual({ ok: true, naoConfirmado: true })

      expect(processar).not.toHaveBeenCalled()
    })
  })

  describe('the provider cannot be asked: 503, so that it resends', () => {
    it('network error: 503, nothing processed, event not flagged', async () => {
      semear()
      const antes = { ...pedidoNoBanco() }
      apiPix({ [COBRANCA_DO_PEDIDO]: SEM_REDE, [COBRANCA_ORIGINAL]: SEM_REDE })

      await expect(chamar(eventoPago(), ASSINATURA)).rejects.toMatchObject({ statusCode: 503 })

      expect(processar).not.toHaveBeenCalled()
      expect(gravarHash).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
      expect(eventoGravado()).not.toHaveProperty('processado', true)
    })

    it('an error of the provider itself (500): 503', async () => {
      semear()
      apiPix({ [COBRANCA_DO_PEDIDO]: erroHttp(500), [COBRANCA_ORIGINAL]: erroHttp(500) })

      await expect(chamar(eventoPago(), ASSINATURA)).rejects.toMatchObject({ statusCode: 503 })

      expect(processar).not.toHaveBeenCalled()
    })

    it('the lookup of the charge the event names fails: 503', async () => {
      semear()
      apiPix({ [COBRANCA_DO_PEDIDO]: cobrancaWoovi('ACTIVE', 'cob-do-pedido'), [naWoovi(RENOVACAO_ANTIGA)]: SEM_REDE })

      await expect(chamar(eventoPago({ correlationID: RENOVACAO_ANTIGA, identifier: 'cob-antiga' }), ASSINATURA)).rejects.toMatchObject({ statusCode: 503 })

      expect(processar).not.toHaveBeenCalled()
    })

    it('the provider API hangs: 503 instead of holding the webhook open', async () => {
      semear()
      vi.stubGlobal('$fetch', vi.fn(() => new Promise(() => {})))
      await import('./webhook-woovi')
      vi.useFakeTimers()
      try {
        const resposta = expect(chamar(eventoPago(), ASSINATURA)).rejects.toMatchObject({ statusCode: 503 })
        await vi.advanceTimersByTimeAsync(60_000)
        await resposta
      } finally {
        vi.useRealTimers()
      }
      expect(processar).not.toHaveBeenCalled()
      expect(eventoGravado()).not.toHaveProperty('processado', true)
    })

    it('unexpected failure while confirming: 503, nothing processed', async () => {
      semear({ pix_provider: 'abacatepay', abacatepay_id: 'cob-abacate' })
      apiPix({
        [COBRANCA_ABACATE]: { data: { status: 'PENDING' }, success: true, error: null },
        [COBRANCA_ORIGINAL]: cobrancaWoovi('COMPLETED', 'cob-original'),
      })
      // The database fails on the repoint write.
      vi.stubGlobal('usePremiumSupabase', () => ({
        ...db,
        from: (tabela: string) => {
          const consulta = db.from(tabela)
          if (tabela === 'pedidos_premium') consulta.update = () => { throw new Error('database down') }
          return consulta
        },
      }))

      await expect(chamar(eventoPago({ identifier: 'cob-original' }), ASSINATURA)).rejects.toMatchObject({ statusCode: 503 })

      expect(processar).not.toHaveBeenCalled()
      expect(gravarHash).not.toHaveBeenCalled()
    })
  })

  // Every signed event is stored for audit. Finance only hears about events
  // that are about an order of ours.
  describe('audit trail and the copy to finance', () => {
    it('confirmed payment: stored, flagged and forwarded to finance once', async () => {
      semear()
      apiPix({ [COBRANCA_DO_PEDIDO]: cobrancaWoovi('COMPLETED', 'cob-do-pedido') })
      const corpo = eventoPago()

      await chamar(corpo, ASSINATURA)

      expect(db.tab('webhook_events')).toHaveLength(1)
      expect(eventoGravado()).toMatchObject({ processado: true })
      expect(financeiro).toHaveBeenCalledTimes(1)
      expect(financeiro).toHaveBeenCalledWith(db, JSON.parse(corpo), corpo, PEDIDO, 'cob-do-pedido')
    })

    it('payment event the provider does not confirm: stored, not flagged, no e-mail to finance', async () => {
      semear()
      apiPix({ [COBRANCA_DO_PEDIDO]: cobrancaWoovi('ACTIVE', 'cob-do-pedido'), [COBRANCA_ORIGINAL]: cobrancaWoovi('ACTIVE', 'cob-do-pedido') })

      await chamar(eventoPago(), ASSINATURA)

      expect(db.tab('webhook_events')).toHaveLength(1)
      expect(eventoGravado()).toMatchObject({ provider: 'woovi', event: 'OPENPIX:CHARGE_COMPLETED', abacatepay_id: 'cob-do-pedido' })
      expect(eventoGravado()).not.toHaveProperty('processado', true)
      expect(financeiro).not.toHaveBeenCalled()
    })

    it('payment event when the provider cannot be asked: stored, no e-mail to finance', async () => {
      semear()
      apiPix({ [COBRANCA_DO_PEDIDO]: SEM_REDE, [COBRANCA_ORIGINAL]: SEM_REDE })

      await expect(chamar(eventoPago(), ASSINATURA)).rejects.toMatchObject({ statusCode: 503 })

      expect(db.tab('webhook_events')).toHaveLength(1)
      expect(financeiro).not.toHaveBeenCalled()
    })

    it('payment event whose correlationID matches no order: stored, no e-mail, no provider asked', async () => {
      const api = apiPix({})

      expect(await chamar(eventoPago({ correlationID: OUTRO_PEDIDO, identifier: 'cob-de-outra-conta' }), ASSINATURA)).toEqual({ ok: true, semPedido: true })

      expect(db.tab('webhook_events')).toHaveLength(1)
      expect(eventoGravado()).not.toHaveProperty('processado', true)
      expect(financeiro).not.toHaveBeenCalled()
      expect(api).not.toHaveBeenCalled()
      expect(processar).not.toHaveBeenCalled()
    })

    it('event that is not a payment, about an order of ours: stored and forwarded, no provider asked', async () => {
      semear()
      const api = apiPix({})
      const corpo = eventoExpirou(PEDIDO)

      expect(await chamar(corpo, ASSINATURA)).toEqual({ ok: true, ignored: 'OPENPIX:CHARGE_EXPIRED' })

      expect(db.tab('webhook_events')).toHaveLength(1)
      expect(financeiro).toHaveBeenCalledTimes(1)
      expect(financeiro).toHaveBeenCalledWith(db, JSON.parse(corpo), corpo, PEDIDO, 'cob-do-pedido')
      expect(api).not.toHaveBeenCalled()
      expect(processar).not.toHaveBeenCalled()
    })

    it('event that is not a payment, about no order of ours: stored, not forwarded', async () => {
      const api = apiPix({})

      expect(await chamar(eventoExpirou(OUTRO_PEDIDO).replace('cob-do-pedido', 'cob-de-outra-conta'), ASSINATURA)).toEqual({ ok: true, ignored: 'OPENPIX:CHARGE_EXPIRED' })

      expect(db.tab('webhook_events')).toHaveLength(1)
      expect(financeiro).not.toHaveBeenCalled()
      expect(api).not.toHaveBeenCalled()
    })
  })
})
