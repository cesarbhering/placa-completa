import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validarCupom } from './cupons'

// A card attempt that will never be paid stops spending a limited coupon:
// at the limit, validarCupom cancels its PaymentIntent at Stripe and only then
// marks the use released (cupons_premium_usos.liberado_em). One validation may
// make at most 3 Stripe calls (reads and cancels) within 8 s. Stripe and the
// database are fakes; no network.

const stripe = vi.hoisted(() => ({ ler: vi.fn(), cancelar: vi.fn() }))
vi.mock('./stripe', () => ({
  lerPaymentIntent: (id: string, ms: number) => stripe.ler(id, ms),
  cancelarPaymentIntent: (id: string, ms: number) => stripe.cancelar(id, ms),
}))

interface Uso { id: string; cupom_id: string; email: string | null; pedido_id: string; liberado_em: string | null; created_at: string }
interface Pedido { id: string; status: string; forma_pagamento: string; stripe_session_id: string | null; criado_em: string }

const EMAIL = 'buyer@example.test'
const OUTRO = 'other@example.test'
const MIN = 60_000
const haMin = (m: number) => new Date(Date.now() - m * MIN).toISOString()
/** 1 use per coupon and per buyer, like the recovery coupon. */
const CUPOM = {
  id: 'c1', codigo: 'FAKE10', tipo: 'percentual', valor: 10, planos: ['basica', 'completa'], ativo: true,
  valido_de: null, valido_ate: null, limite_uso_global: 1, limite_uso_por_cliente: 1, permite_gratis: false,
  email_restrito: null, origem: null,
}
const RECUSADO = { status: 'requires_payment_method', falhou: true }
const CANCELADO = { status: 'canceled', falhou: false }
const COM_3DS = { status: 'requires_action', falhou: false }

/** SQL LIKE as a regular expression (only % and _ are used here). */
const comoLike = (p: string) => new RegExp('^' + p.split('').map((c) => (c === '%' ? '.*' : c === '_' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('') + '$')

/**
 * In-memory cupons_premium + cupons_premium_usos (+ the pedidos_premium embed)
 * with the query shapes cupons.ts uses: filters, like, order and limit are
 * honored. semColuna = migration not applied yet. varreduras = scans for card
 * attempts (row queries on the uses table).
 */
function banco(o: { cupom?: any; usos: Uso[]; pedidos: Pedido[]; semColuna?: boolean }) {
  const db: any = { rpcs: [] as [string, any][], varreduras: 0 }
  db.from = (tabela: string) => {
    const filtros: [string, string, any][] = []
    let modo: 'linhas' | 'count' | 'update' = 'linhas'
    let patch: any = null
    let semColuna = false
    let ordem: { col: string; asc: boolean } | null = null
    let limite = Infinity
    const pedidoDe = (u: Uso) => o.pedidos.find((p) => p.id === u.pedido_id)!
    const valor = (u: Uso, c: string) => (c.startsWith('pedidos_premium.') ? (pedidoDe(u) as any)[c.slice('pedidos_premium.'.length)] : (u as any)[c])
    const passa = (u: Uso) => filtros.every(([op, c, v]) => (op === 'like' ? comoLike(v).test(String(valor(u, c) ?? '\u0000')) : valor(u, c) === v))
    const resolver = () => {
      if (tabela === 'cupons_premium') return { data: o.cupom ?? CUPOM, error: null }
      if (semColuna) return { data: null, count: null, error: { message: 'column cupons_premium_usos.liberado_em does not exist' } }
      let linhas = o.usos.filter(passa)
      if (modo === 'count') return { count: linhas.length, error: null }
      if (modo === 'update') {
        linhas.forEach((u) => Object.assign(u, patch))
        return { data: linhas.map((u) => ({ id: u.id })), error: null }
      }
      db.varreduras++
      if (ordem) {
        const { col, asc } = ordem
        linhas = [...linhas].sort((a: any, b: any) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1))
      }
      return { data: linhas.slice(0, limite).map((u) => ({ id: u.id, pedidos_premium: pedidoDe(u) })), error: null }
    }
    const q: any = {
      select: (_c: string, opts?: any) => { if (modo !== 'update') modo = opts?.head ? 'count' : 'linhas'; return q },
      update: (p: any) => { modo = 'update'; patch = p; return q },
      eq: (c: string, v: any) => { filtros.push(['eq', c, v]); return q },
      is: (c: string, v: any) => { if (o.semColuna && c === 'liberado_em') semColuna = true; filtros.push(['eq', c, v]); return q },
      like: (c: string, p: string) => { filtros.push(['like', c, p]); return q },
      order: (c: string, opts?: any) => { ordem = { col: c, asc: opts?.ascending !== false }; return q },
      limit: (n: number) => { limite = n; return q },
      maybeSingle: async () => resolver(),
      then: (ok: any, ko: any) => Promise.resolve(resolver()).then(ok, ko),
    }
    return q
  }
  db.rpc = async (nome: string, args: any) => { db.rpcs.push([nome, args]); return { data: null, error: null } }
  return db
}

interface Linha { email?: string | null; liberado_em?: string | null; criadoHaMin?: number; pedido?: Partial<Pedido> }
/**
 * Uses of the coupon, one order each: by default a card order of EMAIL waiting
 * for payment, with intent pi_<n>, created 2 min ago (row n is n seconds newer
 * than row n-1, so "newest first" is the last row).
 */
function montar(linhas: Linha[], extra: { cupom?: any; semColuna?: boolean } = {}) {
  const usos: Uso[] = []
  const pedidos: Pedido[] = []
  linhas.forEach((l, i) => {
    const n = i + 1
    const criado = new Date(Date.now() - (l.criadoHaMin ?? 2) * MIN + n * 1000).toISOString()
    pedidos.push({ id: `p${n}`, status: 'aguardando_pagamento', forma_pagamento: 'cartao', stripe_session_id: `pi_${n}`, criado_em: criado, ...l.pedido })
    usos.push({ id: `u${n}`, cupom_id: 'c1', email: l.email === undefined ? EMAIL : l.email, pedido_id: `p${n}`, liberado_em: l.liberado_em ?? null, created_at: criado })
  })
  return { usos, db: banco({ usos, pedidos, ...extra }) }
}
const comUmUso = (l: Linha = {}, extra: { cupom?: any; semColuna?: boolean } = {}) => montar([l], extra)
const validar = (db: any) => validarCupom(db, 'FAKE10', 'completa', EMAIL)
const recusado = (r: any) => !r.ok && /ja foi utilizado|esgotado/i.test(String(r.motivo))
/** Stripe calls this validation made (reads and cancels). */
const consultasStripe = () => stripe.ler.mock.calls.length + stripe.cancelar.mock.calls.length

beforeEach(() => {
  stripe.ler.mockReset()
  stripe.cancelar.mockReset().mockResolvedValue(true)
})
afterEach(() => { vi.useRealTimers() })

describe('coupon use of a card attempt that will never be paid', () => {
  for (const [caso, pi, criadoHaMin] of [
    ['declined (or 3DS failed)', RECUSADO, 2],
    ['opened over 30 min ago and never charged', { status: 'requires_payment_method', falhou: false }, 31],
    ['3DS left open for over 30 min', COM_3DS, 31],
    ['confirmation left over 30 min', { status: 'requires_confirmation', falhou: false }, 31],
  ] as const) {
    it(`${caso}: the intent is canceled at Stripe first, then the use is released and the coupon works`, async () => {
      const { usos, db } = comUmUso({ criadoHaMin })
      stripe.ler.mockResolvedValue(pi)
      stripe.cancelar.mockImplementation(async () => { expect(usos[0].liberado_em).toBeNull(); return true })
      const r = await validar(db)
      expect(r.ok).toBe(true)
      expect(stripe.ler.mock.calls[0][0]).toBe('pi_1')
      expect(stripe.cancelar.mock.calls[0][0]).toBe('pi_1')
      expect(usos[0].liberado_em).not.toBeNull()
    })
  }

  it('already canceled at Stripe: released without a second cancel', async () => {
    const { usos, db } = comUmUso()
    stripe.ler.mockResolvedValue(CANCELADO)
    expect((await validar(db)).ok).toBe(true)
    expect(stripe.cancelar).not.toHaveBeenCalled()
    expect(usos[0].liberado_em).not.toBeNull()
  })

  it('a released use lowers the usos_atual cache once', async () => {
    const { db } = comUmUso()
    stripe.ler.mockResolvedValue(RECUSADO)
    await validar(db)
    expect(db.rpcs).toEqual([['liberar_uso_cupom_gratis', { p_cupom_id: 'c1' }]])
  })

  it('per-buyer limit only: the buyer\'s own declined attempt is released', async () => {
    const { usos, db } = comUmUso({}, { cupom: { ...CUPOM, limite_uso_global: null } })
    stripe.ler.mockResolvedValue(RECUSADO)
    expect((await validar(db)).ok).toBe(true)
    expect(usos[0].liberado_em).not.toBeNull()
  })

  it('releases only as many uses as the limit needs', async () => {
    const { usos, db } = montar([{ email: OUTRO }, { email: OUTRO }], { cupom: { ...CUPOM, limite_uso_global: 2 } })
    stripe.ler.mockResolvedValue(CANCELADO)
    expect((await validar(db)).ok).toBe(true)
    expect(usos.filter((u) => u.liberado_em)).toHaveLength(1)
  })
})

describe('coupon use that keeps counting', () => {
  for (const [caso, pi, criadoHaMin] of [
    ['3DS in progress', COM_3DS, 2],
    ['intent waiting for the next click (amount warning)', { status: 'requires_payment_method', falhou: false }, 2],
    ['paid, webhook not processed yet', { status: 'succeeded', falhou: false }, 2],
    ['paid over 30 min ago, webhook not processed yet', { status: 'succeeded', falhou: false }, 31],
    ['processing', { status: 'processing', falhou: false }, 2],
    ['processing for over 30 min', { status: 'processing', falhou: false }, 31],
  ] as const) {
    it(`${caso}: counts, nothing canceled`, async () => {
      const { usos, db } = comUmUso({ criadoHaMin })
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
    stripe.ler.mockResolvedValue(RECUSADO)
    stripe.cancelar.mockResolvedValue(false)
    expect(recusado(await validar(db))).toBe(true)
    expect(usos[0].liberado_em).toBeNull()
    expect(db.rpcs).toEqual([])
  })

  it('paid order: counts, Stripe is not asked', async () => {
    const { db } = comUmUso({ pedido: { status: 'entregue' } })
    expect(recusado(await validar(db))).toBe(true)
    expect(stripe.ler).not.toHaveBeenCalled()
  })

  it('Pix order waiting for payment, even expired: counts, Stripe is not asked (the order can get a new Pix at the same price)', async () => {
    const { db } = comUmUso({ criadoHaMin: 120, pedido: { forma_pagamento: 'pix', stripe_session_id: null } })
    expect(recusado(await validar(db))).toBe(true)
    expect(stripe.ler).not.toHaveBeenCalled()
  })

  it('card order from the old hosted checkout (session id, not an intent): counts, Stripe is not asked', async () => {
    const { db } = comUmUso({ pedido: { stripe_session_id: 'cs_1' } })
    expect(recusado(await validar(db))).toBe(true)
    expect(stripe.ler).not.toHaveBeenCalled()
  })

  it('migration not applied yet (no liberado_em column): every use counts, as before, and nothing is released', async () => {
    const { usos, db } = comUmUso({}, { semColuna: true })
    stripe.ler.mockResolvedValue(RECUSADO)
    expect(recusado(await validar(db))).toBe(true)
    expect(stripe.ler).not.toHaveBeenCalled()
    expect(usos[0].liberado_em).toBeNull()
  })
})

describe('locks against releasing one use twice', () => {
  it('two validations releasing the same use at the same time: only one passes and the cache goes down once', async () => {
    const { usos, db } = comUmUso()
    stripe.ler.mockResolvedValue(RECUSADO)
    let soltar!: () => void
    const portao = new Promise<void>((r) => { soltar = r })
    stripe.cancelar.mockImplementation(async () => { await portao; return true })
    const a = validar(db)
    const b = validar(db)
    await vi.waitFor(() => expect(stripe.cancelar).toHaveBeenCalledTimes(2))
    soltar()
    const resultados = await Promise.all([a, b])
    expect(resultados.filter((r) => r.ok)).toHaveLength(1)
    expect(resultados.filter(recusado)).toHaveLength(1)
    expect(db.rpcs).toHaveLength(1)
    expect(usos[0].liberado_em).not.toBeNull()
  })

  it('per-buyer scan looks only at the buyer\'s own uses: another buyer\'s declined attempt does not let this buyer through', async () => {
    const { usos, db } = montar([
      { email: EMAIL, pedido: { status: 'entregue' } },
      { email: OUTRO },
    ], { cupom: { ...CUPOM, limite_uso_global: null } })
    stripe.ler.mockResolvedValue(RECUSADO)
    expect(recusado(await validar(db))).toBe(true)
    expect(stripe.ler).not.toHaveBeenCalled()
    expect(usos[1].liberado_em).toBeNull()
  })

  it('a released use is not looked at again', async () => {
    const { db } = montar([
      { email: OUTRO, liberado_em: haMin(1) },
      { email: OUTRO, pedido: { status: 'entregue' } },
    ])
    stripe.ler.mockResolvedValue(RECUSADO)
    expect(recusado(await validar(db))).toBe(true)
    expect(stripe.ler).not.toHaveBeenCalled()
  })
})

describe('one Stripe budget per validation', () => {
  it('at most 3 Stripe calls (reads and cancels) across both limits', async () => {
    // Global limit 4, per-buyer limit 3: other buyers hold 3 declined attempts
    // and this buyer 3 attempts with 3DS open.
    const { db } = montar([
      { email: OUTRO }, { email: OUTRO }, { email: OUTRO },
      { email: EMAIL }, { email: EMAIL }, { email: EMAIL },
    ], { cupom: { ...CUPOM, limite_uso_global: 4, limite_uso_por_cliente: 3 } })
    stripe.ler.mockImplementation(async (id: string) => (Number(id.slice(3)) <= 3 ? RECUSADO : COM_3DS))
    await validar(db)
    expect(consultasStripe()).toBeLessThanOrEqual(3)
  })

  it('6 declined attempts, 2 to release: read, cancel, read, and the budget is spent', async () => {
    const { usos, db } = montar(Array.from({ length: 6 }, () => ({ email: OUTRO })), { cupom: { ...CUPOM, limite_uso_global: 5 } })
    stripe.ler.mockResolvedValue(RECUSADO)
    expect(recusado(await validar(db))).toBe(true)
    expect(stripe.ler).toHaveBeenCalledTimes(2)
    expect(stripe.cancelar).toHaveBeenCalledTimes(1)
    expect(usos.filter((u) => u.liberado_em)).toHaveLength(1)
  })

  it('a PaymentIntent already read in this validation is not read again', async () => {
    // Global limit 2, per-buyer limit 1. The global check reads the buyer's own
    // attempt (3DS open, alive) and releases another buyer's canceled one; the
    // per-buyer check then meets the same attempt and uses what it read.
    const { db } = montar([{ email: OUTRO }, { email: EMAIL }], { cupom: { ...CUPOM, limite_uso_global: 2, limite_uso_por_cliente: 1 } })
    stripe.ler.mockImplementation(async (id: string) => (id === 'pi_1' ? CANCELADO : COM_3DS))
    expect(recusado(await validar(db))).toBe(true)
    expect(stripe.ler.mock.calls.filter(([id]) => id === 'pi_2')).toHaveLength(1)
  })

  it('stops at the 8 s deadline: the use keeps counting', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { usos, db } = comUmUso()
    stripe.ler.mockImplementation(async () => { vi.setSystemTime(Date.now() + 9000); return RECUSADO })
    expect(recusado(await validar(db))).toBe(true)
    expect(stripe.cancelar).not.toHaveBeenCalled()
    expect(usos[0].liberado_em).toBeNull()
  })

  it('each Stripe call gets at most 4 s and never more than what is left of the 8 s', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { db } = comUmUso()
    stripe.ler.mockImplementation(async () => { vi.setSystemTime(Date.now() + 6500); return RECUSADO })
    await validar(db)
    const [[, msLer]] = stripe.ler.mock.calls
    const [[, msCancelar]] = stripe.cancelar.mock.calls
    expect(msLer).toBeGreaterThan(0)
    expect(msLer).toBeLessThanOrEqual(4000)
    expect(msCancelar).toBeGreaterThan(0)
    expect(msCancelar).toBeLessThanOrEqual(1500)
  })
})

describe('scan for card attempts', () => {
  it('orders without an intent do not fill the window and hide a declined attempt', async () => {
    // Three newer card orders without an intent (the intent was never created).
    const { usos, db } = montar([
      { email: OUTRO },
      { email: OUTRO, pedido: { stripe_session_id: null } },
      { email: OUTRO, pedido: { stripe_session_id: null } },
      { email: OUTRO, pedido: { stripe_session_id: null } },
    ], { cupom: { ...CUPOM, limite_uso_global: 4 } })
    stripe.ler.mockResolvedValue(RECUSADO)
    expect((await validar(db)).ok).toBe(true)
    expect(usos[0].liberado_em).not.toBeNull()
  })

  it('newest first: older attempts that stay alive do not use up the budget before a fresh decline', async () => {
    const { usos, db } = montar([
      { email: OUTRO }, { email: OUTRO }, { email: OUTRO },
      { email: OUTRO },
    ], { cupom: { ...CUPOM, limite_uso_global: 4 } })
    stripe.ler.mockImplementation(async (id: string) => (id === 'pi_4' ? RECUSADO : { status: 'processing', falhou: false }))
    expect((await validar(db)).ok).toBe(true)
    expect(usos[3].liberado_em).not.toBeNull()
  })

  it('under the limit: no scan and no Stripe call', async () => {
    const { db } = montar([{ email: OUTRO }], { cupom: { ...CUPOM, limite_uso_global: 5 } })
    expect((await validar(db)).ok).toBe(true)
    expect(db.varreduras).toBe(0)
    expect(stripe.ler).not.toHaveBeenCalled()
  })
})
