import { describe, it, expect, vi, beforeEach } from 'vitest'

// Checkout limits wired into the Pix checkout, the embedded card intent and
// the Stripe session: when blocked, no order row and no provider charge.
vi.mock('../../utils/compra-repetida', () => ({ respostaCompraRepetida: async () => null }))
vi.mock('../../utils/blocklist', () => ({ barrarPlacaBloqueada: () => {} }))
const handlers: Record<string, any> = {}
let atual = ''
let body: any
let tabela: any[] = []
let inseridos: any[] = []
const provedor = { pix: 0, intent: 0, sessao: 0 }
const CONFIG: any = { public: { homolog: false }, premiumBaseUrl: 'https://example.test' }
const PLACA = 'TST1A23'

function q(filtros: ((l: any) => boolean)[] = []): any {
  let lim = Infinity
  const o: any = {
    select: () => o,
    eq: (c: string, v: any) => { filtros.push((l) => l[c] === v); return o },
    gte: (c: string, v: any) => { filtros.push((l) => String(l[c]) >= String(v)); return o },
    limit: (n: number) => { lim = n; return o },
    then: (ok: any, ko: any) => Promise.resolve({ data: tabela.filter((l) => filtros.every((f) => f(l))).slice(0, lim), error: null }).then(ok, ko),
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
vi.stubGlobal('getDispositivo', () => ({ dispositivo: 'celular', sistema: 'Android', canal: 'web', app_versao: null }))
vi.stubGlobal('provedorPix', () => ({ nome: 'woovi' }))
vi.stubGlobal('criarOuObterCliente', async () => null)
vi.stubGlobal('criarPixComFallback', async () => { provedor.pix++; return { charge: { id: 'px', brCode: 'br', brCodeBase64: 'b', expiresAt: null }, provedor: { nome: 'woovi', nomeDoRecebedor: () => 'X' } } })
vi.stubGlobal('validarCupom', async () => null)
vi.stubGlobal('reivindicarUsoCupomGratis', async () => false)
vi.stubGlobal('liberarUsoCupomGratis', async () => {})
vi.stubGlobal('registrarUsoCupom', async () => {})
vi.stubGlobal('stripeConfigurado', () => true)
vi.stubGlobal('criarPaymentIntent', async () => { provedor.intent++; return { id: 'pi_1', client_secret: 's' } })
vi.stubGlobal('criarStripeSession', async () => { provedor.sessao++; return { id: 'cs_1', url: 'https://example.test/s' } })

atual = 'pix'; await import('./checkout.post')
atual = 'intent'; await import('./cartao-intent.post')
atual = 'sessao'; await import('./checkout-stripe.post')

const recente = (o: any = {}) => ({ placa: PLACA, ambiente: 'producao', forma_pagamento: null, pago_em: null, status: 'aguardando_pagamento', criado_em: new Date(Date.now() - 60_000).toISOString(), ...o })
const erro = async (fn: () => Promise<any>) => { try { await fn(); return null } catch (e: any) { return e } }

describe('checkout endpoints: per-plate and card limits', () => {
  beforeEach(() => { tabela = []; inseridos = []; provedor.pix = provedor.intent = provedor.sessao = 0; body = { placa: PLACA, plano: 'completa' }; CONFIG.checkoutLimitePlacaHora = '' })

  it('below the limit the Pix is created', async () => {
    tabela = Array.from({ length: 5 }, () => recente())
    expect((await handlers.pix({})).brCode).toBe('br')
    expect(provedor.pix).toBe(1)
  })

  it('at the limit: 429, no order, no Pix at the provider', async () => {
    tabela = Array.from({ length: 6 }, () => recente())
    const e = await erro(() => handlers.pix({}))
    expect(e?.statusCode).toBe(429)
    expect(e?.message).toContain('Muitas tentativas')
    expect(inseridos).toHaveLength(0)
    expect(provedor.pix).toBe(0)
  })

  it('card intent: 3 unpaid card orders for the plate = 429, no PaymentIntent', async () => {
    tabela = Array.from({ length: 3 }, () => recente({ forma_pagamento: 'cartao' }))
    const e = await erro(() => handlers.intent({}))
    expect(e?.statusCode).toBe(429)
    expect(provedor.intent).toBe(0)
    expect(inseridos).toHaveLength(0)
  })

  it('card breaker: 503 on both card endpoints, Pix still works', async () => {
    tabela = Array.from({ length: 13 }, (_, i) => recente({ placa: `TST${String(i).padStart(4, '0')}`, forma_pagamento: 'cartao' }))
    for (const h of ['intent', 'sessao']) {
      const e = await erro(() => handlers[h]({}))
      expect(e?.statusCode, h).toBe(503)
      expect(e?.message).toBe('Cartão indisponível no momento. Use o Pix.')
    }
    expect(provedor.intent + provedor.sessao).toBe(0)
    expect((await handlers.pix({})).brCode).toBe('br')
  })

  it('env lowers the limit', async () => {
    CONFIG.checkoutLimitePlacaHora = '2'
    tabela = Array.from({ length: 2 }, () => recente())
    expect((await erro(() => handlers.pix({})))?.statusCode).toBe(429)
  })
})
