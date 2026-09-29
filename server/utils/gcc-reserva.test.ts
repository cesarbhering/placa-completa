import { describe, it, expect } from 'vitest'
import { expDoHashJwt, validadeDaReserva } from './gcc-reserva'

// Monta um JWT de teste (header.payload.assinatura) — a assinatura nao importa,
// expDoHashJwt so le o payload.
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}.assinatura-falsa`
}

describe('expDoHashJwt', () => {
  it('le o exp de um JWT valido', () => {
    const exp = Math.floor(Date.now() / 1000) + 24 * 3600
    const d = expDoHashJwt(jwt({ sub: 'x', exp }))
    expect(d).toBeInstanceOf(Date)
    expect(Math.round((d as Date).getTime() / 1000)).toBe(exp)
  })

  it('null pra token que nao e JWT, vazio ou sem exp', () => {
    expect(expDoHashJwt(null)).toBeNull()
    expect(expDoHashJwt('')).toBeNull()
    expect(expDoHashJwt('abc')).toBeNull()
    expect(expDoHashJwt(jwt({ sub: 'x' }))).toBeNull()
    expect(expDoHashJwt(jwt({ exp: 'nao-numero' }))).toBeNull()
  })

  it('null pra payload nao-JSON', () => {
    expect(expDoHashJwt('aaa.@@@nao-base64-json@@@.bbb')).toBeNull()
  })
})

describe('validadeDaReserva', () => {
  it('usa o exp do JWT quando existe', () => {
    const exp = Math.floor(Date.now() / 1000) + 12 * 3600
    const d = validadeDaReserva(jwt({ exp }))
    expect(Math.round(d.getTime() / 1000)).toBe(exp)
  })

  it('cai pro fallback de 24h quando nao da pra ler o exp', () => {
    const agora = new Date('2026-01-01T00:00:00Z')
    const d = validadeDaReserva('sem-jwt', agora)
    expect(d.getTime()).toBe(agora.getTime() + 24 * 3600 * 1000)
  })
})
