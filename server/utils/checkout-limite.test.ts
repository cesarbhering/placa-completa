import { describe, it, expect, beforeEach } from 'vitest'
import {
  verificarLimiteCheckout, limitesDoConfig, mascararPlaca, placasDoVeiculo, _zerarEmVoo,
  LIMITE_PLACA_HORA_PADRAO, MSG_LIMITE_PLACA, MSG_LIMITE_CARTAO_PLACA, MSG_DISJUNTOR_CARTAO, TTL_EM_VOO_MS,
  TIMEOUT_CONTAGEM_MS, MARGEM_LIBERACAO_MS,
  type LimitesCheckout,
} from './checkout-limite'

// Per-plate unpaid-order limit, per-plate card limit and the card circuit
// breaker (server/utils/checkout-limite.ts). Fake plates only.
const AGORA = Date.parse('2026-11-13T12:00:00Z')
const PLACA = 'TST1234'        // old format
const PLACA_MERCOSUL = 'TST1C34' // same vehicle, Mercosul
const OUTRA = 'TST9Z99'
const PADRAO: LimitesCheckout = limitesDoConfig({})

type Linha = Record<string, any>
let tabela: Linha[] = []
let falha: 'erro' | 'lento' | 'nunca' | null = null
let relogio = AGORA
/** Appends a null row to the breaker query result (malformed data from the database). */
let linhaNula = false

/** In-memory pedidos_premium with the filters the module uses. */
function fakeSupabase() {
  return {
    from() {
      const filtros: ((l: Linha) => boolean)[] = []
      let lim = Infinity
      let ordem: ((a: Linha, b: Linha) => number) | null = null
      const q: any = {
        select: () => q,
        eq: (c: string, v: any) => { filtros.push((l) => l[c] === v); return q },
        in: (c: string, v: any[]) => { filtros.push((l) => v.includes(l[c])); return q },
        gte: (c: string, v: any) => { filtros.push((l) => String(l[c]) >= String(v)); return q },
        order: (c: string) => { ordem = (a, b) => Number(!!b[c]) - Number(!!a[c]); return q },
        limit: (n: number) => { lim = n; return q },
        then: (ok: any, ko: any) => {
          if (falha === 'erro') return Promise.resolve({ data: null, error: { message: 'db down' } }).then(ok, ko)
          if (falha === 'nunca') return new Promise(() => {}).then(ok, ko)
          let d = tabela.filter((l) => filtros.every((f) => f(l)))
          if (ordem) d = [...d].sort(ordem)
          const res = { data: [...d.slice(0, lim), ...(linhaNula && ordem ? [null] : [])], error: null }
          if (falha === 'lento') return new Promise((r) => setTimeout(() => r(res), 50)).then(ok, ko)
          return Promise.resolve(res).then(ok, ko)
        },
      }
      return q
    },
  }
}

function pedido(o: Partial<Linha> = {}): Linha {
  return {
    placa: PLACA, ambiente: 'producao', forma_pagamento: null, pago_em: null, status: 'aguardando_pagamento',
    criado_em: new Date(AGORA - 5 * 60_000).toISOString(), ...o,
  }
}
const varios = (n: number, o: Partial<Linha> = {}) => Array.from({ length: n }, () => pedido(o))
const logs: string[] = []
async function checar(cartao: boolean, limites = PADRAO, placa = PLACA, timeoutMs?: number) {
  const r = await verificarLimiteCheckout(fakeSupabase(), { placa, ambiente: 'producao', cartao }, limites,
    { agora: () => relogio, log: (m) => logs.push(m), timeoutMs })
  // Simulates the endpoint: the insert happens, the row is in the table, slot released.
  return r
}
const bloqueio = async (...a: Parameters<typeof checar>) => { const r = await checar(...a); r.liberar(); return r.bloqueio }

beforeEach(() => { tabela = []; falha = null; linhaNula = false; logs.length = 0; relogio = AGORA; _zerarEmVoo() })

describe('per-plate unpaid limit (Pix and card)', () => {
  it('below the limit passes', async () => {
    tabela = varios(LIMITE_PLACA_HORA_PADRAO - 1)
    expect(await bloqueio(false)).toBeNull()
  })
  it('at the limit blocks with 429 and the buyer message', async () => {
    tabela = varios(LIMITE_PLACA_HORA_PADRAO)
    expect(await bloqueio(false)).toEqual({ statusCode: 429, message: MSG_LIMITE_PLACA, motivo: 'placa' })
  })
  it('old and Mercosul formats of the same vehicle share the limit', async () => {
    expect(placasDoVeiculo(PLACA).sort()).toEqual([PLACA, PLACA_MERCOSUL].sort())
    tabela = [...varios(3), ...varios(3, { placa: PLACA_MERCOSUL })]
    expect((await bloqueio(false, PADRAO, PLACA))?.motivo).toBe('placa')
    expect((await bloqueio(false, PADRAO, PLACA_MERCOSUL))?.motivo).toBe('placa')
  })
  it('paid orders do not count (pago_em or a paid status)', async () => {
    tabela = [...varios(5), pedido({ pago_em: new Date(AGORA).toISOString(), status: 'entregue' }), pedido({ status: 'consultando' }), pedido({ status: 'reembolsado', pago_em: 'x' })]
    expect(await bloqueio(false)).toBeNull()
  })
  it('orders older than 60 minutes do not count', async () => {
    tabela = [...varios(5), ...varios(10, { criado_em: new Date(AGORA - 61 * 60_000).toISOString() })]
    expect(await bloqueio(false)).toBeNull()
  })
  it('another plate is not affected', async () => {
    tabela = varios(20)
    expect(await bloqueio(false, PADRAO, OUTRA)).toBeNull()
  })
  it('other environment is not counted', async () => {
    tabela = varios(20, { ambiente: 'homolog' })
    expect(await bloqueio(false)).toBeNull()
  })
  it('log masks the plate and has no full plate', async () => {
    tabela = varios(LIMITE_PLACA_HORA_PADRAO)
    await bloqueio(false)
    expect(logs[0]).toMatch(/^\[checkout-limite\] /)
    expect(logs[0]).toContain('TST****')
    expect(logs[0]).not.toContain(PLACA)
  })
})

describe('per-plate card limit', () => {
  it('3 unpaid card orders block the 4th card, Pix still passes', async () => {
    tabela = varios(3, { forma_pagamento: 'cartao' })
    expect(await bloqueio(true)).toEqual({ statusCode: 429, message: MSG_LIMITE_CARTAO_PLACA, motivo: 'cartao_placa' })
    expect(await bloqueio(false)).toBeNull()
  })
  it('2 unpaid card orders pass', async () => {
    tabela = varios(2, { forma_pagamento: 'cartao' })
    expect(await bloqueio(true)).toBeNull()
  })
})

describe('concurrent requests (in-flight orders)', () => {
  it('5 card intents at once for one plate: only the 3 that fit pass', async () => {
    const rs = await Promise.all(Array.from({ length: 5 }, () => checar(true)))
    expect(rs.filter((r) => !r.bloqueio)).toHaveLength(3)
    expect(rs.filter((r) => r.bloqueio?.motivo === 'cartao_placa')).toHaveLength(2)
  })
  it('8 Pix at once for one plate: only 6 pass', async () => {
    const rs = await Promise.all(Array.from({ length: 8 }, () => checar(false)))
    expect(rs.filter((r) => !r.bloqueio)).toHaveLength(6)
  })
  it('release shortens the reservation instead of deleting it (covers counts already in flight)', async () => {
    const r = await checar(true)
    expect(r.bloqueio).toBeNull()
    r.liberar(); r.liberar() // idempotent
    // Right after the insert: a count that started before it does not see the
    // row yet, but the shortened reservation still counts.
    const antes = await Promise.all(Array.from({ length: 3 }, () => checar(true)))
    expect(antes.filter((x) => !x.bloqueio)).toHaveLength(2)
    // Past timeout + margin the reservation is gone; the row in the table counts instead.
    _zerarEmVoo()
    const r2 = await checar(true)
    r2.liberar()
    relogio = AGORA + TIMEOUT_CONTAGEM_MS + MARGEM_LIBERACAO_MS + 1
    tabela = varios(1, { forma_pagamento: 'cartao' })
    const depois = await Promise.all(Array.from({ length: 3 }, () => checar(true)))
    expect(depois.filter((x) => !x.bloqueio)).toHaveLength(2)
  })
  it('a released reservation never outlives its original TTL', async () => {
    const r = await checar(true)
    relogio = AGORA + TTL_EM_VOO_MS - 100
    r.liberar()
    relogio = AGORA + TTL_EM_VOO_MS + 1
    tabela = varios(2, { forma_pagamento: 'cartao' })
    expect((await checar(true)).bloqueio).toBeNull()
  })
  it('a slot never released expires after the safety TTL', async () => {
    await Promise.all(Array.from({ length: 3 }, () => checar(true)))
    expect((await checar(true)).bloqueio?.motivo).toBe('cartao_placa')
    relogio = AGORA + TTL_EM_VOO_MS + 1
    expect((await checar(true)).bloqueio).toBeNull()
  })
  it('in-flight card orders site-wide feed the breaker', async () => {
    tabela = Array.from({ length: 10 }, (_, i) => pedido({ placa: `TST${String(i).padStart(4, '0')}`, forma_pagamento: 'cartao' }))
    const placas = ['AAA1111', 'BBB2222', 'CCC3333', 'DDD4444', 'EEE5555']
    const rs = await Promise.all(placas.map((p) => checar(true, PADRAO, p)))
    // The 1st, 2nd and 3rd see 10, 11 and 12 (not armed, > 12 needed); the
    // 4th and 5th see 13 because the first three are in flight.
    expect(rs.filter((r) => !r.bloqueio)).toHaveLength(3)
    expect(rs.filter((r) => r.bloqueio?.motivo === 'disjuntor_cartao')).toHaveLength(2)
  })
})

describe('card circuit breaker', () => {
  const cartoesOutras = (n: number, o: Partial<Linha> = {}) =>
    Array.from({ length: n }, (_, i) => pedido({ placa: `TST${String(i).padStart(4, '0')}`, forma_pagamento: 'cartao', ...o }))
  it('arms: more than 12 card orders in 10 min, none paid = 503 for the card, Pix unaffected', async () => {
    tabela = cartoesOutras(13)
    expect(await bloqueio(true, PADRAO, OUTRA)).toEqual({ statusCode: 503, message: MSG_DISJUNTOR_CARTAO, motivo: 'disjuntor_cartao' })
    expect(await bloqueio(false, PADRAO, OUTRA)).toBeNull()
  })
  it('does not arm at exactly 12', async () => {
    tabela = cartoesOutras(12)
    expect(await bloqueio(true, PADRAO, OUTRA)).toBeNull()
  })
  it('disarms when one of them is paid', async () => {
    tabela = [...cartoesOutras(13), ...cartoesOutras(1, { pago_em: new Date(AGORA).toISOString(), status: 'entregue' })]
    expect(await bloqueio(true, PADRAO, OUTRA)).toBeNull()
  })
  it('a paid order is never hidden by the row cap (paid rows come first)', async () => {
    tabela = [...cartoesOutras(600), ...cartoesOutras(1, { pago_em: new Date(AGORA).toISOString(), status: 'entregue' })]
    expect(await bloqueio(true, PADRAO, OUTRA)).toBeNull()
  })
  it('disarms when the burst leaves the 10-minute window', async () => {
    tabela = cartoesOutras(13, { criado_em: new Date(AGORA - 11 * 60_000).toISOString() })
    expect(await bloqueio(true, PADRAO, OUTRA)).toBeNull()
  })
})

describe('fail open', () => {
  it('a null row in the breaker result is ignored instead of throwing (no 500)', async () => {
    tabela = Array.from({ length: 13 }, (_, i) => pedido({ placa: `TST${String(i).padStart(4, '0')}`, forma_pagamento: 'cartao' }))
    linhaNula = true
    // Malformed row is ignored; the 13 real unpaid card orders still arm the breaker.
    expect((await bloqueio(true, PADRAO, OUTRA))?.motivo).toBe('disjuntor_cartao')
    tabela = []
    expect(await bloqueio(true, PADRAO, OUTRA)).toBeNull()
  })
  it('database error lets the sale through and logs', async () => {
    tabela = varios(50); falha = 'erro'
    expect(await bloqueio(true)).toBeNull()
    expect(logs[0]).toContain('check failed')
    expect(logs[0]).not.toContain(PLACA)
  })
  it('slow count (over the timeout) lets the sale through', async () => {
    tabela = varios(50); falha = 'lento'
    expect(await bloqueio(false, PADRAO, PLACA, 10)).toBeNull()
    expect(logs[0]).toContain('timeout')
  })
  it('a count that never resolves falls into the timeout and the sale goes on', async () => {
    tabela = varios(50); falha = 'nunca'
    expect(await bloqueio(true, PADRAO, PLACA, 20)).toBeNull()
    expect(logs[0]).toContain('timeout')
  })
})

describe('env limits', () => {
  it('defaults, custom values, 0 = off, invalid / negative / fractional below 1 = default, capped', () => {
    expect(limitesDoConfig({})).toEqual({ placaHora: 6, cartaoPlacaHora: 3, cartaoGlobal10min: 12 })
    expect(limitesDoConfig({ checkoutLimitePlacaHora: '2', checkoutLimiteCartaoPlacaHora: '1', checkoutDisjuntorCartao_10min: '5' }))
      .toEqual({ placaHora: 2, cartaoPlacaHora: 1, cartaoGlobal10min: 5 })
    expect(limitesDoConfig({ checkoutLimitePlacaHora: 'abc' }).placaHora).toBe(6)
    expect(limitesDoConfig({ checkoutDisjuntorCartao_10min: '-1' }).cartaoGlobal10min).toBe(12)
    expect(limitesDoConfig({ checkoutLimitePlacaHora: '0.5' }).placaHora).toBe(6)
    expect(limitesDoConfig({ checkoutLimitePlacaHora: '0' }).placaHora).toBe(0)
    expect(limitesDoConfig({ checkoutLimitePlacaHora: '500', checkoutLimiteCartaoPlacaHora: '500' })).toMatchObject({ placaHora: 99, cartaoPlacaHora: 99 })
    expect(limitesDoConfig({ checkoutDisjuntorCartao_10min: '9999' }).cartaoGlobal10min).toBe(499)
  })
  it('a lower env limit blocks earlier; 0 turns the limit off', async () => {
    tabela = varios(2)
    expect(await bloqueio(false, limitesDoConfig({ checkoutLimitePlacaHora: '2' }))).not.toBeNull()
    tabela = varios(30)
    expect(await bloqueio(false, limitesDoConfig({ checkoutLimitePlacaHora: '0' }))).toBeNull()
  })
})

describe('mascararPlaca', () => {
  it('keeps 3 characters', () => { expect(mascararPlaca(PLACA)).toBe('TST****') })
})
