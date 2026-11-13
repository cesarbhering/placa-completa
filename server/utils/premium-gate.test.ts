import { describe, it, expect, vi, beforeEach } from 'vitest'
import { _zerarGateLimite } from './gate-limite'

// Homolog/staging gate on protected routes: derived cookie, and the password
// header counted in the same wrong-password lock as /api/premium/gate.
const SENHA = 'test-password'
const CONFIG: any = { public: { gated: true }, premiumPagePassword: SENHA }
let cookie: string | undefined
let header: string | undefined
vi.stubGlobal('useRuntimeConfig', () => CONFIG)
vi.stubGlobal('getCookie', () => cookie)
vi.stubGlobal('getRequestHeader', () => header)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
const { assertPremiumGate, valorCookieGate } = await import('./premium-gate')

const status = () => { try { assertPremiumGate({} as any); return 200 } catch (e: any) { return e.statusCode } }

describe('premium gate on protected routes', () => {
  beforeEach(() => { _zerarGateLimite(); cookie = header = undefined; CONFIG.public.gated = true; vi.spyOn(console, 'warn').mockImplementation(() => {}) })

  it('the cookie holds a derived value, not the password', () => {
    const v = valorCookieGate(SENHA)
    expect(v).not.toContain(SENHA)
    expect(v).toBe(valorCookieGate(SENHA))
    expect(v).not.toBe(valorCookieGate('other-password'))
    cookie = v
    expect(status()).toBe(200)
  })

  it('an old cookie with the raw password, or any invalid cookie, is 401 and never locks', () => {
    cookie = SENHA
    for (let i = 0; i < 30; i++) expect(status()).toBe(401)
    cookie = 'garbage'
    for (let i = 0; i < 30; i++) expect(status()).toBe(401)
    cookie = undefined; header = SENHA
    expect(status()).toBe(200)
  })

  it('a wrong header counts: the 11th locks it, then even the right header is 429', () => {
    header = 'wrong-pass-00'
    for (let i = 0; i < 10; i++) expect(status()).toBe(401)
    header = SENHA
    expect(status()).toBe(200)
    header = 'wrong-pass-00'
    expect(status()).toBe(401) // 11th wrong: armed
    header = SENHA
    expect(status()).toBe(429)
    // A valid cookie keeps working during the lock.
    header = undefined; cookie = valorCookieGate(SENHA)
    expect(status()).toBe(200)
  })

  it('without cookie or header: 401, not counted', () => {
    for (let i = 0; i < 30; i++) expect(status()).toBe(401)
    header = SENHA
    expect(status()).toBe(200)
  })

  it('production (not gated) is untouched', () => {
    CONFIG.public.gated = false
    header = 'wrong-pass-00'
    for (let i = 0; i < 30; i++) expect(status()).toBe(200)
  })
})
