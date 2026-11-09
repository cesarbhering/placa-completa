import { describe, it, expect, beforeEach } from 'vitest'
import {
  avaliarGateEmail, sanearDeviceId, sanearTokensPagos, limiteGratisSemEmail,
  GATE_EMAIL_JANELA_MS, type GateEmailDeps,
} from './gate-email'

// In-memory stand-in for the `consultas` table and paid orders. Each accepted
// lookup is recorded like the endpoint does (ip + device id + time).
interface Linha { ip: string; deviceId: string | null; em: number }

const DEV_A = '11111111-1111-4111-8111-111111111111'
const DEV_B = '22222222-2222-4222-8222-222222222222'
const TOKEN_PAGO = 'tokenFicticioPago0001'
const TOKEN_NAO_PAGO = 'tokenFicticioAberto01'

let linhas: Linha[]
let agora: number

function deps(): GateEmailDeps {
  return {
    async contarConsultas({ ip, deviceId, desdeIso }) {
      const desde = Date.parse(desdeIso)
      return linhas.filter((l) => l.em >= desde && ((ip && l.ip === ip) || (deviceId && l.deviceId === deviceId))).length
    },
    async algumTokenPago(tokens) {
      return tokens.includes(TOKEN_PAGO)
    },
  }
}

// Simulates one POST /api/consulta: evaluates the gate and, when allowed,
// records the row like the endpoint.
async function consultar(o: { ip: string; deviceId?: string | null; email?: boolean; tokens?: string[] }) {
  const r = await avaliarGateEmail(deps(), {
    temEmail: !!o.email,
    ip: o.ip,
    deviceId: o.deviceId ?? null,
    tokensPagos: o.tokens ?? [],
    agora,
  })
  if (!r.exigirEmail) linhas.push({ ip: o.ip, deviceId: o.deviceId ?? null, em: agora })
  agora += 60_000
  return r
}

beforeEach(() => {
  linhas = []
  agora = Date.parse('2026-11-09T12:00:00Z')
})

describe('free lookup e-mail gate', () => {
  it('lets the first two lookups through without e-mail', async () => {
    expect((await consultar({ ip: '198.51.100.1', deviceId: DEV_A })).exigirEmail).toBe(false)
    expect((await consultar({ ip: '198.51.100.1', deviceId: DEV_A })).exigirEmail).toBe(false)
  })

  it('requires e-mail on the third lookup without e-mail', async () => {
    await consultar({ ip: '198.51.100.1', deviceId: DEV_A })
    await consultar({ ip: '198.51.100.1', deviceId: DEV_A })
    const r = await consultar({ ip: '198.51.100.1', deviceId: DEV_A })
    expect(r).toMatchObject({ exigirEmail: true, motivo: 'gate', consultas: 2 })
  })

  it('lets the third lookup through when an e-mail is given', async () => {
    await consultar({ ip: '198.51.100.1', deviceId: DEV_A })
    await consultar({ ip: '198.51.100.1', deviceId: DEV_A })
    const r = await consultar({ ip: '198.51.100.1', deviceId: DEV_A, email: true })
    expect(r).toMatchObject({ exigirEmail: false, motivo: 'com_email' })
  })

  it('exempts a requester holding a paid report token', async () => {
    await consultar({ ip: '198.51.100.1', deviceId: DEV_A })
    await consultar({ ip: '198.51.100.1', deviceId: DEV_A })
    const r = await consultar({ ip: '198.51.100.1', deviceId: DEV_A, tokens: [TOKEN_NAO_PAGO, TOKEN_PAGO] })
    expect(r).toMatchObject({ exigirEmail: false, motivo: 'pagou' })
  })

  it('does not exempt an unpaid or unknown token, with the same result shape', async () => {
    await consultar({ ip: '198.51.100.1', deviceId: DEV_A })
    await consultar({ ip: '198.51.100.1', deviceId: DEV_A })
    const naoPago = await consultar({ ip: '198.51.100.1', deviceId: DEV_A, tokens: [TOKEN_NAO_PAGO] })
    const desconhecido = await consultar({ ip: '198.51.100.1', deviceId: DEV_A, tokens: ['tokenQueNaoExiste99'] })
    expect(naoPago).toEqual(desconhecido)
    expect(naoPago.exigirEmail).toBe(true)
  })

  it('still gates when the IP rotates but the device id stays', async () => {
    await consultar({ ip: '198.51.100.1', deviceId: DEV_A })
    await consultar({ ip: '198.51.100.2', deviceId: DEV_A })
    const r = await consultar({ ip: '198.51.100.3', deviceId: DEV_A })
    expect(r.exigirEmail).toBe(true)
  })

  it('still gates when the device id rotates (or is dropped) but the IP stays', async () => {
    await consultar({ ip: '198.51.100.1', deviceId: DEV_A })
    await consultar({ ip: '198.51.100.1', deviceId: DEV_B })
    expect((await consultar({ ip: '198.51.100.1', deviceId: '33333333-3333-4333-8333-333333333333' })).exigirEmail).toBe(true)
    expect((await consultar({ ip: '198.51.100.1', deviceId: null })).exigirEmail).toBe(true)
  })

  it('only counts the last 24 hours', async () => {
    await consultar({ ip: '198.51.100.1', deviceId: DEV_A })
    await consultar({ ip: '198.51.100.1', deviceId: DEV_A })
    agora += GATE_EMAIL_JANELA_MS
    expect((await consultar({ ip: '198.51.100.1', deviceId: DEV_A })).exigirEmail).toBe(false)
  })

  it('fails open when the count query errors (hourly IP cap still applies)', async () => {
    const r = await avaliarGateEmail(
      { contarConsultas: async () => { throw new Error('db down') }, algumTokenPago: async () => false },
      { temEmail: false, ip: '198.51.100.1', deviceId: DEV_A, tokensPagos: [] },
    )
    expect(r).toMatchObject({ exigirEmail: false, motivo: 'erro_contagem' })
  })

  it('treats a failing paid-token lookup as not proven', async () => {
    const r = await avaliarGateEmail(
      { contarConsultas: async () => 5, algumTokenPago: async () => { throw new Error('premium down') } },
      { temEmail: false, ip: '198.51.100.1', deviceId: null, tokensPagos: [TOKEN_PAGO] },
    )
    expect(r.exigirEmail).toBe(true)
  })
})

describe('gate input sanitising', () => {
  it('accepts only UUID device ids', () => {
    expect(sanearDeviceId(DEV_A.toUpperCase())).toBe(DEV_A)
    expect(sanearDeviceId('abc')).toBeNull()
    expect(sanearDeviceId("x' or 1=1")).toBeNull()
    expect(sanearDeviceId(undefined)).toBeNull()
  })

  it('keeps well-formed unique tokens and caps the list', () => {
    expect(sanearTokensPagos('nope')).toEqual([])
    expect(sanearTokensPagos([TOKEN_PAGO, TOKEN_PAGO, 'a,b', 42])).toEqual([TOKEN_PAGO])
    const muitos = Array.from({ length: 30 }, (_, i) => `tokenFicticio${String(i).padStart(4, '0')}`)
    expect(sanearTokensPagos(muitos)).toHaveLength(12)
  })
})

describe('configurable allowance (NUXT_CONSULTA_GRATIS_SEM_EMAIL)', () => {
  it('parses the env value, defaulting to 2', () => {
    expect(limiteGratisSemEmail(undefined)).toBe(2)
    expect(limiteGratisSemEmail('')).toBe(2)
    expect(limiteGratisSemEmail('abc')).toBe(2)
    expect(limiteGratisSemEmail('-1')).toBe(2)
    expect(limiteGratisSemEmail('0')).toBe(0)
    expect(limiteGratisSemEmail(0)).toBe(0)
    expect(limiteGratisSemEmail('5')).toBe(5)
  })

  it('emergency mode (0) gates the very first lookup without e-mail', async () => {
    const r = await avaliarGateEmail(deps(), { temEmail: false, ip: '198.51.100.1', deviceId: DEV_A, tokensPagos: [], limite: 0, agora })
    expect(r).toMatchObject({ exigirEmail: true, motivo: 'gate' })
  })

  it('emergency mode (0) gates even without any identifier', async () => {
    const r = await avaliarGateEmail(deps(), { temEmail: false, ip: 'unknown', deviceId: null, tokensPagos: [], limite: 0, agora })
    expect(r.exigirEmail).toBe(true)
  })

  it('emergency mode (0) still lets e-mail and paid tokens through', async () => {
    expect((await avaliarGateEmail(deps(), { temEmail: true, ip: '198.51.100.1', deviceId: null, tokensPagos: [], limite: 0 })).exigirEmail).toBe(false)
    expect((await avaliarGateEmail(deps(), { temEmail: false, ip: '198.51.100.1', deviceId: null, tokensPagos: [TOKEN_PAGO], limite: 0 })))
      .toMatchObject({ exigirEmail: false, motivo: 'pagou' })
    expect((await avaliarGateEmail(deps(), { temEmail: false, ip: '198.51.100.1', deviceId: null, tokensPagos: [TOKEN_NAO_PAGO], limite: 0 })).exigirEmail).toBe(true)
  })
})

describe('allowance 2 (permanent rule) passed explicitly', () => {
  it('lets two through and gates the third', async () => {
    const o = { temEmail: false, ip: '198.51.100.9', deviceId: DEV_B, tokensPagos: [] as string[], limite: 2 }
    for (let i = 0; i < 2; i++) {
      const r = await avaliarGateEmail(deps(), { ...o, agora })
      expect(r.exigirEmail).toBe(false)
      linhas.push({ ip: o.ip, deviceId: o.deviceId, em: agora })
    }
    expect((await avaliarGateEmail(deps(), { ...o, agora })).exigirEmail).toBe(true)
  })
})
