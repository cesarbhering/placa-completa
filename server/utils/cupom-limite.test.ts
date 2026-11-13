import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validarCupomComLimite, cupomLimitePlacaEstourado, limitesCupomDoConfig, _zerarCupomLimite, _chavesCupomLimite,
  MSG_CUPOM_LIMITE_PLACA, MSG_CUPOM_LIMITE_GLOBAL, CUPOM_LIMITE_PLACA_HORA_PADRAO, CUPOM_LIMITE_GLOBAL_10MIN_PADRAO,
} from './cupom-limite'
import { validarCupom as validarCupomReal } from './cupons'

// Typed-coupon attempt limits (server/utils/cupom-limite.ts). Fake plates and
// fake coupon codes only.
const T0 = Date.parse('2026-11-13T12:00:00Z')
const PLACA = 'TST1234'          // old format
const PLACA_MERCOSUL = 'TST1C34' // same vehicle, Mercosul
const OUTRA = 'TST9Z99'
const CODIGO = 'FAKECODE00'
const EMAIL = 'buyer@example.test'

let relogio = T0
let chamadas = 0
let resposta: any
const invalido = { ok: false, motivo: 'Cupom nao encontrado.', contaTentativa: true, precoBrutoCentavos: 4490, descontoCentavos: 0, precoLiquidoCentavos: 4490 }
const valido = { ok: true, cupomId: 'c1', precoBrutoCentavos: 4490, descontoCentavos: 449, precoLiquidoCentavos: 4041 }
vi.stubGlobal('validarCupom', async () => { chamadas++; return resposta })

let logs: string[] = []
const opts = { agora: () => relogio, log: (m: string) => { logs.push(m) } }
const tentar = (placa: unknown = PLACA, config: any = {}) =>
  validarCupomComLimite({}, { codigo: CODIGO, plano: 'completa', email: EMAIL, placa }, config, opts)

describe('typed coupon: per-plate limit', () => {
  beforeEach(() => { _zerarCupomLimite(); relogio = T0; chamadas = 0; resposta = invalido; logs = [] })

  it('after 5 invalid validations the plate is blocked without touching the database', async () => {
    for (let i = 0; i < CUPOM_LIMITE_PLACA_HORA_PADRAO; i++) expect((await tentar()).bloqueio).toBeNull()
    expect(chamadas).toBe(5)
    const r = await tentar()
    expect(r.bloqueio).toMatchObject({ statusCode: 429, message: MSG_CUPOM_LIMITE_PLACA, motivo: 'cupom_placa' })
    expect(r.cupom).toMatchObject({ ok: false, descontoCentavos: 0, precoLiquidoCentavos: r.cupom.precoBrutoCentavos })
    expect(r.cupom.precoBrutoCentavos).toBeGreaterThan(0)
    expect(chamadas).toBe(5)
    // Even a valid coupon is refused while blocked.
    resposta = valido
    expect((await tentar()).bloqueio?.motivo).toBe('cupom_placa')
    expect(chamadas).toBe(5)
  })

  it('both plate formats count as the same vehicle', async () => {
    for (let i = 0; i < 3; i++) await tentar(PLACA)
    for (let i = 0; i < 2; i++) await tentar(PLACA_MERCOSUL.toLowerCase())
    expect((await tentar(PLACA)).bloqueio?.motivo).toBe('cupom_placa')
    expect((await tentar('tst-1c34')).bloqueio?.motivo).toBe('cupom_placa')
    expect((await tentar(OUTRA)).bloqueio).toBeNull()
  })

  it('a valid validation does not count', async () => {
    resposta = valido
    for (let i = 0; i < 20; i++) expect((await tentar()).bloqueio).toBeNull()
    expect(chamadas).toBe(20)
  })

  it('refusals that are not guesses (used up, database error) do not count', async () => {
    resposta = { ok: false, motivo: 'Este cupom ja foi utilizado.', precoBrutoCentavos: 4490, descontoCentavos: 0, precoLiquidoCentavos: 4490 }
    for (let i = 0; i < 10; i++) expect((await tentar()).bloqueio).toBeNull()
  })

  it('the block expires 60 min after the failures', async () => {
    for (let i = 0; i < 5; i++) await tentar()
    relogio = T0 + 59 * 60_000
    expect((await tentar()).bloqueio).not.toBeNull()
    relogio = T0 + 60 * 60_000 + 1
    expect((await tentar()).bloqueio).toBeNull()
  })

  it('concurrent invalid validations in the same instant: only 5 reach the database', async () => {
    let soltar!: () => void
    const portao = new Promise<void>((r) => { soltar = r })
    vi.stubGlobal('validarCupom', async () => { chamadas++; await portao; return invalido })
    const rs = Array.from({ length: 10 }, () => tentar())
    soltar()
    const out = await Promise.all(rs)
    vi.stubGlobal('validarCupom', async () => { chamadas++; return resposta })
    expect(chamadas).toBe(5)
    expect(out.filter((r) => r.bloqueio?.motivo === 'cupom_placa')).toHaveLength(5)
  })

  it('a validation that throws releases its pending slot', async () => {
    vi.stubGlobal('validarCupom', async () => { throw new Error('boom') })
    for (let i = 0; i < 10; i++) await expect(tentar()).rejects.toThrow('boom')
    vi.stubGlobal('validarCupom', async () => { chamadas++; return resposta })
    resposta = valido
    expect((await tentar()).bloqueio).toBeNull()
  })

  it('without a plate only the global limit applies', async () => {
    for (let i = 0; i < 10; i++) expect((await tentar(null)).bloqueio).toBeNull()
  })
})

describe('typed coupon: global limit', () => {
  beforeEach(() => { _zerarCupomLimite(); relogio = T0; chamadas = 0; resposta = invalido; logs = [] })
  const placaN = (i: number) => `TST${String(i).padStart(4, '0')}`

  it('arms above 30 invalid in 10 min (any plate) and disarms when the window passes', async () => {
    for (let i = 0; i < CUPOM_LIMITE_GLOBAL_10MIN_PADRAO; i++) expect((await tentar(placaN(i))).bloqueio).toBeNull()
    expect((await tentar(placaN(100))).bloqueio).toBeNull() // 31st invalid recorded
    resposta = valido
    const r = await tentar(placaN(200))
    expect(r.bloqueio).toMatchObject({ statusCode: 429, message: MSG_CUPOM_LIMITE_GLOBAL, motivo: 'cupom_global' })
    relogio = T0 + 10 * 60_000 + 1
    expect((await tentar(placaN(200))).bloqueio).toBeNull()
  })

  /** Arms the global limit with 31 invalid validations on distinct plates. */
  async function armar() {
    resposta = invalido
    for (let i = 0; i <= CUPOM_LIMITE_GLOBAL_10MIN_PADRAO; i++) await tentar(placaN(i))
    chamadas = 0
  }

  it('armed: a personal coupon with the right e-mail passes and does not count', async () => {
    await armar()
    resposta = { ...valido, pessoal: true }
    for (let i = 0; i < 10; i++) expect((await tentar(PLACA)).bloqueio).toBeNull()
    expect(chamadas).toBe(10)
    expect(cupomLimitePlacaEstourado(PLACA, {}, relogio)).toBe(false)
  })

  it('armed: a personal coupon with another e-mail is blocked and counts', async () => {
    await armar()
    resposta = { ...invalido, motivo: 'Este cupom e pessoal e vale so para o e-mail que o recebeu.' }
    for (let i = 0; i < 5; i++) expect((await tentar(PLACA)).bloqueio?.motivo).toBe('cupom_global')
    expect(chamadas).toBe(5)
    // Counted toward the plate too.
    expect((await tentar(PLACA)).bloqueio?.motivo).toBe('cupom_placa')
    expect(chamadas).toBe(5)
  })

  it('armed: system coupons (rebuy, bump, Pix recovery) pass', async () => {
    await armar()
    for (const origem of ['recompra', 'bump', 'pix_recover']) {
      resposta = { ...valido, origem }
      expect((await tentar(PLACA)).bloqueio, origem).toBeNull()
    }
  })

  it('armed: an open campaign coupon gets exactly the answer of an unknown code, and counts', async () => {
    await armar()
    resposta = { ...valido, origem: null }
    const campanha = await tentar(PLACA)
    resposta = invalido
    const inexistente = await tentar(OUTRA)
    expect(campanha).toEqual(inexistente)
    expect(campanha.bloqueio?.motivo).toBe('cupom_global')
    resposta = { ...valido, origem: null }
    for (let i = 0; i < 4; i++) await tentar(PLACA)
    expect(cupomLimitePlacaEstourado(PLACA, {}, relogio)).toBe(true)
  })

  it('armed: a used-up system coupon is refused with the global answer', async () => {
    await armar()
    resposta = { ok: false, motivo: 'Este cupom ja foi utilizado.', precoBrutoCentavos: 4490, descontoCentavos: 0, precoLiquidoCentavos: 4490 }
    expect((await tentar(PLACA)).bloqueio?.motivo).toBe('cupom_global')
  })

  it('per-plate block still refuses everything, our coupons included, without a lookup', async () => {
    for (let i = 0; i < 5; i++) await tentar(PLACA)
    chamadas = 0
    for (const r of [{ ...valido, origem: 'recompra' }, { ...valido, pessoal: true }]) {
      resposta = r
      expect((await tentar(PLACA)).bloqueio?.motivo).toBe('cupom_placa')
    }
    expect(chamadas).toBe(0)
  })
})

describe('typed coupon: env', () => {
  beforeEach(() => { _zerarCupomLimite(); relogio = T0; chamadas = 0; resposta = invalido; logs = [] })

  it('empty or invalid = default, 0 = off, a number = that limit', () => {
    expect(limitesCupomDoConfig({})).toEqual({ placaHora: 5, global10min: 30 })
    expect(limitesCupomDoConfig({ cupomLimitePlacaHora: 'abc', cupomLimiteGlobal10min: '-3' })).toEqual({ placaHora: 5, global10min: 30 })
    expect(limitesCupomDoConfig({ cupomLimitePlacaHora: '0', cupomLimiteGlobal10min: '0' })).toEqual({ placaHora: 0, global10min: 0 })
    expect(limitesCupomDoConfig({ cupomLimitePlacaHora: '2', cupomLimiteGlobal10min: '7' })).toEqual({ placaHora: 2, global10min: 7 })
  })

  it('0 turns both limits off', async () => {
    const off = { cupomLimitePlacaHora: '0', cupomLimiteGlobal10min: '0' }
    for (let i = 0; i < 50; i++) expect((await tentar(PLACA, off)).bloqueio).toBeNull()
    expect(chamadas).toBe(50)
    expect(cupomLimitePlacaEstourado(PLACA, off, relogio)).toBe(false)
  })

  it('a lower env limit blocks earlier', async () => {
    const cfg = { cupomLimitePlacaHora: '2' }
    await tentar(PLACA, cfg); await tentar(PLACA, cfg)
    expect((await tentar(PLACA, cfg)).bloqueio?.motivo).toBe('cupom_placa')
  })
})

describe('typed coupon: log and memory', () => {
  beforeEach(() => { _zerarCupomLimite(); relogio = T0; chamadas = 0; resposta = invalido; logs = [] })

  it('one masked line per block, with no coupon code or e-mail', async () => {
    for (let i = 0; i < 6; i++) await tentar()
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatch(/^\[cupom-limite\] blocked coupon plate=TST\*\*\*\* reason=plate_hour/)
    expect(logs[0]).not.toContain(CODIGO)
    expect(logs[0]).not.toContain(EMAIL)
    expect(logs[0]).not.toContain(PLACA)
  })

  it('memory stays bounded with many plates', async () => {
    const cfg = { cupomLimiteGlobal10min: '0' }
    for (let i = 0; i < 10_500; i++) await tentar(`TST${String(i).padStart(4, '0')}`.slice(0, 7), cfg)
    expect(_chavesCupomLimite()).toBeLessThanOrEqual(10_000)
  })
})

describe('validarCupom marks guesses', () => {
  const sb = (cupom: any, error: any = null) => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: cupom, error }) }) }) }),
  }) as any
  const BASE = { id: 'c1', codigo: CODIGO, tipo: 'percentual', valor: 10, planos: ['completa'], ativo: true, valido_de: null, valido_ate: null, limite_uso_global: null, limite_uso_por_cliente: null, email_restrito: null }

  it('unknown, inactive, expired, other plan and other e-mail count; database error does not', async () => {
    expect((await validarCupomReal(sb(null), CODIGO, 'completa')).contaTentativa).toBe(true)
    expect((await validarCupomReal(sb({ ...BASE, ativo: false }), CODIGO, 'completa')).contaTentativa).toBe(true)
    expect((await validarCupomReal(sb({ ...BASE, valido_ate: '2020-01-01T00:00:00Z' }), CODIGO, 'completa')).contaTentativa).toBe(true)
    expect((await validarCupomReal(sb(BASE), CODIGO, 'basica')).contaTentativa).toBe(true)
    expect((await validarCupomReal(sb({ ...BASE, email_restrito: 'owner@example.test' }), CODIGO, 'completa', EMAIL)).contaTentativa).toBe(true)
    expect((await validarCupomReal(sb(null, { message: 'db down' }), CODIGO, 'completa')).contaTentativa).toBeUndefined()
    const pessoal = await validarCupomReal(sb({ ...BASE, email_restrito: EMAIL }), CODIGO, 'completa', EMAIL.toUpperCase())
    expect(pessoal).toMatchObject({ ok: true, pessoal: true })
    expect((await validarCupomReal(sb({ ...BASE, email_restrito: EMAIL }), CODIGO, 'completa')).pessoal).toBe(false)
    const ok = await validarCupomReal(sb(BASE), CODIGO, 'completa')
    expect(ok.ok).toBe(true)
    expect(ok.contaTentativa).toBeUndefined()
    expect(ok.pessoal).toBe(false)
  })
})
