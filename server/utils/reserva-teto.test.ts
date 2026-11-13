import { describe, it, expect, beforeEach } from 'vitest'
import {
  inicioDaContagem, emVooPara, reservar, _zerarReservas, _chavesEmMemoria,
  TTL_RESERVA_MS, RETENCAO_POS_LIBERACAO_MS, MAX_CHAVES,
} from './reserva-teto'

// In-flight reservations for caps counted in the database: a request that
// passed the check and has not written its row yet is kept in memory and
// added to the count of the requests that overlap it.
describe('in-flight reservations', () => {
  beforeEach(() => _zerarReservas())

  it('a reservation not released yet counts for every later check', () => {
    const inicio = inicioDaContagem()
    reservar('ip|a')
    reservar('ip|a')
    expect(emVooPara('ip|a', inicio)).toBe(2)
    expect(emVooPara('ip|a', inicioDaContagem())).toBe(2)
    expect(emVooPara('ip|b', inicioDaContagem())).toBe(0)
  })

  it('released with the row written BEFORE a count started: that count already has the row, no double count', () => {
    const liberar = reservar('ip|a')
    liberar(true)
    const depois = inicioDaContagem()
    expect(emVooPara('ip|a', depois)).toBe(0)
  })

  it('released with the row written AFTER a count started: that count may have missed the row, so it still counts', () => {
    const liberar = reservar('ip|a')
    const antes = inicioDaContagem()
    liberar(true)
    expect(emVooPara('ip|a', antes)).toBe(1)
    // A count that starts now sees the row in the database instead.
    expect(emVooPara('ip|a', inicioDaContagem())).toBe(0)
  })

  it('released without a row (blocked later, repeated lookup, error): the slot is free at once', () => {
    const liberar = reservar('ip|a')
    const antes = inicioDaContagem()
    liberar(false)
    expect(emVooPara('ip|a', antes)).toBe(0)
    expect(_chavesEmMemoria()).toBe(0)
  })

  it('release is idempotent and the default is "row written"', () => {
    const liberar = reservar('ip|a')
    const antes = inicioDaContagem()
    liberar()
    liberar(false)
    liberar()
    expect(emVooPara('ip|a', antes)).toBe(1)
  })

  it('safety TTL: a reservation never released stops counting', () => {
    const t0 = 1_000_000
    const inicio = inicioDaContagem()
    reservar('ip|a', t0)
    expect(emVooPara('ip|a', inicio, t0 + TTL_RESERVA_MS - 1)).toBe(1)
    expect(emVooPara('ip|a', inicio, t0 + TTL_RESERVA_MS + 1)).toBe(0)
    expect(_chavesEmMemoria()).toBe(0)
  })

  it('a released reservation leaves memory after the retention window', () => {
    const t0 = 1_000_000
    const liberar = reservar('ip|a', t0)
    const antes = inicioDaContagem()
    liberar(true, t0 + 10)
    expect(emVooPara('ip|a', antes, t0 + 10 + RETENCAO_POS_LIBERACAO_MS - 1)).toBe(1)
    expect(emVooPara('ip|a', antes, t0 + 10 + RETENCAO_POS_LIBERACAO_MS + 1)).toBe(0)
    expect(_chavesEmMemoria()).toBe(0)
  })

  it('bounded memory: expired keys are pruned, and when it is really full the request goes through unreserved', () => {
    const t0 = 1_000_000
    for (let i = 0; i < MAX_CHAVES; i++) reservar(`ip|${i}`, t0)
    expect(_chavesEmMemoria()).toBe(MAX_CHAVES)
    // Full of live reservations: fail open (no reservation, nothing thrown).
    const inicio = inicioDaContagem()
    const liberar = reservar('ip|novo', t0 + 1)
    expect(emVooPara('ip|novo', inicio, t0 + 1)).toBe(0)
    expect(_chavesEmMemoria()).toBe(MAX_CHAVES)
    expect(() => liberar(true)).not.toThrow()
    // Once the old ones expire, the map is pruned and reserving works again.
    reservar('ip|novo', t0 + TTL_RESERVA_MS + 1)
    expect(_chavesEmMemoria()).toBe(1)
    expect(emVooPara('ip|novo', inicio, t0 + TTL_RESERVA_MS + 1)).toBe(1)
  })

  it('an empty key reserves nothing', () => {
    const inicio = inicioDaContagem()
    reservar('')
    expect(emVooPara('', inicio)).toBe(0)
    expect(_chavesEmMemoria()).toBe(0)
  })
})
