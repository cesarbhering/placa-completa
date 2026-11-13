import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gerarTokenCupomTela, segredoCupomTela } from '../../utils/cupom-tela'

// Price A/B test (shared/ab-preco.ts) on the Pix and card checkouts: the
// server charges the arm's price only with the flag on, a valid arm and
// outside the app; anything else is the table price. The column is only sent
// with the flag on (deploy-safe before the migration).
vi.mock('../../utils/compra-repetida', () => ({ respostaCompraRepetida: async () => null }))
vi.mock('../../utils/blocklist', () => ({ barrarPlacaBloqueada: () => {} }))
const handlers: Record<string, any> = {}
let atual = ''
let body: any
let inserido: any
let canal = 'web'
let cupomArgs: any[] = []
let cupomResposta: any = null
const CONFIG: any = { public: { homolog: false, abPreco: '' }, premiumSupabaseKey: 'test-key' }
const SEG = segredoCupomTela(CONFIG)
vi.stubGlobal('defineEventHandler', (fn: any) => { handlers[atual] = fn; return fn })
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
vi.stubGlobal('assertPremiumGate', () => {})
vi.stubGlobal('useRuntimeConfig', () => CONFIG)
vi.stubGlobal('getClientIp', () => '1.2.3.4')
vi.stubGlobal('getCookie', () => undefined)
vi.stubGlobal('getDispositivo', () => ({ dispositivo: 'celular', sistema: 'Android', canal, app_versao: null }))
vi.stubGlobal('provedorPix', () => ({ nome: 'woovi' }))
vi.stubGlobal('criarOuObterCliente', async () => null)
vi.stubGlobal('criarPixComFallback', async () => ({ charge: { id: 'px', brCode: 'br', brCodeBase64: 'b64', expiresAt: null }, provedor: { nome: 'woovi', nomeDoRecebedor: () => 'X' } }))
vi.stubGlobal('validarCupom', async (...a: any[]) => { cupomArgs = a; return cupomResposta })
vi.stubGlobal('reivindicarUsoCupomGratis', async () => false)
vi.stubGlobal('liberarUsoCupomGratis', async () => {})
vi.stubGlobal('registrarUsoCupom', async () => {})
vi.stubGlobal('stripeConfigurado', () => true)
vi.stubGlobal('criarPaymentIntent', async () => ({ id: 'pi_1', client_secret: 'sec' }))
vi.stubGlobal('usePremiumSupabase', () => ({
  from: () => ({
    insert: (row: any) => { inserido = row; return { select: () => ({ single: async () => ({ data: { id: 'p1' }, error: null }) }) } },
    update: () => ({ eq: async () => ({}) }),
  }),
}))

atual = 'pix'; await import('./checkout.post')
atual = 'cartao'; await import('./cartao-intent.post')

const PLACA = 'AAA0A00'
const pix = () => handlers.pix({})
const cartao = () => handlers.cartao({})

describe('checkout: price A/B arm', () => {
  beforeEach(() => { inserido = null; canal = 'web'; cupomArgs = []; cupomResposta = null; CONFIG.public.abPreco = '' })

  it('flag off: table price even with B in the body, and no ab_preco column sent', async () => {
    body = { placa: PLACA, plano: 'completa', ab_preco: 'B' }
    expect((await pix()).valor).toBe(4490)
    expect('ab_preco' in inserido).toBe(false)
  })

  it('flag on + arm B: charges 39,90 and records the arm', async () => {
    CONFIG.public.abPreco = 'on'
    body = { placa: PLACA, plano: 'completa', ab_preco: 'B' }
    expect((await pix()).valor).toBe(3990)
    expect(inserido).toMatchObject({ valor_centavos: 3990, ab_preco: 'B' })
  })

  it('flag on + arm A: table price, arm recorded', async () => {
    CONFIG.public.abPreco = 'on'
    body = { placa: PLACA, plano: 'completa', ab_preco: 'A' }
    expect((await pix()).valor).toBe(4490)
    expect(inserido.ab_preco).toBe('A')
  })

  it('flag on + invalid or missing arm: falls back to A price, recorded as null', async () => {
    CONFIG.public.abPreco = 'on'
    for (const ab of ['C', 'b', 39, undefined]) {
      body = { placa: PLACA, plano: 'completa', ab_preco: ab }
      expect((await pix()).valor).toBe(4490)
      expect(inserido.ab_preco).toBeNull()
    }
  })

  it('the app is always A, even if B arrives', async () => {
    CONFIG.public.abPreco = 'on'
    canal = 'app'
    body = { placa: PLACA, plano: 'completa', ab_preco: 'B' }
    expect((await pix()).valor).toBe(4490)
    expect(inserido.ab_preco).toBeNull()
  })

  it('the Basica never varies', async () => {
    CONFIG.public.abPreco = 'on'
    body = { placa: PLACA, plano: 'basica', ab_preco: 'B' }
    expect((await pix()).valor).toBe(2990)
  })

  it('screen coupon (5%) applies on the arm price', async () => {
    CONFIG.public.abPreco = 'on'
    body = { placa: PLACA, plano: 'completa', ab_preco: 'B', cupom_tela: gerarTokenCupomTela(SEG, PLACA, Date.now() - 60_000) }
    const r = await pix()
    expect(r.valor).toBe(3790)
    expect(r.cupomAplicado).toEqual({ descontoCentavos: 200, tela: true })
  })

  it('typed coupon is validated against the arm', async () => {
    CONFIG.public.abPreco = 'on'
    cupomResposta = { ok: true, cupomId: 'c1', precoBrutoCentavos: 3990, descontoCentavos: 399, precoLiquidoCentavos: 3591 }
    body = { placa: PLACA, plano: 'completa', ab_preco: 'B', email: 'x@y.z', cupom: 'DEZ' }
    expect((await pix()).valor).toBe(3591)
    expect(cupomArgs[4]).toBe('B')
  })

  it('card checkout follows the same rule', async () => {
    CONFIG.public.abPreco = 'on'
    body = { placa: PLACA, plano: 'completa', ab_preco: 'B' }
    expect((await cartao()).valor).toBe(3990)
    expect(inserido).toMatchObject({ valor_centavos: 3990, ab_preco: 'B', forma_pagamento: 'cartao' })
    CONFIG.public.abPreco = 'off'
    expect((await cartao()).valor).toBe(4490)
    expect('ab_preco' in inserido).toBe(false)
  })
})
