import { describe, it, expect, beforeEach } from 'vitest'
import {
  deviceIdLocal, deveExigirEmailLocal, registrarConsultaSemEmail, salvarEmailGate,
  tokensDoHistorico, temPagoLocal, ehErroGateEmail, camposGateEmail, parseLimiteGate,
} from './useGateEmail'

const T0 = Date.parse('2026-11-09T12:00:00Z')

beforeEach(() => { localStorage.clear() })

describe('client-side e-mail gate', () => {
  it('creates a stable UUID device id', () => {
    const a = deviceIdLocal()
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(deviceIdLocal()).toBe(a)
  })

  it('asks for e-mail up front after two free lookups without e-mail in 24 h', () => {
    expect(deveExigirEmailLocal(T0)).toBe(false)
    registrarConsultaSemEmail(T0)
    expect(deveExigirEmailLocal(T0)).toBe(false)
    registrarConsultaSemEmail(T0 + 1000)
    expect(deveExigirEmailLocal(T0 + 2000)).toBe(true)
    expect(deveExigirEmailLocal(T0 + 24 * 3600e3 + 1)).toBe(false)
  })

  it('does not ask again once an e-mail was saved', () => {
    registrarConsultaSemEmail(T0)
    registrarConsultaSemEmail(T0)
    salvarEmailGate('pessoa@exemplo.com')
    expect(deveExigirEmailLocal(T0)).toBe(false)
  })

  it('does not ask up front when local history shows a paid report', () => {
    registrarConsultaSemEmail(T0)
    registrarConsultaSemEmail(T0)
    localStorage.setItem('pc_consultas_v1', JSON.stringify([{ token: 'tokenFicticio0001', placa: 'TST1A23', status: 'entregue' }]))
    expect(temPagoLocal()).toBe(true)
    expect(deveExigirEmailLocal(T0)).toBe(false)
  })

  it('still asks when the only local report is unpaid', () => {
    registrarConsultaSemEmail(T0)
    registrarConsultaSemEmail(T0)
    localStorage.setItem('pc_consultas_v1', JSON.stringify([{ token: 'tokenFicticio0002', placa: 'TST1A23', status: 'aguardando_pagamento' }]))
    expect(deveExigirEmailLocal(T0)).toBe(true)
  })

  it('sends the device id and every local report token for the server to verify', () => {
    localStorage.setItem('pc_consultas_v1', JSON.stringify([
      { token: 'tokenFicticio0001', status: 'entregue' },
      { token: 'tokenFicticio0002', status: 'aguardando_pagamento' },
    ]))
    expect(tokensDoHistorico()).toEqual(['tokenFicticio0001', 'tokenFicticio0002'])
    const c = camposGateEmail()
    expect(c.deviceId).toBe(deviceIdLocal())
    expect(c.tokensPagos).toHaveLength(2)
  })

  it('recognises the server gate error', () => {
    expect(ehErroGateEmail({ data: { statusCode: 403, data: { code: 'email_obrigatorio' } } })).toBe(true)
    expect(ehErroGateEmail({ data: { statusCode: 429 } })).toBe(false)
  })
})

describe('client-side allowance from the server answer', () => {
  it('asks up front from the first lookup after the server reports allowance 0, for one hour', () => {
    const agora = Date.now()
    expect(deveExigirEmailLocal(agora)).toBe(false)
    expect(ehErroGateEmail({ data: { data: { code: 'email_obrigatorio', limite: 0 } } })).toBe(true)
    expect(deveExigirEmailLocal(agora)).toBe(true)
    expect(deveExigirEmailLocal(agora + 2 * 3600e3)).toBe(false)
  })

  it('a saved e-mail or a paid local report skips the up-front modal even at 0', () => {
    ehErroGateEmail({ data: { data: { code: 'email_obrigatorio', limite: 0 } } })
    localStorage.setItem('pc_consultas_v1', JSON.stringify([{ token: 'tokenFicticio0001', status: 'entregue' }]))
    expect(deveExigirEmailLocal()).toBe(false)
    localStorage.removeItem('pc_consultas_v1')
    salvarEmailGate('pessoa@exemplo.com')
    expect(deveExigirEmailLocal()).toBe(false)
  })
})

describe('allowance delivered by the page (SSR state)', () => {
  it('parses the env value like the server, defaulting to 2', () => {
    expect(parseLimiteGate(undefined)).toBe(2)
    expect(parseLimiteGate('x')).toBe(2)
    expect(parseLimiteGate('0')).toBe(0)
    expect(parseLimiteGate(0)).toBe(0)
    expect(parseLimiteGate('2')).toBe(2)
  })

  it('with allowance 0 the modal opens before the very first lookup', () => {
    expect(deveExigirEmailLocal(T0, 0)).toBe(true)
  })

  it('with allowance 2 the first two lookups go through and the third asks', () => {
    expect(deveExigirEmailLocal(T0, 2)).toBe(false)
    registrarConsultaSemEmail(T0)
    expect(deveExigirEmailLocal(T0, 2)).toBe(false)
    registrarConsultaSemEmail(T0)
    expect(deveExigirEmailLocal(T0, 2)).toBe(true)
  })

  it('with allowance 0, a saved e-mail or a paid local report skips the up-front modal', () => {
    salvarEmailGate('pessoa@exemplo.com')
    expect(deveExigirEmailLocal(T0, 0)).toBe(false)
    localStorage.clear()
    localStorage.setItem('pc_consultas_v1', JSON.stringify([{ token: 'tokenFicticio0001', status: 'pago' }]))
    expect(deveExigirEmailLocal(T0, 0)).toBe(false)
  })
})
