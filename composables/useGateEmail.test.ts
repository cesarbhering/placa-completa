import { describe, it, expect, beforeEach } from 'vitest'
import {
  deviceIdLocal, deveExigirEmailLocal, registrarConsultaSemEmail, salvarEmailGate,
  tokensDoHistorico, temPagoLocal, ehErroGateEmail, camposGateEmail,
} from './useGateEmail'

const gate403 = (limite: number) => ({ data: { statusCode: 403, data: { code: 'email_obrigatorio', limite } } })

beforeEach(() => { localStorage.clear() })

describe('client-side e-mail gate', () => {
  it('creates a stable UUID device id', () => {
    const a = deviceIdLocal()
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(deviceIdLocal()).toBe(a)
  })

  it('never blocks on its own before the server has answered email_obrigatorio (whitelisted/paid requesters stay exempt)', () => {
    const agora = Date.now()
    for (let i = 0; i < 5; i++) registrarConsultaSemEmail(agora)
    expect(deveExigirEmailLocal(agora)).toBe(false)
  })

  it('after a 403 with allowance 0, the next lookup asks up front', () => {
    expect(ehErroGateEmail(gate403(0))).toBe(true)
    expect(deveExigirEmailLocal()).toBe(true)
  })

  it('after a 403 with allowance 2, asks up front once two local lookups are counted', () => {
    ehErroGateEmail(gate403(2))
    const agora = Date.now()
    expect(deveExigirEmailLocal(agora)).toBe(false)
    registrarConsultaSemEmail(agora)
    registrarConsultaSemEmail(agora)
    expect(deveExigirEmailLocal(agora)).toBe(true)
  })

  it('the remembered 403 expires after one hour', () => {
    ehErroGateEmail(gate403(0))
    expect(deveExigirEmailLocal(Date.now() + 2 * 3600e3)).toBe(false)
  })

  it('a saved e-mail skips the up-front modal', () => {
    ehErroGateEmail(gate403(0))
    salvarEmailGate('pessoa@exemplo.com')
    expect(deveExigirEmailLocal()).toBe(false)
  })

  it('a paid report in local history skips the up-front modal; an unpaid one does not', () => {
    ehErroGateEmail(gate403(0))
    localStorage.setItem('pc_consultas_v1', JSON.stringify([{ token: 'tokenFicticio0002', placa: 'TST1A23', status: 'aguardando_pagamento' }]))
    expect(deveExigirEmailLocal()).toBe(true)
    localStorage.setItem('pc_consultas_v1', JSON.stringify([{ token: 'tokenFicticio0001', placa: 'TST1A23', status: 'entregue' }]))
    expect(temPagoLocal()).toBe(true)
    expect(deveExigirEmailLocal()).toBe(false)
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

  it('recognises only the gate error', () => {
    expect(ehErroGateEmail(gate403(2))).toBe(true)
    expect(ehErroGateEmail({ data: { statusCode: 429 } })).toBe(false)
  })
})
