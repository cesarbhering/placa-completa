// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { consultaQueFalhou } from './pix-consulta'
import * as woovi from './woovi'
import * as abacate from './abacatepay'

// A charge lookup has three outcomes: the provider returned the charge, the
// provider answered that there is no such charge, or the provider did not
// answer. The provider modules are real here; only $fetch is faked.

const WOOVI = 'https://woovi.test'
const ABACATE = 'https://abacate.test'
/** An HTTP error as ofetch throws it. */
const erroHttp = (status: number, data: unknown = {}) => Object.assign(new Error(`[GET] ${status}`), { status, statusCode: status, data })
const SEM_REDE = new TypeError('fetch failed')
/** HTTP 200 answers that are not a charge in the expected shape. */
const FORA_DO_FORMATO: [string, unknown][] = [
  ['an empty object', {}],
  ['an error envelope', { errors: [{ message: 'mensagem do provedor' }], data: null }],
  ['a string', 'ok'],
  ['nothing', null],
]

let config: Record<string, unknown>
let api: ReturnType<typeof vi.fn>

beforeEach(() => {
  config = { wooviAppId: 'app-id-de-teste', wooviBase: WOOVI, abacatepayApiKey: 'chave-abacate-de-teste', abacatepayBase: ABACATE }
  api = vi.fn()
  vi.stubGlobal('useRuntimeConfig', () => config)
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
  vi.stubGlobal('$fetch', api)
})
afterEach(() => vi.unstubAllGlobals())

describe('consultaQueFalhou', () => {
  it.each([400, 404])('HTTP %i: the provider answered that the charge does not exist', (status) => {
    expect(consultaQueFalhou(erroHttp(status))).toEqual({ situacao: 'nao_encontrada' })
  })

  it.each([401, 403, 408, 429, 500, 502, 503, 504])('HTTP %i: the provider did not answer the question', (status) => {
    expect(consultaQueFalhou(erroHttp(status))).toEqual({ situacao: 'sem_resposta' })
  })

  it('no HTTP status at all (network error, timeout): no answer', () => {
    expect(consultaQueFalhou(SEM_REDE)).toEqual({ situacao: 'sem_resposta' })
    expect(consultaQueFalhou(undefined)).toEqual({ situacao: 'sem_resposta' })
  })

  it('reads the status wherever the HTTP client puts it', () => {
    expect(consultaQueFalhou({ response: { status: 404 } })).toEqual({ situacao: 'nao_encontrada' })
    expect(consultaQueFalhou({ statusCode: 404 })).toEqual({ situacao: 'nao_encontrada' })
    expect(consultaQueFalhou({ status: 404 })).toEqual({ situacao: 'nao_encontrada' })
  })
})

describe('Woovi', () => {
  const cobranca = { status: 'COMPLETED', identifier: 'cob-1', correlationID: 'pedido-1-rabc', value: 4490, brCode: '00020101021226-teste' }

  describe('consultarPix', () => {
    it('charge returned: encontrada, with the status in our vocabulary', async () => {
      api.mockResolvedValue({ charge: cobranca })

      expect(await woovi.consultarPix('cob-1')).toEqual({
        situacao: 'encontrada',
        cobranca: { status: 'PAID', brCode: '00020101021226-teste', brCodeBase64: expect.stringMatching(/^data:image\/svg\+xml;base64,/) },
      })
      expect(api).toHaveBeenCalledWith(`${WOOVI}/api/v1/charge/cob-1`, { method: 'GET', headers: expect.objectContaining({ Authorization: 'app-id-de-teste' }) })
    })

    it.each([
      ['400 with an error message, the only error this lookup documents', erroHttp(400, { error: 'mensagem do provedor' })],
      ['404', erroHttp(404)],
    ])('%s: nao_encontrada', async (_caso, erro) => {
      api.mockRejectedValue(erro)
      expect(await woovi.consultarPix('cob-1')).toEqual({ situacao: 'nao_encontrada' })
    })

    it.each([
      ['500', erroHttp(500)],
      ['401, the credential was refused', erroHttp(401, { error: 'Invalid appID' })],
      ['429', erroHttp(429)],
      ['network error', SEM_REDE],
    ])('%s: sem_resposta', async (_caso, erro) => {
      api.mockRejectedValue(erro)
      expect(await woovi.consultarPix('cob-1')).toEqual({ situacao: 'sem_resposta' })
    })

    it.each([
      ...FORA_DO_FORMATO,
      ['a charge without a status', { charge: { identifier: 'cob-1', correlationID: 'pedido-1' } }],
    ])('HTTP 200 with %s: sem_resposta, neither pending nor missing', async (_caso, corpo) => {
      api.mockResolvedValue(corpo)
      expect(await woovi.consultarPix('cob-1')).toEqual({ situacao: 'sem_resposta' })
    })

    it('provider not configured: throws, like checarPix always did', async () => {
      config.wooviAppId = ''
      await expect(woovi.consultarPix('cob-1')).rejects.toMatchObject({ statusCode: 503 })
      expect(api).not.toHaveBeenCalled()
    })
  })

  describe('checarPix keeps its contract', () => {
    it('charge returned: its status', async () => {
      api.mockResolvedValue({ charge: { ...cobranca, status: 'ACTIVE' } })
      expect(await woovi.checarPix('cob-1')).toMatchObject({ status: 'PENDING', brCode: '00020101021226-teste' })
    })

    it.each([
      ['not found', erroHttp(400)],
      ['no answer', erroHttp(500)],
      ['network error', SEM_REDE],
    ])('%s: null', async (_caso, erro) => {
      api.mockRejectedValue(erro)
      expect(await woovi.checarPix('cob-1')).toBeNull()
    })
  })

  describe('consultarCobrancaPorCorrelacao', () => {
    it('charge returned: encontrada, with its identifier and its correlationID', async () => {
      api.mockResolvedValue({ charge: cobranca })

      expect(await woovi.consultarCobrancaPorCorrelacao('pedido-1-rabc')).toEqual({
        situacao: 'encontrada',
        cobranca: { status: 'PAID', identifier: 'cob-1', correlationID: 'pedido-1-rabc' },
      })
      expect(api).toHaveBeenCalledWith(`${WOOVI}/api/v1/charge/pedido-1-rabc`, { method: 'GET', headers: expect.objectContaining({ Authorization: 'app-id-de-teste' }) })
    })

    it('the correlationID is URL-encoded in the path', async () => {
      api.mockResolvedValue({ charge: cobranca })
      await woovi.consultarCobrancaPorCorrelacao('a/b?c#d')
      expect(api.mock.calls[0]![0]).toBe(`${WOOVI}/api/v1/charge/a%2Fb%3Fc%23d`)
    })

    it.each([
      ['400', erroHttp(400, { error: 'mensagem do provedor' })],
      ['404', erroHttp(404)],
    ])('%s: nao_encontrada', async (_caso, erro) => {
      api.mockRejectedValue(erro)
      expect(await woovi.consultarCobrancaPorCorrelacao('pedido-1')).toEqual({ situacao: 'nao_encontrada' })
    })

    it.each([
      ...FORA_DO_FORMATO,
      ['a charge without a status', { charge: { identifier: 'cob-1', correlationID: 'pedido-1' } }],
      ['a charge without an identifier', { charge: { status: 'COMPLETED', correlationID: 'pedido-1' } }],
    ])('HTTP 200 with %s: sem_resposta, neither pending nor missing', async (_caso, corpo) => {
      api.mockResolvedValue(corpo)
      expect(await woovi.consultarCobrancaPorCorrelacao('pedido-1')).toEqual({ situacao: 'sem_resposta' })
    })

    it.each([
      ['500', () => api.mockRejectedValue(erroHttp(500))],
      ['network error', () => api.mockRejectedValue(SEM_REDE)],
      ['provider not configured', () => { config.wooviAppId = '' }],
    ])('%s: sem_resposta, without throwing', async (_caso, preparar) => {
      preparar()
      expect(await woovi.consultarCobrancaPorCorrelacao('pedido-1')).toEqual({ situacao: 'sem_resposta' })
    })
  })

  describe('cobrancaPorCorrelacao keeps its contract', () => {
    it('charge returned: status and identifier, nothing else', async () => {
      api.mockResolvedValue({ charge: cobranca })
      expect(await woovi.cobrancaPorCorrelacao('pedido-1-rabc')).toStrictEqual({ status: 'PAID', identifier: 'cob-1' })
    })

    it.each([
      ['not found', erroHttp(400)],
      ['no answer', erroHttp(500)],
    ])('%s: null', async (_caso, erro) => {
      api.mockRejectedValue(erro)
      expect(await woovi.cobrancaPorCorrelacao('pedido-1')).toBeNull()
    })
  })
})

describe('AbacatePay', () => {
  const dados = { status: 'PENDING', expiresAt: '2999-01-01T00:00:00.000Z' }

  describe('consultarPix', () => {
    it('charge returned: encontrada, with what the provider sent', async () => {
      api.mockResolvedValue({ data: dados, success: true, error: null })

      expect(await abacate.consultarPix('cob-abacate')).toEqual({ situacao: 'encontrada', cobranca: dados })
      expect(api).toHaveBeenCalledWith(`${ABACATE}/transparents/check`, { method: 'GET', headers: { Authorization: 'Bearer chave-abacate-de-teste' }, query: { id: 'cob-abacate' } })
    })

    it('404: nao_encontrada', async () => {
      api.mockRejectedValue(erroHttp(404, { data: null, success: false, error: 'mensagem do provedor' }))
      expect(await abacate.consultarPix('cob-abacate')).toEqual({ situacao: 'nao_encontrada' })
    })

    it.each([
      ...FORA_DO_FORMATO,
      ['an envelope without data', { data: null, success: false, error: 'mensagem do provedor' }],
      ['data without a status', { data: { expiresAt: '2999-01-01T00:00:00.000Z' }, success: true, error: null }],
    ])('HTTP 200 with %s: sem_resposta, neither pending nor missing', async (_caso, corpo) => {
      api.mockResolvedValue(corpo)
      expect(await abacate.consultarPix('cob-abacate')).toEqual({ situacao: 'sem_resposta' })
    })

    it.each([
      ['500', erroHttp(500)],
      ['401', erroHttp(401)],
      ['network error', SEM_REDE],
    ])('%s: sem_resposta', async (_caso, erro) => {
      api.mockRejectedValue(erro)
      expect(await abacate.consultarPix('cob-abacate')).toEqual({ situacao: 'sem_resposta' })
    })
  })

  describe('checarPix keeps its contract', () => {
    it('charge returned: what the provider sent', async () => {
      api.mockResolvedValue({ data: dados, success: true, error: null })
      expect(await abacate.checarPix('cob-abacate')).toBe(dados)
    })

    it.each([
      ['not found', erroHttp(404)],
      ['no answer', erroHttp(500)],
      ['network error', SEM_REDE],
    ])('%s: null', async (_caso, erro) => {
      api.mockRejectedValue(erro)
      expect(await abacate.checarPix('cob-abacate')).toBeNull()
    })
  })
})
