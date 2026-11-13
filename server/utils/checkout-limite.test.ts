import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  verificarLimiteCheckout, limitesDoConfig, mascararPlaca,
  LIMITE_PLACA_HORA_PADRAO, MSG_LIMITE_PLACA, MSG_LIMITE_CARTAO_PLACA, MSG_DISJUNTOR_CARTAO, type LimitesCheckout,
} from './checkout-limite'

// Per-plate unpaid-order limit, per-plate card limit and the card circuit
// breaker (server/utils/checkout-limite.ts). Fake plates only.
const AGORA = Date.parse('2026-11-13T12:00:00Z')
const PLACA = 'TST1A23'
const OUTRA = 'TST9Z99'
const PADRAO: LimitesCheckout = limitesDoConfig({})

type Linha = Record<string, any>
let tabela: Linha[] = []
let falha: 'erro' | 'lento' | null = null

/** In-memory pedidos_premium with the filters the module uses. */
function fakeSupabase() {
  return {
    from() {
      const filtros: ((l: Linha) => boolean)[] = []
      let lim = Infinity
      const q: any = {
        select: () => q,
        eq: (c: string, v: any) => { filtros.push((l) => l[c] === v); return q },
        gte: (c: string, v: any) => { filtros.push((l) => String(l[c]) >= String(v)); return q },
        limit: (n: number) => { lim = n; return q },
        then: (ok: any, ko: any) => {
          if (falha === 'erro') return Promise.resolve({ data: null, error: { message: 'db down' } }).then(ok, ko)
          const res = { data: tabela.filter((l) => filtros.every((f) => f(l))).slice(0, lim), error: null }
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
const checar = (cartao: boolean, limites = PADRAO, placa = PLACA, timeoutMs?: number) =>
  verificarLimiteCheckout(fakeSupabase(), { placa, ambiente: 'producao', cartao }, limites, { agora: AGORA, log: (m) => logs.push(m), timeoutMs })

beforeEach(() => { tabela = []; falha = null; logs.length = 0 })

describe('per-plate unpaid limit (Pix and card)', () => {
  it('below the limit passes', async () => {
    tabela = varios(LIMITE_PLACA_HORA_PADRAO - 1)
    expect(await checar(false)).toBeNull()
  })
  it('at the limit blocks with 429 and the buyer message', async () => {
    tabela = varios(LIMITE_PLACA_HORA_PADRAO)
    expect(await checar(false)).toEqual({ statusCode: 429, message: MSG_LIMITE_PLACA, motivo: 'placa' })
  })
  it('paid orders do not count (pago_em or a paid status)', async () => {
    tabela = [...varios(5), pedido({ pago_em: new Date(AGORA).toISOString(), status: 'entregue' }), pedido({ status: 'consultando' }), pedido({ status: 'reembolsado', pago_em: 'x' })]
    expect(await checar(false)).toBeNull()
  })
  it('orders older than 60 minutes do not count', async () => {
    tabela = [...varios(5), ...varios(10, { criado_em: new Date(AGORA - 61 * 60_000).toISOString() })]
    expect(await checar(false)).toBeNull()
  })
  it('another plate is not affected', async () => {
    tabela = varios(20)
    expect(await checar(false, PADRAO, OUTRA)).toBeNull()
  })
  it('other environment is not counted', async () => {
    tabela = varios(20, { ambiente: 'homolog' })
    expect(await checar(false)).toBeNull()
  })
  it('log masks the plate and has no full plate', async () => {
    tabela = varios(LIMITE_PLACA_HORA_PADRAO)
    await checar(false)
    expect(logs[0]).toMatch(/^\[checkout-limite\] /)
    expect(logs[0]).toContain('TST****')
    expect(logs[0]).not.toContain(PLACA)
  })
})

describe('per-plate card limit', () => {
  it('3 unpaid card orders block the 4th card, Pix still passes', async () => {
    tabela = varios(3, { forma_pagamento: 'cartao' })
    expect(await checar(true)).toEqual({ statusCode: 429, message: MSG_LIMITE_CARTAO_PLACA, motivo: 'cartao_placa' })
    expect(await checar(false)).toBeNull()
  })
  it('2 unpaid card orders pass', async () => {
    tabela = varios(2, { forma_pagamento: 'cartao' })
    expect(await checar(true)).toBeNull()
  })
})

describe('card circuit breaker', () => {
  const cartoesOutras = (n: number, o: Partial<Linha> = {}) =>
    Array.from({ length: n }, (_, i) => pedido({ placa: `TST${String(i).padStart(4, '0')}`, forma_pagamento: 'cartao', ...o }))
  it('arms: more than 12 card orders in 10 min, none paid = 503 for the card, Pix unaffected', async () => {
    tabela = cartoesOutras(13)
    expect(await checar(true, PADRAO, OUTRA)).toEqual({ statusCode: 503, message: MSG_DISJUNTOR_CARTAO, motivo: 'disjuntor_cartao' })
    expect(await checar(false, PADRAO, OUTRA)).toBeNull()
  })
  it('does not arm at exactly 12', async () => {
    tabela = cartoesOutras(12)
    expect(await checar(true, PADRAO, OUTRA)).toBeNull()
  })
  it('disarms when one of them is paid', async () => {
    tabela = [...cartoesOutras(13), ...cartoesOutras(1, { pago_em: new Date(AGORA).toISOString(), status: 'entregue' })]
    expect(await checar(true, PADRAO, OUTRA)).toBeNull()
  })
  it('disarms when the burst leaves the 10-minute window', async () => {
    tabela = cartoesOutras(13, { criado_em: new Date(AGORA - 11 * 60_000).toISOString() })
    expect(await checar(true, PADRAO, OUTRA)).toBeNull()
  })
})

describe('fail open', () => {
  it('database error lets the sale through and logs', async () => {
    tabela = varios(50); falha = 'erro'
    expect(await checar(true)).toBeNull()
    expect(logs[0]).toContain('check failed')
    expect(logs[0]).not.toContain(PLACA)
  })
  it('slow count (over the timeout) lets the sale through', async () => {
    tabela = varios(50); falha = 'lento'
    expect(await checar(false, PADRAO, PLACA, 10)).toBeNull()
    expect(logs[0]).toContain('timeout')
  })
})

describe('env limits', () => {
  it('defaults, custom values, 0 = off, invalid = default', () => {
    expect(limitesDoConfig({})).toEqual({ placaHora: 6, cartaoPlacaHora: 3, cartaoGlobal10min: 12 })
    expect(limitesDoConfig({ checkoutLimitePlacaHora: '2', checkoutLimiteCartaoPlacaHora: '1', checkoutDisjuntorCartao10min: '5' }))
      .toEqual({ placaHora: 2, cartaoPlacaHora: 1, cartaoGlobal10min: 5 })
    expect(limitesDoConfig({ checkoutLimitePlacaHora: 'abc', checkoutDisjuntorCartao10min: '-1' }).placaHora).toBe(6)
    expect(limitesDoConfig({ checkoutDisjuntorCartao10min: '-1' }).cartaoGlobal10min).toBe(12)
    expect(limitesDoConfig({ checkoutLimitePlacaHora: '0' }).placaHora).toBe(0)
  })
  it('a lower env limit blocks earlier; 0 turns the limit off', async () => {
    tabela = varios(2)
    expect(await checar(false, limitesDoConfig({ checkoutLimitePlacaHora: '2' }))).not.toBeNull()
    tabela = varios(30)
    expect(await checar(false, limitesDoConfig({ checkoutLimitePlacaHora: '0' }))).toBeNull()
  })
})

describe('mascararPlaca', () => {
  it('keeps 3 characters', () => { expect(mascararPlaca(PLACA)).toBe('TST****') })
})
