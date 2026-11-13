import { describe, it, expect, vi, beforeEach } from 'vitest'
import { _zerarCupomLimite } from '../../utils/cupom-limite'
import { _zerarEmVoo } from '../../utils/checkout-limite'
import { _zerarGateLimite, GATE_BLOQUEIO_MS } from '../../utils/gate-limite'

// Typed-coupon attempt limits wired into /api/premium/coupon and the order
// endpoints, and the wrong-password lock of the gate. Fake data only.
vi.mock('../../utils/compra-repetida', () => ({ respostaCompraRepetida: async () => null }))
vi.mock('../../utils/blocklist', () => ({ barrarPlacaBloqueada: () => {} }))
let consultasPorCodigo = 0
vi.mock('../../utils/cupom-recompra', () => ({
  origemDoCupom: () => ({}),
  cupomDispensaEmail: async () => { consultasPorCodigo++; return false },
}))
const handlers: Record<string, any> = {}
let atual = ''
let body: any
let inseridos: any[] = []
const provedor = { pix: 0, intent: 0, sessao: 0 }
const CONFIG: any = { public: { homolog: false, gated: false }, premiumBaseUrl: 'https://example.test', premiumPagePassword: 'test-password' }
const PLACA = 'TST1A23'
const PLACA_ANTIGA = 'TST1023' // same vehicle, old format
const CODIGO = 'FAKECODE00'
const EMAIL = 'buyer@example.test'

function q(): any {
  const o: any = {
    select: () => o, eq: () => o, in: () => o, gte: () => o, order: () => o, limit: () => o,
    then: (ok: any, ko: any) => Promise.resolve({ data: [], error: null }).then(ok, ko),
  }
  return o
}
vi.stubGlobal('usePremiumSupabase', () => ({
  from: () => ({
    ...q(),
    insert: (row: any) => { inseridos.push(row); return { select: () => ({ single: async () => ({ data: { id: 'p1' }, error: null }) }) } },
    update: () => ({ eq: async () => ({}) }),
  }),
}))
vi.stubGlobal('defineEventHandler', (fn: any) => { handlers[atual] = fn; return fn })
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
vi.stubGlobal('assertPremiumGate', () => {})
vi.stubGlobal('useRuntimeConfig', () => CONFIG)
vi.stubGlobal('getClientIp', () => '0.0.0.0')
vi.stubGlobal('getCookie', () => undefined)
vi.stubGlobal('setCookie', () => {})
vi.stubGlobal('getRequestProtocol', () => 'https')
vi.stubGlobal('getDispositivo', () => ({ dispositivo: 'celular', sistema: 'Android', canal: 'web', app_versao: null }))
vi.stubGlobal('provedorPix', () => ({ nome: 'woovi' }))
vi.stubGlobal('criarOuObterCliente', async () => null)
vi.stubGlobal('criarPixComFallback', async (o: any) => { provedor.pix++; return { charge: { id: 'px', brCode: 'br', brCodeBase64: 'b', expiresAt: null, valor: o.amountCentavos }, provedor: { nome: 'woovi', nomeDoRecebedor: () => 'X' } } })
let validacoes = 0
let cupomResposta: any
vi.stubGlobal('validarCupom', async () => { validacoes++; return cupomResposta })
vi.stubGlobal('reivindicarUsoCupomGratis', async () => false)
vi.stubGlobal('liberarUsoCupomGratis', async () => {})
vi.stubGlobal('registrarUsoCupom', async () => {})
vi.stubGlobal('stripeConfigurado', () => true)
vi.stubGlobal('criarPaymentIntent', async (o: any) => { provedor.intent++; return { id: 'pi_1', client_secret: 's', amount: o?.amountCentavos } })
vi.stubGlobal('criarStripeSession', async () => { provedor.sessao++; return { id: 'cs_1', url: 'https://example.test/s' } })

atual = 'coupon'; await import('./coupon.post')
atual = 'pix'; await import('./checkout.post')
atual = 'intent'; await import('./cartao-intent.post')
atual = 'sessao'; await import('./checkout-stripe.post')
atual = 'gate'; await import('./gate.post')

const INVALIDO = { ok: false, motivo: 'Cupom nao encontrado.', contaTentativa: true, precoBrutoCentavos: 4490, descontoCentavos: 0, precoLiquidoCentavos: 4490 }
const VALIDO = { ok: true, cupomId: 'c1', precoBrutoCentavos: 4490, descontoCentavos: 1000, precoLiquidoCentavos: 3490 }
const erro = async (fn: () => Promise<any>) => { try { await fn(); return null } catch (e: any) { return e } }

/** Five invalid validations for the plate through /api/premium/coupon. */
async function estourarPlaca(placa = PLACA) {
  cupomResposta = INVALIDO
  for (let i = 0; i < 5; i++) {
    body = { codigo: CODIGO, plano: 'completa', placa }
    expect((await handlers.coupon({})).ok).toBe(false)
  }
}

describe('coupon endpoint and order endpoints under the coupon limit', () => {
  beforeEach(() => {
    _zerarCupomLimite(); _zerarEmVoo(); _zerarGateLimite()
    inseridos = []; validacoes = 0; consultasPorCodigo = 0; cupomResposta = null
    provedor.pix = provedor.intent = provedor.sessao = 0
    CONFIG.public.gated = false
  })

  it('coupon endpoint: 429 marked `limite` after 5 invalid, in both plate formats', async () => {
    await estourarPlaca(PLACA)
    body = { codigo: CODIGO, plano: 'completa', placa: PLACA_ANTIGA }
    const e = await erro(() => handlers.coupon({}))
    expect(e?.statusCode).toBe(429)
    expect(e?.message).toBe('Muitas tentativas de cupom para esta placa. Tente de novo mais tarde.')
    expect(e?.data).toEqual({ limite: true, motivo: 'cupom_placa' })
    expect(validacoes).toBe(5)
  })

  it('coupon endpoint: the internal flag never reaches the browser', async () => {
    cupomResposta = INVALIDO
    body = { codigo: CODIGO, plano: 'completa', placa: PLACA }
    expect(await handlers.coupon({})).not.toHaveProperty('contaTentativa')
  })

  it('a sale without a coupon goes on with the limit tripped', async () => {
    await estourarPlaca()
    body = { placa: PLACA, plano: 'completa' }
    expect((await handlers.pix({})).brCode).toBe('br')
    expect((await handlers.intent({})).clientSecret).toBe('s')
    expect(provedor.pix + provedor.intent).toBe(2)
  })

  it('typed coupon with the limit tripped = invalid coupon, full price, no coupon lookup', async () => {
    await estourarPlaca()
    cupomResposta = VALIDO // would be valid, but the limit holds it
    const antes = validacoes
    for (const h of ['pix', 'intent', 'sessao']) {
      body = { placa: PLACA, plano: 'completa', email: EMAIL, cupom: CODIGO }
      await handlers[h]({})
    }
    expect(validacoes).toBe(antes)
    expect(inseridos).toHaveLength(3)
    for (const row of inseridos) expect(row.valor_centavos ?? row.valor).toBe(4490)
    expect(provedor.pix + provedor.intent + provedor.sessao).toBe(3)
  })

  it('without the limit the typed coupon still applies', async () => {
    cupomResposta = VALIDO
    body = { placa: PLACA, plano: 'completa', email: EMAIL, cupom: CODIGO }
    await handlers.pix({})
    expect(validacoes).toBe(1)
    expect(inseridos[0].valor_centavos ?? inseridos[0].valor).toBe(3490)
  })

  it('coupon without e-mail and the limit tripped: same 400 as today, no lookup by code', async () => {
    await estourarPlaca()
    for (const h of ['pix', 'intent', 'sessao']) {
      body = { placa: PLACA, plano: 'completa', cupom: CODIGO }
      expect((await erro(() => handlers[h]({})))?.message, h).toBe('Informe o e-mail para usar um cupom.')
    }
    expect(consultasPorCodigo).toBe(0)
  })

  it('invalid typed coupons at checkout count toward the plate limit', async () => {
    cupomResposta = INVALIDO
    for (let i = 0; i < 5; i++) {
      body = { placa: PLACA, plano: 'completa', email: EMAIL, cupom: CODIGO }
      await handlers.pix({})
    }
    body = { codigo: CODIGO, plano: 'completa', placa: PLACA }
    expect((await erro(() => handlers.coupon({})))?.statusCode).toBe(429)
  })

  it('logs carry no coupon code or e-mail', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await estourarPlaca()
    body = { codigo: CODIGO, plano: 'completa', placa: PLACA, email: EMAIL }
    await erro(() => handlers.coupon({}))
    body = { placa: PLACA, plano: 'completa', email: EMAIL, cupom: CODIGO }
    await handlers.pix({})
    const linhas = spy.mock.calls.map((c) => c.join(' ')).filter((l) => l.includes('[cupom-limite]'))
    spy.mockRestore()
    expect(linhas.length).toBe(2)
    for (const l of linhas) {
      expect(l).not.toContain(CODIGO)
      expect(l).not.toContain(EMAIL)
      expect(l).toContain('plate=TST****')
    }
  })
})

describe('gate: wrong-password lock', () => {
  beforeEach(() => { _zerarGateLimite(); CONFIG.public.gated = true; vi.restoreAllMocks() })

  it('more than 10 wrong passwords lock it for 10 min, even for the right one, then it opens', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const t0 = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(t0)
    for (let i = 0; i < 10; i++) {
      body = { password: 'wrong-pass-00' }
      expect((await erro(() => handlers.gate({})))?.statusCode).toBe(401)
    }
    body = { password: 'test-password' }
    expect(await handlers.gate({})).toEqual({ ok: true }) // 10 wrong: still open
    body = { password: 'wrong-pass-00' }
    expect((await erro(() => handlers.gate({})))?.statusCode).toBe(401) // 11th arms it
    body = { password: 'test-password' }
    expect((await erro(() => handlers.gate({})))?.statusCode).toBe(429)
    vi.spyOn(Date, 'now').mockReturnValue(t0 + GATE_BLOQUEIO_MS)
    expect(await handlers.gate({})).toEqual({ ok: true })
  })

  it('production (not gated) is untouched', async () => {
    CONFIG.public.gated = false
    body = { password: 'anything' }
    for (let i = 0; i < 20; i++) expect(await handlers.gate({})).toEqual({ ok: true })
  })
})
