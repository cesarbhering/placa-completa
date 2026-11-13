import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gerarTokenCupomTela, segredoCupomTela } from '../../utils/cupom-tela'
import { validarCupom as validarCupomReal } from '../../utils/cupons'
import { precoExibidoNoCheckout, type BracoPreco } from '../../../shared/ab-preco'

// Price A/B test: the price the inline checkout SHOWS (precoExibidoNoCheckout,
// fed by /api/premium/coupon) must equal what /api/premium/checkout CHARGES,
// for percentage coupons, the screen coupon and the second-plate offer, in
// both arms. Real coupon validation; only storage and gateways are faked.
vi.mock('../../utils/compra-repetida', () => ({ respostaCompraRepetida: async () => null }))
vi.mock('../../utils/blocklist', () => ({ barrarPlacaBloqueada: () => {} }))
const handlers: Record<string, any> = {}
let atual = ''
let body: any
let cupom: any = null
const CONFIG: any = { public: { homolog: false, abPreco: 'on' }, premiumSupabaseKey: 'test-key' }
const SEG = segredoCupomTela(CONFIG)

const sb = {
  from(t: string) {
    if (t === 'cupons_premium') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: cupom, error: null }) }) }) }
    if (t === 'cupons_premium_usos') {
      return { select: () => { const q: any = { eq: () => q, then: (fn: any) => fn({ count: 0 }) }; return q } }
    }
    return {
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'p1' }, error: null }) }) }),
      update: () => ({ eq: async () => ({}) }),
    }
  },
}

vi.stubGlobal('defineEventHandler', (fn: any) => { handlers[atual] = fn; return fn })
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
vi.stubGlobal('assertPremiumGate', () => {})
vi.stubGlobal('useRuntimeConfig', () => CONFIG)
vi.stubGlobal('getClientIp', () => '1.2.3.4')
vi.stubGlobal('getCookie', () => undefined)
vi.stubGlobal('getDispositivo', () => ({ dispositivo: 'celular', sistema: 'Android', canal: 'web', app_versao: null }))
vi.stubGlobal('provedorPix', () => ({ nome: 'woovi' }))
vi.stubGlobal('criarOuObterCliente', async () => null)
vi.stubGlobal('criarPixComFallback', async () => ({ charge: { id: 'px', brCode: 'br', brCodeBase64: 'b64', expiresAt: null }, provedor: { nome: 'woovi', nomeDoRecebedor: () => 'X' } }))
vi.stubGlobal('validarCupom', (...a: any[]) => (validarCupomReal as any)(...a))
vi.stubGlobal('reivindicarUsoCupomGratis', async () => false)
vi.stubGlobal('liberarUsoCupomGratis', async () => {})
vi.stubGlobal('registrarUsoCupom', async () => {})
vi.stubGlobal('usePremiumSupabase', () => sb)

atual = 'cupom'; await import('./coupon.post')
atual = 'pix'; await import('./checkout.post')

const PLACA = 'AAA0A00'
const EMAIL = 'x@y.z'
const base = { id: 'c1', codigo: 'X', ativo: true, valido_de: null, valido_ate: null, limite_uso_global: null, limite_uso_por_cliente: null, permite_gratis: false, email_restrito: null, pedido_origem_id: null }
const CUPONS: Record<string, any> = {
  percentual: { ...base, tipo: 'percentual', valor: 10, planos: ['basica', 'completa'], origem: 'recompra' },
  pequeno: { ...base, tipo: 'percentual', valor: 3, planos: ['basica', 'completa'], origem: 'recompra' },
  bump: { ...base, tipo: 'fixo', valor: 1500, planos: ['completa'], origem: 'bump' },
}

async function mostradoECobrado(braco: BracoPreco, tipoCupom: string | null, tela: boolean) {
  cupom = tipoCupom ? CUPONS[tipoCupom] : null
  let descontoCupom = 0
  if (tipoCupom) {
    body = { codigo: 'X', plano: 'completa', email: EMAIL, ab_preco: braco }
    const r = await handlers.cupom({})
    expect(r.ok).toBe(true)
    descontoCupom = r.descontoCentavos
  }
  const mostrado = precoExibidoNoCheckout('completa', braco, descontoCupom, tela)
  body = {
    placa: PLACA, plano: 'completa', email: EMAIL, ab_preco: braco,
    cupom: tipoCupom ? 'X' : undefined,
    cupom_tela: tela ? gerarTokenCupomTela(SEG, PLACA, Date.now() - 60_000) : undefined,
  }
  const cobrado = (await handlers.pix({})).valor
  return { mostrado, cobrado }
}

describe('shown price = charged price, both arms', () => {
  beforeEach(() => { cupom = null })

  for (const braco of ['A', 'B'] as const) {
    it(`arm ${braco}: percentage coupon`, async () => {
      const { mostrado, cobrado } = await mostradoECobrado(braco, 'percentual', false)
      expect(cobrado).toBe(mostrado)
      expect(cobrado).toBe(braco === 'B' ? 3591 : 4041)
    })
    it(`arm ${braco}: screen coupon`, async () => {
      const { mostrado, cobrado } = await mostradoECobrado(braco, null, true)
      expect(cobrado).toBe(mostrado)
      expect(cobrado).toBe(braco === 'B' ? 3790 : 4265)
    })
    it(`arm ${braco}: second-plate offer lands on 29,90`, async () => {
      const { mostrado, cobrado } = await mostradoECobrado(braco, 'bump', false)
      expect(cobrado).toBe(mostrado)
      expect(cobrado).toBe(2990)
    })
    it(`arm ${braco}: second-plate offer still beats the screen coupon`, async () => {
      const { mostrado, cobrado } = await mostradoECobrado(braco, 'bump', true)
      expect(cobrado).toBe(mostrado)
      expect(cobrado).toBe(2990)
    })
    it(`arm ${braco}: smaller coupon loses to the screen coupon`, async () => {
      const { mostrado, cobrado } = await mostradoECobrado(braco, 'pequeno', true)
      expect(cobrado).toBe(mostrado)
    })
  }
})
