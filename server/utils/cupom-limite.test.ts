import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validarCupomComLimite, cupomDispensaEmailComLimite, limitesCupomDoConfig, _zerarCupomLimite, _tamanhoCupomLimite,
  MSG_CUPOM_LIMITE_PLACA, MSG_CUPOM_LIMITE_GLOBAL, CUPOM_LIMITE_PLACA_HORA_PADRAO, CUPOM_LIMITE_GLOBAL_10MIN_PADRAO,
} from './cupom-limite'
import { validarCupom as validarCupomReal } from './cupons'

// Typed-coupon attempt limits (server/utils/cupom-limite.ts). Fake plates and
// fake coupon codes only.
const T0 = Date.parse('2026-11-13T12:00:00Z')
const PLACA = 'TST1234'          // old format
const PLACA_MERCOSUL = 'TST1C34' // same vehicle, Mercosul
const OUTRA = 'TST9Z99'
const EMAIL = 'buyer@example.test'

let relogio = T0
let chamadas = 0
let resposta: any
let seq = 0
const novoCodigo = () => `FAKE${String(++seq).padStart(6, '0')}`
const invalido = { ok: false, motivo: 'Cupom nao encontrado.', contaTentativa: true, precoBrutoCentavos: 4490, descontoCentavos: 0, precoLiquidoCentavos: 4490 }
const valido = { ok: true, cupomId: 'c1', precoBrutoCentavos: 4490, descontoCentavos: 449, precoLiquidoCentavos: 4041 }
const stubPadrao = async () => { chamadas++; return resposta }
vi.stubGlobal('validarCupom', stubPadrao)

let logs: string[] = []
const opts = { agora: () => relogio, log: (m: string) => { logs.push(m) } }
/** One validation; a new code each time unless one is given. */
const tentar = (placa: unknown = PLACA, config: any = {}, codigo: string = novoCodigo()) =>
  validarCupomComLimite({}, { codigo, plano: 'completa', email: EMAIL, placa }, config, opts)
const placaN = (i: number) => `T${String(i).padStart(6, '0')}`.replace(/^T(\d{2})/, (_m, d) => `T${String.fromCharCode(65 + Number(d[0]))}${String.fromCharCode(65 + Number(d[1]))}`)

function reset() {
  _zerarCupomLimite(); relogio = T0; chamadas = 0; resposta = invalido; logs = []
  vi.stubGlobal('validarCupom', stubPadrao)
}

describe('typed coupon: per-plate limit', () => {
  beforeEach(reset)

  it('after 5 invalid codes the plate is blocked without touching the database', async () => {
    for (let i = 0; i < CUPOM_LIMITE_PLACA_HORA_PADRAO; i++) expect((await tentar()).bloqueio).toBeNull()
    expect(chamadas).toBe(5)
    const r = await tentar()
    expect(r.bloqueio).toMatchObject({ statusCode: 429, message: MSG_CUPOM_LIMITE_PLACA, motivo: 'cupom_placa' })
    expect(r.cupom).toMatchObject({ ok: false, descontoCentavos: 0, precoLiquidoCentavos: r.cupom.precoBrutoCentavos })
    expect(r.cupom.precoBrutoCentavos).toBeGreaterThan(0)
    expect(chamadas).toBe(5)
    // Everything is refused while blocked, our own coupons included.
    for (const v of [valido, { ...valido, origem: 'recompra' }, { ...valido, pessoal: true }]) {
      resposta = v
      expect((await tentar()).bloqueio?.motivo).toBe('cupom_placa')
    }
    expect(chamadas).toBe(5)
  })

  it('the same invalid code 10 times on a plate counts once', async () => {
    for (let i = 0; i < 10; i++) expect((await tentar(PLACA, {}, 'FAKESAME01')).bloqueio).toBeNull()
    expect(chamadas).toBe(10)
    for (let i = 0; i < 3; i++) await tentar(PLACA)
    expect((await tentar(PLACA)).bloqueio).toBeNull() // 1 + 3 = 4 counted, 5th still allowed
    expect((await tentar(PLACA)).bloqueio?.motivo).toBe('cupom_placa')
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
    expect(chamadas).toBe(5)
    expect(out.filter((r) => r.bloqueio?.motivo === 'cupom_placa')).toHaveLength(5)
  })

  it('a refusal caused only by in-flight validations is not recorded (plate)', async () => {
    for (let i = 0; i < 4; i++) await tentar()
    let soltar!: () => void
    const portao = new Promise<void>((r) => { soltar = r })
    vi.stubGlobal('validarCupom', async () => { chamadas++; await portao; return valido })
    const a = tentar(); const b = tentar()
    soltar()
    const [ra, rb] = await Promise.all([a, b])
    expect(ra.bloqueio).toBeNull()
    expect(rb.bloqueio?.motivo).toBe('cupom_placa')
    vi.stubGlobal('validarCupom', stubPadrao)
    resposta = valido
    expect((await tentar()).bloqueio).toBeNull() // still 4 counted
  })

  it('a validation that throws releases its pending slot', async () => {
    vi.stubGlobal('validarCupom', async () => { throw new Error('boom') })
    for (let i = 0; i < 10; i++) await expect(tentar()).rejects.toThrow('boom')
    vi.stubGlobal('validarCupom', stubPadrao)
    resposta = valido
    expect((await tentar()).bloqueio).toBeNull()
  })

  it('attempts without a valid plate share one bucket with the per-plate limit', async () => {
    for (const p of [null, '', 'AB', 'TOOLONG99']) expect((await tentar(p)).bloqueio).toBeNull()
    expect((await tentar('X1')).bloqueio).toBeNull()
    expect((await tentar(null)).bloqueio?.motivo).toBe('cupom_placa')
    expect((await tentar('Z')).bloqueio?.motivo).toBe('cupom_placa')
    expect(logs.at(-1)).toContain('plate=- reason=plate_hour')
    expect((await tentar(PLACA)).bloqueio).toBeNull() // a real plate is not in that bucket
  })

  it('a personal coupon tried with many e-mails counts once per e-mail', async () => {
    resposta = { ...invalido, motivo: 'Este cupom e pessoal e vale so para o e-mail que o recebeu.', outroEmail: true }
    const um = (email: string) => validarCupomComLimite({}, { codigo: 'FAKEPERSONAL', plano: 'completa', email, placa: PLACA }, {}, opts)
    for (let i = 0; i < 5; i++) expect((await um(`guess${i}@example.test`)).bloqueio).toBeNull()
    expect((await um('guess99@example.test')).bloqueio?.motivo).toBe('cupom_placa')
    expect(chamadas).toBe(5)
    // The same e-mail repeated still counts once.
    reset()
    resposta = { ...invalido, outroEmail: true }
    for (let i = 0; i < 10; i++) expect((await um('same@example.test')).bloqueio).toBeNull()
    for (const l of logs) expect(l).not.toContain('example.test')
  })
})

describe('typed coupon: global limit', () => {
  beforeEach(reset)

  /** Arms the global limit with 31 invalid codes on distinct plates. */
  async function armar() {
    resposta = invalido
    for (let i = 0; i <= CUPOM_LIMITE_GLOBAL_10MIN_PADRAO; i++) await tentar(placaN(i))
    chamadas = 0
  }

  it('arms above 30 invalid in 10 min (any plate) and disarms when the window passes', async () => {
    for (let i = 0; i < CUPOM_LIMITE_GLOBAL_10MIN_PADRAO; i++) expect((await tentar(placaN(i))).bloqueio).toBeNull()
    expect((await tentar(placaN(100))).bloqueio).toBeNull() // 31st invalid recorded
    resposta = valido
    const r = await tentar(placaN(200))
    expect(r.bloqueio).toMatchObject({ statusCode: 429, message: MSG_CUPOM_LIMITE_GLOBAL, motivo: 'cupom_global' })
    relogio = T0 + 10 * 60_000 + 1
    expect((await tentar(placaN(200))).bloqueio).toBeNull()
  })

  it('the same code repeated on the same plate counts once site-wide', async () => {
    for (let i = 0; i < 100; i++) await tentar(placaN(i % 20), {}, `FAKEREP${i % 20}`)
    resposta = valido
    expect((await tentar(OUTRA)).bloqueio).toBeNull() // only 20 pairs counted
  })

  it('armed: a personal coupon with the right e-mail passes and does not count', async () => {
    await armar()
    resposta = { ...valido, pessoal: true }
    for (let i = 0; i < 10; i++) expect((await tentar(PLACA)).bloqueio).toBeNull()
    expect(chamadas).toBe(10)
    resposta = valido
    relogio = T0 + 10 * 60_000 + 1 // global window gone, plate window still on
    expect((await tentar(PLACA)).bloqueio).toBeNull()
  })

  it('armed: a personal coupon not yet matched to an e-mail passes and does not count', async () => {
    await armar()
    resposta = { ...valido, exigeEmail: true }
    for (let i = 0; i < 10; i++) expect((await tentar(PLACA)).bloqueio).toBeNull()
  })

  it('armed: a personal coupon with another e-mail is blocked and counts', async () => {
    await armar()
    resposta = { ...invalido, motivo: 'Este cupom e pessoal e vale so para o e-mail que o recebeu.' }
    for (let i = 0; i < 5; i++) expect((await tentar(PLACA)).bloqueio?.motivo).toBe('cupom_global')
    expect(chamadas).toBe(5)
    expect((await tentar(PLACA)).bloqueio?.motivo).toBe('cupom_placa') // counted toward the plate too
    expect(chamadas).toBe(5)
  })

  it('armed: system coupons (rebuy, bump, Pix recovery, free recovery) pass', async () => {
    await armar()
    for (const origem of ['recompra', 'bump', 'pix_recover', 'gratis_recover']) {
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
    expect((await tentar(PLACA)).bloqueio?.motivo).toBe('cupom_placa')
  })

  it('armed: a used-up system coupon is refused with the global answer', async () => {
    await armar()
    resposta = { ok: false, motivo: 'Este cupom ja foi utilizado.', precoBrutoCentavos: 4490, descontoCentavos: 0, precoLiquidoCentavos: 4490 }
    expect((await tentar(PLACA)).bloqueio?.motivo).toBe('cupom_global')
  })

  it('a refusal caused only by in-flight validations is not recorded (global)', async () => {
    for (let i = 0; i < CUPOM_LIMITE_GLOBAL_10MIN_PADRAO; i++) await tentar(placaN(i)) // exactly 30
    let soltar!: () => void
    const portao = new Promise<void>((r) => { soltar = r })
    vi.stubGlobal('validarCupom', async () => { chamadas++; await portao; return valido })
    const a = tentar(placaN(300)); const b = tentar(placaN(301))
    soltar()
    const [ra, rb] = await Promise.all([a, b])
    expect(ra.bloqueio).toBeNull()
    expect(rb.bloqueio?.motivo).toBe('cupom_global')
    vi.stubGlobal('validarCupom', stubPadrao)
    resposta = valido
    expect((await tentar(placaN(302))).bloqueio).toBeNull() // still 30: not armed
  })
})

describe('typed coupon: same work for unknown and paused campaign under the global limit', () => {
  beforeEach(reset)

  /** Fake database counting queries; `cupom` is the row for any code. */
  function banco(cupom: any) {
    const c = { n: 0 }
    const sb = {
      from: (tabela: string) => {
        c.n++
        if (tabela === 'cupons_premium') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: cupom, error: null }) }) }) }
        const q: any = { eq: () => q, then: (fn: any) => fn({ count: 0 }) }
        return { select: () => q }
      },
    }
    return { sb, c }
  }
  const BASE = { id: 'c1', tipo: 'percentual', valor: 10, planos: ['completa'], ativo: true, valido_de: null, valido_ate: null, limite_uso_global: null, limite_uso_por_cliente: null, email_restrito: null, origem: null }

  it('unknown and campaign (with and without usage limits) make the same number of queries', async () => {
    resposta = invalido
    for (let i = 0; i <= 30; i++) await tentar(placaN(i))
    vi.stubGlobal('validarCupom', validarCupomReal)
    const consultas: number[] = []
    for (const row of [null, BASE, { ...BASE, limite_uso_global: 100 }, { ...BASE, limite_uso_global: 100, limite_uso_por_cliente: 1 }]) {
      const { sb, c } = banco(row)
      const r = await validarCupomComLimite(sb, { codigo: novoCodigo(), plano: 'completa', email: EMAIL, placa: OUTRA }, {}, opts)
      expect(r.bloqueio?.motivo).toBe('cupom_global')
      consultas.push(c.n)
    }
    expect(new Set(consultas).size).toBe(1)
    expect(consultas[0]).toBe(1)
    // Ours still go through the normal checks (usage counts included).
    const { sb, c } = banco({ ...BASE, origem: 'recompra', limite_uso_global: 100, limite_uso_por_cliente: 1 })
    const r = await validarCupomComLimite(sb, { codigo: novoCodigo(), plano: 'completa', email: EMAIL, placa: OUTRA }, {}, opts)
    expect(r.bloqueio).toBeNull()
    expect(r.cupom.ok).toBe(true)
    expect(c.n).toBe(3)
  })
})

describe('e-mail waiver lookup (rebuy coupon) behind the limits', () => {
  beforeEach(reset)
  const sbOrigem = (origem: string | null | undefined, c = { n: 0 }) => ({
    c,
    sb: { from: () => { c.n++; return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: origem === undefined ? null : { origem }, error: null }) }) }) } } },
  })
  const dispensa = (sb: any, placa: unknown = PLACA, codigo = novoCodigo()) => cupomDispensaEmailComLimite(sb, { codigo, placa }, {}, opts)

  it('unknown codes count: the 6th on the plate makes no lookup', async () => {
    const { sb, c } = sbOrigem(undefined)
    for (let i = 0; i < 5; i++) expect(await dispensa(sb)).toBe(false)
    expect(c.n).toBe(5)
    expect(await dispensa(sb)).toBe(false)
    expect(c.n).toBe(5)
    expect(logs.some((l) => l.includes('reason=plate_hour'))).toBe(true)
  })

  it('armed: our personal or bump coupon sent without e-mail is not a guess and logs no block', async () => {
    const { sb } = sbOrigem(undefined)
    for (let i = 0; i <= 30; i++) await dispensa(sb, placaN(i))
    logs = []
    const pessoal = { c: { n: 0 }, sb: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { origem: 'volta', email_restrito: EMAIL }, error: null }) }) }) }) } }
    for (let i = 0; i < 6; i++) expect(await dispensa(pessoal.sb, PLACA)).toBe(false)
    for (let i = 0; i < 6; i++) expect(await dispensa(sbOrigem('bump').sb, PLACA)).toBe(false)
    expect(logs).toEqual([])
    // Nothing counted for the plate: a rebuy coupon still works there.
    expect(await dispensa(sbOrigem('recompra').sb, PLACA)).toBe(true)
  })

  it('a rebuy code waives the e-mail, also under the global limit; others do not', async () => {
    expect(await dispensa(sbOrigem('recompra').sb)).toBe(true)
    expect(await dispensa(sbOrigem('volta').sb)).toBe(false)
    const { sb } = sbOrigem(undefined)
    for (let i = 0; i <= 30; i++) await dispensa(sb, placaN(i))
    expect(await dispensa(sbOrigem('recompra').sb, OUTRA)).toBe(true)
    expect(await dispensa(sbOrigem('volta').sb, OUTRA)).toBe(false)
  })
})

describe('typed coupon: env', () => {
  beforeEach(reset)

  it('empty or invalid = default, 0 = off, a number = that limit', () => {
    expect(limitesCupomDoConfig({})).toEqual({ placaHora: 5, global10min: 30 })
    expect(limitesCupomDoConfig({ cupomLimitePlacaHora: 'abc', cupomLimiteGlobal_10min: '-3' })).toEqual({ placaHora: 5, global10min: 30 })
    expect(limitesCupomDoConfig({ cupomLimitePlacaHora: '0', cupomLimiteGlobal_10min: '0' })).toEqual({ placaHora: 0, global10min: 0 })
    expect(limitesCupomDoConfig({ cupomLimitePlacaHora: 0, cupomLimiteGlobal_10min: 7 })).toEqual({ placaHora: 0, global10min: 7 })
    expect(limitesCupomDoConfig({ cupomLimitePlacaHora: '2', cupomLimiteGlobal_10min: '7' })).toEqual({ placaHora: 2, global10min: 7 })
  })

  it('0 turns both limits off and keeps nothing in memory', async () => {
    const off = { cupomLimitePlacaHora: '0', cupomLimiteGlobal_10min: '0' }
    for (let i = 0; i < 50; i++) expect((await tentar(placaN(i), off)).bloqueio).toBeNull()
    expect(chamadas).toBe(50)
    expect(_tamanhoCupomLimite()).toEqual({ chaves: 0, global: 0 })
  })

  it('global off: the global list does not grow', async () => {
    const cfg = { cupomLimiteGlobal_10min: '0' }
    for (let i = 0; i < 200; i++) await tentar(placaN(i), cfg)
    expect(_tamanhoCupomLimite().global).toBe(0)
  })

  it('a lower env limit blocks earlier', async () => {
    const cfg = { cupomLimitePlacaHora: '2' }
    await tentar(PLACA, cfg); await tentar(PLACA, cfg)
    expect((await tentar(PLACA, cfg)).bloqueio?.motivo).toBe('cupom_placa')
  })
})

describe('typed coupon: log and memory', () => {
  beforeEach(reset)

  it('one masked line per block, with no coupon code or e-mail', async () => {
    const codigos: string[] = []
    for (let i = 0; i < 6; i++) { const c = novoCodigo(); codigos.push(c); await tentar(PLACA, {}, c) }
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatch(/^\[cupom-limite\] blocked coupon plate=TST\*\*\*\* reason=plate_hour/)
    for (const c of codigos) expect(logs[0]).not.toContain(c)
    expect(logs[0]).not.toContain(EMAIL)
    expect(logs[0]).not.toContain(PLACA)
  })

  it('memory stays bounded: above 10,000 distinct plates the oldest keys are dropped', async () => {
    const cfg = { cupomLimiteGlobal_10min: '0' }
    const distintas = new Set<string>()
    for (let i = 0; i < 10_500; i++) { const p = placaN(i); distintas.add(p); await tentar(p, cfg) }
    expect(distintas.size).toBe(10_500)
    expect(_tamanhoCupomLimite().chaves).toBe(10_000)
    // The first plates were dropped: their single failure is gone.
    for (let i = 0; i < 4; i++) await tentar(placaN(0), cfg)
    expect((await tentar(placaN(0), cfg)).bloqueio).toBeNull()
  })

  it('the global list is capped', async () => {
    const cfg = { cupomLimitePlacaHora: '0', cupomLimiteGlobal_10min: '999' }
    for (let i = 0; i < 1500; i++) await tentar(null, cfg)
    expect(_tamanhoCupomLimite().global).toBeLessThanOrEqual(1000)
  })
})

describe('validarCupom marks guesses and ours', () => {
  const sb = (cupom: any, error: any = null) => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: cupom, error }) }) }) }),
  }) as any
  const CODIGO = 'FAKECODE00'
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

  it('only ours: a campaign coupon is refused right after the lookup; ours go on', async () => {
    expect(await validarCupomReal(sb(BASE), CODIGO, 'completa', EMAIL, null, { somenteDoSistema: true })).toMatchObject({ ok: false, foraDoSistema: true })
    expect((await validarCupomReal(sb({ ...BASE, origem: 'gratis_recover' }), CODIGO, 'completa', EMAIL, null, { somenteDoSistema: true })).ok).toBe(true)
    expect((await validarCupomReal(sb({ ...BASE, email_restrito: EMAIL }), CODIGO, 'completa', EMAIL, null, { somenteDoSistema: true })).ok).toBe(true)
  })
})
