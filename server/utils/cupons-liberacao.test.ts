import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validarCupom } from './cupons'

// A card attempt that will never be paid stops spending a limited coupon:
// at the limit, validarCupom cancels its PaymentIntent at Stripe and only then
// marks the use released (cupons_premium_usos.liberado_em). Stripe and the
// database are fakes; no network.

const stripe = vi.hoisted(() => ({ ler: vi.fn(), cancelar: vi.fn() }))
vi.mock('./stripe', () => ({
  lerPaymentIntent: (id: string) => stripe.ler(id),
  cancelarPaymentIntent: (id: string) => stripe.cancelar(id),
}))

interface Uso { id: string; cupom_id: string; email: string | null; pedido_id: string; liberado_em: string | null }
interface Pedido { id: string; status: string; forma_pagamento: string; stripe_session_id: string | null; criado_em: string }

const EMAIL = 'buyer@example.test'
const MIN = 60_000
/** 1 use per coupon and per buyer, like the recovery coupon. */
const CUPOM = {
  id: 'c1', codigo: 'FAKE10', tipo: 'percentual', valor: 10, planos: ['basica', 'completa'], ativo: true,
  valido_de: null, valido_ate: null, limite_uso_global: 1, limite_uso_por_cliente: 1, permite_gratis: false,
  email_restrito: null, origem: null,
}

/**
 * In-memory cupons_premium + cupons_premium_usos (+ the pedidos_premium embed)
 * with the query shapes cupons.ts uses. semColuna = migration not applied yet.
 */
function banco(o: { cupom?: any; usos: Uso[]; pedidos: Pedido[]; semColuna?: boolean }) {
  const rpcs: [string, any][] = []
  const consulta = (tabela: string) => {
    const filtros: [string, any][] = []
    let modo: 'linhas' | 'count' | 'update' = 'linhas'
    let patch: any = null
    let semColuna = false
    const pedidoDe = (u: Uso) => o.pedidos.find((p) => p.id === u.pedido_id)!
    const valor = (u: Uso, c: string) => (c.startsWith('pedidos_premium.') ? (pedidoDe(u) as any)[c.slice('pedidos_premium.'.length)] : (u as any)[c])
    const resolver = () => {
      if (tabela === 'cupons_premium') return { data: o.cupom ?? CUPOM, error: null }
      if (semColuna) return { data: null, count: null, error: { message: 'column cupons_premium_usos.liberado_em does not exist' } }
      const linhas = o.usos.filter((u) => filtros.every(([c, v]) => valor(u, c) === v))
      if (modo === 'count') return { count: linhas.length, error: null }
      if (modo === 'update') {
        linhas.forEach((u) => Object.assign(u, patch))
        return { data: linhas.map((u) => ({ id: u.id })), error: null }
      }
      return { data: linhas.map((u) => ({ id: u.id, pedidos_premium: pedidoDe(u) })), error: null }
    }
    const q: any = {
      select: (_c: string, opts?: any) => { if (modo !== 'update') modo = opts?.head ? 'count' : 'linhas'; return q },
      update: (p: any) => { modo = 'update'; patch = p; return q },
      eq: (c: string, v: any) => { filtros.push([c, v]); return q },
      is: (c: string, v: any) => { if (o.semColuna && c === 'liberado_em') semColuna = true; filtros.push([c, v]); return q },
      limit: () => q,
      maybeSingle: async () => resolver(),
      then: (ok: any, ko: any) => Promise.resolve(resolver()).then(ok, ko),
    }
    return q
  }
  return { rpcs, from: consulta, rpc: async (nome: string, args: any) => { rpcs.push([nome, args]); return { data: null, error: null } } } as any
}

/** One use of the coupon by EMAIL, on order p1 (a card order waiting for payment unless changed). */
function comUmUso(pedido: Partial<Pedido> = {}, extra: { semColuna?: boolean; cupom?: any; uso?: Partial<Uso> } = {}) {
  const usos: Uso[] = [{ id: 'u1', cupom_id: 'c1', email: EMAIL, pedido_id: 'p1', liberado_em: null, ...extra.uso }]
  const pedidos: Pedido[] = [{
    id: 'p1', status: 'aguardando_pagamento', forma_pagamento: 'cartao', stripe_session_id: 'pi_1',
    criado_em: new Date(Date.now() - 2 * MIN).toISOString(), ...pedido,
  }]
  return { usos, db: banco({ usos, pedidos, semColuna: extra.semColuna, cupom: extra.cupom }) }
}
const validar = (db: any) => validarCupom(db, 'FAKE10', 'completa', EMAIL)
const recusado = (r: any) => !r.ok && r.motivo === 'Este cupom ja foi utilizado.'

beforeEach(() => {
  stripe.ler.mockReset()
  stripe.cancelar.mockReset().mockResolvedValue(true)
})

describe('coupon use of a card attempt that will never be paid', () => {
  for (const [caso, pi, criadoHaMin] of [
    ['declined (or 3DS failed)', { status: 'requires_payment_method', falhou: true }, 2],
    ['opened over 30 min ago and never charged', { status: 'requires_payment_method', falhou: false }, 31],
    ['3DS left open for over 30 min', { status: 'requires_action', falhou: false }, 31],
  ] as const) {
    it(`${caso}: the intent is canceled at Stripe first, then the use is released and the coupon works`, async () => {
      const { usos, db } = comUmUso({ criado_em: new Date(Date.now() - criadoHaMin * MIN).toISOString() })
      stripe.ler.mockResolvedValue(pi)
      stripe.cancelar.mockImplementation(async () => { expect(usos[0].liberado_em).toBeNull(); return true })
      const r = await validar(db)
      expect(r.ok).toBe(true)
      expect(stripe.ler).toHaveBeenCalledWith('pi_1')
      expect(stripe.cancelar).toHaveBeenCalledWith('pi_1')
      expect(usos[0].liberado_em).not.toBeNull()
    })
  }

  it('already canceled at Stripe: released without a second cancel', async () => {
    const { usos, db } = comUmUso()
    stripe.ler.mockResolvedValue({ status: 'canceled', falhou: false })
    expect((await validar(db)).ok).toBe(true)
    expect(stripe.cancelar).not.toHaveBeenCalled()
    expect(usos[0].liberado_em).not.toBeNull()
  })

  it('a released use lowers the usos_atual cache once', async () => {
    const { db } = comUmUso()
    stripe.ler.mockResolvedValue({ status: 'requires_payment_method', falhou: true })
    await validar(db)
    expect(db.rpcs).toEqual([['liberar_uso_cupom_gratis', { p_cupom_id: 'c1' }]])
  })

  it('per-buyer limit only: the buyer\'s own declined attempt is released', async () => {
    const { usos, db } = comUmUso({}, { cupom: { ...CUPOM, limite_uso_global: null } })
    stripe.ler.mockResolvedValue({ status: 'requires_payment_method', falhou: true })
    expect((await validar(db)).ok).toBe(true)
    expect(usos[0].liberado_em).not.toBeNull()
  })
})

describe('coupon use that keeps counting', () => {
  for (const [caso, pi, criadoHaMin] of [
    ['3DS in progress', { status: 'requires_action', falhou: false }, 2],
    ['intent waiting for the next click (amount warning)', { status: 'requires_payment_method', falhou: false }, 2],
    ['paid, webhook not processed yet', { status: 'succeeded', falhou: false }, 2],
    ['processing', { status: 'processing', falhou: false }, 2],
  ] as const) {
    it(`${caso}: counts, nothing canceled`, async () => {
      const { usos, db } = comUmUso({ criado_em: new Date(Date.now() - criadoHaMin * MIN).toISOString() })
      stripe.ler.mockResolvedValue(pi)
      expect(recusado(await validar(db))).toBe(true)
      expect(stripe.cancelar).not.toHaveBeenCalled()
      expect(usos[0].liberado_em).toBeNull()
    })
  }

  it('Stripe does not answer: counts, as before', async () => {
    const { usos, db } = comUmUso()
    stripe.ler.mockResolvedValue(null)
    expect(recusado(await validar(db))).toBe(true)
    expect(stripe.cancelar).not.toHaveBeenCalled()
    expect(usos[0].liberado_em).toBeNull()
  })

  it('Stripe refuses the cancel: counts, the use stays', async () => {
    const { usos, db } = comUmUso()
    stripe.ler.mockResolvedValue({ status: 'requires_payment_method', falhou: true })
    stripe.cancelar.mockResolvedValue(false)
    expect(recusado(await validar(db))).toBe(true)
    expect(usos[0].liberado_em).toBeNull()
    expect(db.rpcs).toEqual([])
  })

  it('paid order: counts, Stripe is not asked', async () => {
    const { db } = comUmUso({ status: 'entregue' })
    expect(recusado(await validar(db))).toBe(true)
    expect(stripe.ler).not.toHaveBeenCalled()
  })

  it('Pix order waiting for payment, even expired: counts, Stripe is not asked (the order can get a new Pix at the same price)', async () => {
    const { db } = comUmUso({ forma_pagamento: 'pix', stripe_session_id: null, criado_em: new Date(Date.now() - 120 * MIN).toISOString() })
    expect(recusado(await validar(db))).toBe(true)
    expect(stripe.ler).not.toHaveBeenCalled()
  })

  it('card order from the old hosted checkout (session id, not an intent): counts, Stripe is not asked', async () => {
    const { db } = comUmUso({ stripe_session_id: 'cs_1' })
    expect(recusado(await validar(db))).toBe(true)
    expect(stripe.ler).not.toHaveBeenCalled()
  })

  it('migration not applied yet (no liberado_em column): every use counts, as before, and nothing is released', async () => {
    const { usos, db } = comUmUso({}, { semColuna: true })
    stripe.ler.mockResolvedValue({ status: 'requires_payment_method', falhou: true })
    expect(recusado(await validar(db))).toBe(true)
    expect(stripe.ler).not.toHaveBeenCalled()
    expect(usos[0].liberado_em).toBeNull()
  })
})

describe('released uses and the cheap path', () => {
  it('a use released before does not count, and Stripe is not asked', async () => {
    const { db } = comUmUso({}, { uso: { liberado_em: new Date(Date.now() - MIN).toISOString() } })
    expect((await validar(db)).ok).toBe(true)
    expect(stripe.ler).not.toHaveBeenCalled()
  })

  it('under the limit: Stripe is not asked', async () => {
    const usos: Uso[] = [{ id: 'u1', cupom_id: 'c1', email: 'other@example.test', pedido_id: 'p1', liberado_em: null }]
    const pedidos: Pedido[] = [{ id: 'p1', status: 'aguardando_pagamento', forma_pagamento: 'cartao', stripe_session_id: 'pi_1', criado_em: new Date().toISOString() }]
    const db = banco({ usos, pedidos, cupom: { ...CUPOM, limite_uso_global: 5 } })
    expect((await validar(db)).ok).toBe(true)
    expect(stripe.ler).not.toHaveBeenCalled()
  })
})
