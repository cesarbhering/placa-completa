import { describe, it, expect, beforeEach } from 'vitest'
import {
  deviceIdLocal, deveExigirEmailLocal, registrarConsultaSemEmail, salvarEmailGate,
  tokensDoHistorico, temPagoLocal, ehErroGateEmail, camposGateEmail,
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
