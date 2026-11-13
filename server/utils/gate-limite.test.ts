import { describe, it, expect, beforeEach } from 'vitest'
import { gateBloqueado, registrarSenhaErrada, _zerarGateLimite, GATE_BLOQUEIO_MS } from './gate-limite'

// Site-wide wrong-password lock of the homolog/staging gate.
const T0 = Date.parse('2026-11-13T12:00:00Z')
const silencio = () => {}

describe('gate wrong-password lock', () => {
  beforeEach(() => _zerarGateLimite())

  it('10 wrong passwords in 10 min do not lock; the 11th does, for 10 min', () => {
    for (let i = 0; i < 10; i++) registrarSenhaErrada(T0 + i * 1000, silencio)
    expect(gateBloqueado(T0 + 10_000)).toBe(false)
    registrarSenhaErrada(T0 + 11_000, silencio)
    expect(gateBloqueado(T0 + 11_000)).toBe(true)
    expect(gateBloqueado(T0 + 11_000 + GATE_BLOQUEIO_MS - 1)).toBe(true)
    expect(gateBloqueado(T0 + 11_000 + GATE_BLOQUEIO_MS)).toBe(false)
  })

  it('errors older than 10 min fall out of the window', () => {
    for (let i = 0; i < 10; i++) registrarSenhaErrada(T0, silencio)
    registrarSenhaErrada(T0 + 10 * 60_000 + 1, silencio)
    expect(gateBloqueado(T0 + 10 * 60_000 + 1)).toBe(false)
  })

  it('after the lock the count starts over', () => {
    for (let i = 0; i < 11; i++) registrarSenhaErrada(T0, silencio)
    const fim = T0 + GATE_BLOQUEIO_MS
    registrarSenhaErrada(fim, silencio)
    expect(gateBloqueado(fim)).toBe(false)
  })
})
