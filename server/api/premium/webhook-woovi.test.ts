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
const alertar = vi.fn(async () => true)
vi.mock('../../utils/alerta-evento-woovi', () => ({ avisarEventoEstranhoWoovi: (...a: any[]) => alertar(...a) }))

let raw = ''; let headers: Record<string, string> = {}
const processar = vi.fn(); const supa = vi.fn()
beforeEach(() => {
  verificar.mockReset(); verificar.mockReturnValue(false); processar.mockReset(); supa.mockReset()
  gravarHash.mockReset(); financeiro.mockClear(); alertar.mockClear()
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

// A valid signature proves the provider sent the message. What the event says
// is checked with the provider API, asked with our own credential. The provider
// modules are real here; only their HTTP boundary ($fetch) and the database are
// faked.
describe('events checked with our own credential', () => {
  const PEDIDO = '11111111-1111-4111-8111-111111111111'
  const OUTRO_PEDIDO = '22222222-2222-4222-8222-222222222222'
  const RENOVACAO_ANTIGA = `${PEDIDO}-rantiga`
  const WOOVI = 'https://woovi.test'
  const ABACATE = 'https://abacate.test'
  const ASSINATURA = 'assinatura-valida'
  let db: ReturnType<typeof supabaseMemoria>
  let config: Record<string, unknown>

  function semear(extra: Record<string, any> = {}) {
    db.tab('pedidos_premium').push({
      id: PEDIDO, status: 'aguardando_pagamento', placa: 'TESTE01', email: null, token_entrega: 'token-de-teste',
      abacatepay_id: 'cob-do-pedido', pix_provider: 'woovi', forma_pagamento: 'pix', stripe_session_id: null,
      expira_em: '2999-01-01T00:00:00.000Z', plano: 'completa', ambiente: 'producao', valor_centavos: 4490,
      ...extra,
    })
  }
  const pedidoNoBanco = () => db.tab('pedidos_premium')[0]
  const eventos = () => db.tab('webhook_events')
  const eventoGravado = () => eventos()[eventos().length - 1]

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
  /** A signed event about a charge that is not a payment. */
  const eventoExpirou = (charge: Record<string, any> = {}) => JSON.stringify({
    event: 'OPENPIX:CHARGE_EXPIRED', charge: { status: 'EXPIRED', correlationID: PEDIDO, identifier: 'cob-do-pedido', value: 4490, ...charge },
  })

  /** Woovi answer for GET /api/v1/charge/{id}, where id is an identifier or a correlationID. */
  const cobrancaWoovi = (status: string, identifier: string, correlationID: string = PEDIDO) => ({
    charge: { status, identifier, correlationID, value: 4490, brCode: '00020101021226-teste', expiresDate: '2999-01-01T00:00:00.000Z' },
  })
  const naWoovi = (id: string) => `${WOOVI}/api/v1/charge/${id}`
  /** By identifier: the charge recorded on the order. */
  const GRAVADA = naWoovi('cob-do-pedido')
  /** By correlationID: the original charge, whose correlationID is the order id. */
  const ORIGINAL = naWoovi(PEDIDO)
  const NA_ABACATE = `${ABACATE}/transparents/check?id=cob-abacate`
  const pendenteNaAbacate = { data: { status: 'PENDING' }, success: true, error: null }
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
    config = { wooviAppId: 'app-id-de-teste', wooviBase: WOOVI, abacatepayApiKey: 'chave-abacate-de-teste', abacatepayBase: ABACATE, public: {} }
    vi.stubGlobal('usePremiumSupabase', () => db)
    vi.stubGlobal('useRuntimeConfig', () => config)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  describe('payment event whose charge is ours, of the order, and paid', () => {
    it('processes the order, copies finance and flags the event, asking only for the charge the event names', async () => {
      semear()
      const api = apiPix({ [ORIGINAL]: cobrancaWoovi('COMPLETED', 'cob-do-pedido') })
      const corpo = eventoPago()

      expect(await chamar(corpo, ASSINATURA)).toEqual({ ok: true })

      expect(consultadas(api)).toEqual([ORIGINAL])
      expect(api.mock.calls[0]![1]).toMatchObject({ method: 'GET', headers: { Authorization: 'app-id-de-teste' } })
      expect(processar).toHaveBeenCalledTimes(1)
      expect(processar).toHaveBeenCalledWith(db, expect.objectContaining({ id: PEDIDO, pix_provider: 'woovi', abacatepay_id: 'cob-do-pedido' }))
      expect(gravarHash).toHaveBeenCalledTimes(1)
      expect(financeiro).toHaveBeenCalledTimes(1)
      expect(financeiro).toHaveBeenCalledWith(db, JSON.parse(corpo), corpo, PEDIDO, 'cob-do-pedido')
      expect(eventoGravado()).toMatchObject({ provider: 'woovi', event: 'OPENPIX:CHARGE_COMPLETED', abacatepay_id: 'cob-do-pedido', processado: true })
      expect(alertar).not.toHaveBeenCalled()
    })

    it('an older renewal: the order is repointed to it and delivered', async () => {
      semear()
      const api = apiPix({ [naWoovi(RENOVACAO_ANTIGA)]: cobrancaWoovi('COMPLETED', 'cob-antiga', RENOVACAO_ANTIGA) })

      expect(await chamar(eventoPago({ correlationID: RENOVACAO_ANTIGA, identifier: 'cob-antiga' }), ASSINATURA)).toEqual({ ok: true })

      expect(consultadas(api)).toEqual([naWoovi(RENOVACAO_ANTIGA)])
      expect(pedidoNoBanco()).toMatchObject({ pix_provider: 'woovi', abacatepay_id: 'cob-antiga' })
      expect(processar).toHaveBeenCalledWith(db, expect.objectContaining({ id: PEDIDO, pix_provider: 'woovi', abacatepay_id: 'cob-antiga' }))
      expect(gravarHash).toHaveBeenCalledWith(db, expect.objectContaining({ abacatepay_id: 'cob-antiga' }))
      expect(eventoGravado()).toMatchObject({ abacatepay_id: 'cob-antiga', processado: true })
    })

    it('the original, while the order points to a renewal still inside its window: repointed and delivered', async () => {
      semear({ abacatepay_id: 'cob-renovada' })
      apiPix({ [ORIGINAL]: cobrancaWoovi('COMPLETED', 'cob-original') })

      expect(await chamar(eventoPago({ identifier: 'cob-original' }), ASSINATURA)).toEqual({ ok: true })

      expect(pedidoNoBanco()).toMatchObject({ pix_provider: 'woovi', abacatepay_id: 'cob-original' })
      expect(processar).toHaveBeenCalledWith(db, expect.objectContaining({ id: PEDIDO, abacatepay_id: 'cob-original' }))
    })

    it.each([
      ['recorded on a provider that has no key in this environment', { pix_provider: 'abacatepay', abacatepay_id: 'cob-abacate' }],
      ['an old order with no provider recorded', { pix_provider: null, abacatepay_id: 'cob-antiga-sem-provedor' }],
    ])('the order charge is %s: the paid charge of the event still delivers', async (_caso, doPedido) => {
      config.abacatepayApiKey = ''
      semear(doPedido)
      const api = apiPix({ [ORIGINAL]: cobrancaWoovi('COMPLETED', 'cob-original') })

      expect(await chamar(eventoPago({ identifier: 'cob-original' }), ASSINATURA)).toEqual({ ok: true })

      expect(consultadas(api)).toEqual([ORIGINAL])
      expect(pedidoNoBanco()).toMatchObject({ pix_provider: 'woovi', abacatepay_id: 'cob-original' })
      expect(processar).toHaveBeenCalledTimes(1)
    })

    it('only the rows of the verified charge are flagged as processed', async () => {
      semear()
      eventos().push({ id: 'linha-de-outra-cobranca', provider: 'woovi', event: 'OPENPIX:CHARGE_COMPLETED', abacatepay_id: 'cob-de-outra-conta' })
      eventos().push({ id: 'entrega-anterior-da-mesma', provider: 'woovi', event: 'OPENPIX:CHARGE_COMPLETED', abacatepay_id: 'cob-do-pedido' })
      apiPix({ [ORIGINAL]: cobrancaWoovi('COMPLETED', 'cob-do-pedido') })

      await chamar(eventoPago(), ASSINATURA)

      expect(eventos().map((e: any) => [e.abacatepay_id, e.processado === true])).toEqual([
        ['cob-de-outra-conta', false],
        ['cob-do-pedido', true],
        ['cob-do-pedido', true],
      ])
    })
  })

  describe('payment event whose charge is ours but does not show as paid yet: 503, so the provider resends', () => {
    it('nothing is processed, copied or flagged, and the order is untouched', async () => {
      semear()
      const antes = { ...pedidoNoBanco() }
      const api = apiPix({ [ORIGINAL]: cobrancaWoovi('ACTIVE', 'cob-do-pedido'), [GRAVADA]: cobrancaWoovi('ACTIVE', 'cob-do-pedido') })

      await expect(chamar(eventoPago(), ASSINATURA)).rejects.toMatchObject({ statusCode: 503 })

      for (const chamada of api.mock.calls) expect(chamada[1]).toMatchObject({ method: 'GET', headers: { Authorization: 'app-id-de-teste' } })
      expect(processar).not.toHaveBeenCalled()
      expect(gravarHash).not.toHaveBeenCalled()
      expect(financeiro).not.toHaveBeenCalled()
      expect(alertar).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
      expect(eventoGravado()).not.toHaveProperty('processado', true)
    })

    it('logs one line with the order id and no payer data', async () => {
      semear()
      apiPix({ [ORIGINAL]: cobrancaWoovi('ACTIVE', 'cob-do-pedido'), [GRAVADA]: cobrancaWoovi('ACTIVE', 'cob-do-pedido') })

      await expect(chamar(eventoPago(), ASSINATURA)).rejects.toMatchObject({ statusCode: 503 })

      expect(console.warn).toHaveBeenCalledTimes(1)
      const linha = vi.mocked(console.warn).mock.calls[0]!.join(' ')
      expect(linha).toContain(PEDIDO)
      expect(linha).not.toContain('PAGADOR DE TESTE')
      expect(linha).not.toContain('00000000000')
      expect(linha).not.toContain('\n')
    })
  })

  describe('payment event about a charge that is not ours: 200, nothing processed, the team is told', () => {
    it('the charge does not exist in our account', async () => {
      semear()
      const antes = { ...pedidoNoBanco() }
      const inexistente = `${PEDIDO}-rinexistente`
      apiPix({ [naWoovi(inexistente)]: NAO_EXISTE, [GRAVADA]: cobrancaWoovi('ACTIVE', 'cob-do-pedido') })

      expect(await chamar(eventoPago({ correlationID: inexistente, identifier: 'cob-inexistente' }), ASSINATURA)).toEqual({ ok: true, naoConfirmado: true })

      expect(processar).not.toHaveBeenCalled()
      expect(financeiro).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
      expect(eventoGravado()).not.toHaveProperty('processado', true)
      expect(alertar).toHaveBeenCalledTimes(1)
      expect(alertar).toHaveBeenCalledWith({ evento: 'OPENPIX:CHARGE_COMPLETED', correlationID: inexistente, pedidoId: PEDIDO, motivo: 'nao_existe' })
    })

    it('our account has a charge with that correlationID, but the event carries another one: identifier and value are never trusted', async () => {
      semear()
      const antes = { ...pedidoNoBanco() }
      const api = apiPix({ [ORIGINAL]: cobrancaWoovi('ACTIVE', 'cob-do-pedido'), [GRAVADA]: cobrancaWoovi('ACTIVE', 'cob-do-pedido') })

      expect(await chamar(eventoPago({ identifier: 'cob-de-outra-conta', value: 1 }), ASSINATURA)).toEqual({ ok: true, naoConfirmado: true })

      // Asked: the charge of the correlationID, then the charge recorded on
      // the order. Never the identifier the event carries.
      expect(consultadas(api)).toEqual([ORIGINAL, GRAVADA])
      expect(processar).not.toHaveBeenCalled()
      expect(financeiro).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
      expect(alertar).toHaveBeenCalledWith(expect.objectContaining({ correlationID: PEDIDO, pedidoId: PEDIDO, motivo: 'outra_cobranca' }))
    })

    it('a correlationID of another order does not deliver this one', async () => {
      semear()
      const antes = { ...pedidoNoBanco() }
      const deOutroPedido = `${OUTRO_PEDIDO}-rantiga`
      // The event reaches this order through the charge identifier. The
      // correlationID it carries belongs to another order, and is paid.
      const api = apiPix({
        [GRAVADA]: cobrancaWoovi('ACTIVE', 'cob-do-pedido'),
        [naWoovi(deOutroPedido)]: cobrancaWoovi('COMPLETED', 'cob-de-outro-pedido', deOutroPedido),
      })

      expect(await chamar(eventoPago({ correlationID: deOutroPedido, identifier: 'cob-do-pedido' }), ASSINATURA)).toEqual({ ok: true, naoConfirmado: true })

      expect(consultadas(api)).toEqual([GRAVADA])
      expect(processar).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
      expect(alertar).toHaveBeenCalledWith(expect.objectContaining({ motivo: 'sem_correlacao_do_pedido' }))
    })

    it('the provider ties the charge to another order: this one is not delivered', async () => {
      semear()
      const antes = { ...pedidoNoBanco() }
      apiPix({
        [naWoovi(RENOVACAO_ANTIGA)]: cobrancaWoovi('COMPLETED', 'cob-antiga', `${OUTRO_PEDIDO}-rantiga`),
        [GRAVADA]: cobrancaWoovi('ACTIVE', 'cob-do-pedido'),
      })

      expect(await chamar(eventoPago({ correlationID: RENOVACAO_ANTIGA, identifier: 'cob-antiga' }), ASSINATURA)).toEqual({ ok: true, naoConfirmado: true })

      expect(processar).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
      expect(alertar).toHaveBeenCalledWith(expect.objectContaining({ motivo: 'de_outro_pedido' }))
    })

    it('order born on the fallback provider, with no Woovi charge at all', async () => {
      semear({ pix_provider: 'abacatepay', abacatepay_id: 'cob-abacate' })
      apiPix({ [ORIGINAL]: NAO_EXISTE, [NA_ABACATE]: pendenteNaAbacate })

      expect(await chamar(eventoPago({ identifier: 'cob-de-outra-conta' }), ASSINATURA)).toEqual({ ok: true, naoConfirmado: true })

      expect(processar).not.toHaveBeenCalled()
      expect(alertar).toHaveBeenCalledTimes(1)
    })

    it('the order was already delivered: no copy to finance, and no row is flagged through the identifier of the event', async () => {
      semear({ status: 'entregue' })
      eventos().push({ id: 'linha-de-outra-cobranca', provider: 'woovi', event: 'OPENPIX:CHARGE_COMPLETED', abacatepay_id: 'cob-de-outra-conta' })
      const forjada = `${PEDIDO}-rforjada`
      apiPix({ [naWoovi(forjada)]: NAO_EXISTE, [GRAVADA]: cobrancaWoovi('COMPLETED', 'cob-do-pedido') })

      expect(await chamar(eventoPago({ correlationID: forjada, identifier: 'cob-de-outra-conta', value: 999999 }), ASSINATURA)).toEqual({ ok: true, naoConfirmado: true })

      expect(financeiro).not.toHaveBeenCalled()
      expect(eventos().map((e: any) => e.processado === true)).toEqual([false, false])
      expect(alertar).toHaveBeenCalledTimes(1)
    })
  })

  describe('the order is paid on a charge of its own that the event does not name', () => {
    it('the order is delivered, but the event is neither copied to finance nor flagged', async () => {
      semear()
      const inexistente = `${PEDIDO}-rinexistente`
      apiPix({ [naWoovi(inexistente)]: NAO_EXISTE, [GRAVADA]: cobrancaWoovi('COMPLETED', 'cob-do-pedido') })

      expect(await chamar(eventoPago({ correlationID: inexistente, identifier: 'cob-inexistente' }), ASSINATURA)).toEqual({ ok: true, naoConfirmado: true })

      expect(processar).toHaveBeenCalledTimes(1)
      expect(processar).toHaveBeenCalledWith(db, expect.objectContaining({ id: PEDIDO, abacatepay_id: 'cob-do-pedido' }))
      expect(financeiro).not.toHaveBeenCalled()
      expect(eventoGravado()).not.toHaveProperty('processado', true)
    })

    it('a provider module that throws does not stop the next lookup: the paid original still delivers', async () => {
      config.abacatepayApiKey = ''
      semear({ pix_provider: 'abacatepay', abacatepay_id: 'cob-abacate' })
      const inexistente = `${PEDIDO}-rinexistente`
      const api = apiPix({ [naWoovi(inexistente)]: NAO_EXISTE, [ORIGINAL]: cobrancaWoovi('COMPLETED', 'cob-original') })

      expect(await chamar(eventoPago({ correlationID: inexistente, identifier: 'cob-inexistente' }), ASSINATURA)).toEqual({ ok: true, naoConfirmado: true })

      expect(consultadas(api)).toEqual([naWoovi(inexistente), ORIGINAL])
      expect(pedidoNoBanco()).toMatchObject({ pix_provider: 'woovi', abacatepay_id: 'cob-original' })
      expect(processar).toHaveBeenCalledTimes(1)
      expect(financeiro).not.toHaveBeenCalled()
    })

    it('the charge of the event cannot be asked: the order is delivered and the provider is asked to resend', async () => {
      semear()
      apiPix({ [ORIGINAL]: SEM_REDE, [GRAVADA]: cobrancaWoovi('COMPLETED', 'cob-do-pedido') })

      await expect(chamar(eventoPago(), ASSINATURA)).rejects.toMatchObject({ statusCode: 503 })

      expect(processar).toHaveBeenCalledTimes(1)
      expect(financeiro).not.toHaveBeenCalled()
      expect(eventoGravado()).not.toHaveProperty('processado', true)
    })
  })

  describe('the provider cannot be asked: 503, so that it resends', () => {
    it.each([
      ['a network error', SEM_REDE],
      ['an error of the provider itself', erroHttp(500)],
      ['a refused credential', erroHttp(401)],
      ['HTTP 200 with an empty object', {}],
      ['HTTP 200 with an error envelope', { errors: [{ message: 'mensagem do provedor' }], data: null }],
      ['HTTP 200 with a string', 'ok'],
      ['HTTP 200 with a charge without a status', { charge: { identifier: 'cob-do-pedido', correlationID: PEDIDO } }],
    ])('%s: nothing processed, event not flagged, no alert', async (_caso, resposta) => {
      semear()
      const antes = { ...pedidoNoBanco() }
      apiPix({ [ORIGINAL]: resposta, [GRAVADA]: resposta })

      await expect(chamar(eventoPago(), ASSINATURA)).rejects.toMatchObject({ statusCode: 503 })

      expect(processar).not.toHaveBeenCalled()
      expect(gravarHash).not.toHaveBeenCalled()
      expect(financeiro).not.toHaveBeenCalled()
      expect(alertar).not.toHaveBeenCalled()
      expect(pedidoNoBanco()).toEqual(antes)
      expect(eventoGravado()).not.toHaveProperty('processado', true)
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

    it('the database fails while repointing the order: 503, nothing processed', async () => {
      semear({ abacatepay_id: 'cob-renovada' })
      apiPix({ [ORIGINAL]: cobrancaWoovi('COMPLETED', 'cob-original') })
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
      expect(financeiro).not.toHaveBeenCalled()
    })
  })

  describe('events that are not a payment', () => {
    it('about a charge of ours: stored and copied to finance, nothing processed', async () => {
      semear()
      const api = apiPix({ [ORIGINAL]: cobrancaWoovi('EXPIRED', 'cob-do-pedido') })
      const corpo = eventoExpirou()

      expect(await chamar(corpo, ASSINATURA)).toEqual({ ok: true, ignored: 'OPENPIX:CHARGE_EXPIRED' })

      expect(consultadas(api)).toEqual([ORIGINAL])
      expect(eventos()).toHaveLength(1)
      expect(financeiro).toHaveBeenCalledTimes(1)
      expect(financeiro).toHaveBeenCalledWith(db, JSON.parse(corpo), corpo, PEDIDO, 'cob-do-pedido')
      expect(processar).not.toHaveBeenCalled()
      expect(eventoGravado()).not.toHaveProperty('processado', true)
    })

    it('naming our order but about a charge that is not ours: stored, not copied', async () => {
      semear({ status: 'entregue' })
      apiPix({ [ORIGINAL]: cobrancaWoovi('COMPLETED', 'cob-do-pedido') })
      const corpo = JSON.stringify({ event: 'OPENPIX:TRANSACTION_REFUND_RECEIVED', charge: { correlationID: PEDIDO, identifier: 'cob-de-outra-conta', value: 4490, status: 'ACTIVE' }, refund: { value: 4490 } })

      expect(await chamar(corpo, ASSINATURA)).toEqual({ ok: true, ignored: 'OPENPIX:TRANSACTION_REFUND_RECEIVED' })

      expect(eventos()).toHaveLength(1)
      expect(financeiro).not.toHaveBeenCalled()
      expect(processar).not.toHaveBeenCalled()
    })

    it('about no order of ours: stored, not copied, no provider asked', async () => {
      const api = apiPix({})

      expect(await chamar(eventoExpirou({ correlationID: OUTRO_PEDIDO, identifier: 'cob-de-outra-conta' }), ASSINATURA)).toEqual({ ok: true, ignored: 'OPENPIX:CHARGE_EXPIRED' })

      expect(eventos()).toHaveLength(1)
      expect(financeiro).not.toHaveBeenCalled()
      expect(api).not.toHaveBeenCalled()
    })

    it('the provider cannot be asked: 503, so the copy is not lost', async () => {
      semear()
      apiPix({ [ORIGINAL]: SEM_REDE })

      await expect(chamar(eventoExpirou(), ASSINATURA)).rejects.toMatchObject({ statusCode: 503 })

      expect(financeiro).not.toHaveBeenCalled()
    })
  })

  describe('events without a charge', () => {
    const semCobranca = JSON.stringify({ event: 'OPENPIX:TRANSACTION_RECEIVED', pix: { value: 1500, time: '2026-01-01T00:00:00.000Z', endToEndId: 'E-sem-cobranca' } })

    it('stored and copied to finance marked as not verified; no order is looked up, no provider asked', async () => {
      semear()
      const api = apiPix({})

      expect(await chamar(semCobranca, ASSINATURA)).toEqual({ ok: true, ignored: 'OPENPIX:TRANSACTION_RECEIVED' })

      expect(eventos()).toHaveLength(1)
      expect(financeiro).toHaveBeenCalledTimes(1)
      expect(financeiro).toHaveBeenCalledWith(db, JSON.parse(semCobranca), semCobranca, '', '', { naoVerificado: true })
      expect(api).not.toHaveBeenCalled()
      expect(processar).not.toHaveBeenCalled()
    })

    it('is never a payment of an order, whatever its name says', async () => {
      semear()
      const api = apiPix({})
      const corpo = JSON.stringify({ event: 'OPENPIX:CHARGE_COMPLETED', pix: { value: 4490, endToEndId: 'E-sem-cobranca-2' }, correlationID: PEDIDO })

      expect(await chamar(corpo, ASSINATURA)).toEqual({ ok: true, ignored: 'OPENPIX:CHARGE_COMPLETED' })

      expect(processar).not.toHaveBeenCalled()
      expect(api).not.toHaveBeenCalled()
      expect(financeiro).toHaveBeenCalledWith(db, JSON.parse(corpo), corpo, '', '', { naoVerificado: true })
    })
  })

  it('payment event whose correlationID matches no order: stored, nothing asked, nothing copied', async () => {
    const api = apiPix({})

    expect(await chamar(eventoPago({ correlationID: OUTRO_PEDIDO, identifier: 'cob-de-outra-conta' }), ASSINATURA)).toEqual({ ok: true, semPedido: true })

    expect(eventos()).toHaveLength(1)
    expect(eventoGravado()).not.toHaveProperty('processado', true)
    expect(financeiro).not.toHaveBeenCalled()
    expect(api).not.toHaveBeenCalled()
    expect(processar).not.toHaveBeenCalled()
  })
})
