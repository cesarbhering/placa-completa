import { describe, it, expect } from 'vitest'
import { criarEstadoToken, camposTurnstile, TURNSTILE_ESPERA_MS, TURNSTILE_ESPERA_ERRO_MS, TURNSTILE_ESPERA_INTERACAO_MS, TURNSTILE_TOKEN_MAX_MS } from './useTurnstile'

/** Fake clock: dormir() advances time instead of waiting. */
function relogio() {
  let t = 1_000_000
  return {
    agora: () => t,
    avancar: (ms: number) => { t += ms },
    dormir: async (ms: number) => { t += ms },
  }
}

describe('Turnstile token state', () => {
  it('a token generated while the user types is used at once, with no wait', async () => {
    const r = relogio()
    const e = criarEstadoToken(r.agora)
    e.onToken('tok-a')
    const antes = r.agora()
    await e.esperar(r.dormir)
    expect(r.agora() - antes).toBe(0)
    expect(e.consumir()).toBe('tok-a')
  })

  it('a token is single use', () => {
    const e = criarEstadoToken()
    e.onToken('tok-a')
    expect(e.consumir()).toBe('tok-a')
    expect(e.consumir()).toBeNull()
  })

  it('waits for a token that arrives after the click (the old code dropped it after 4 s)', async () => {
    const r = relogio()
    const e = criarEstadoToken(r.agora)
    let chamadas = 0
    // token arrives ~5 s after the click
    const dormir = async (ms: number) => { r.avancar(ms); if (++chamadas === 5) e.onToken('tok-tarde') }
    await e.esperar(dormir)
    expect(e.consumir()).toBe('tok-tarde')
  })

  it('gives up after the normal wait when nothing arrives', async () => {
    const r = relogio()
    const e = criarEstadoToken(r.agora)
    const antes = r.agora()
    await e.esperar(r.dormir)
    expect(r.agora() - antes).toBe(TURNSTILE_ESPERA_MS)
    expect(e.consumir()).toBeNull()
  })

  it('waits longer while Cloudflare shows the checkbox', async () => {
    const r = relogio()
    const e = criarEstadoToken(r.agora)
    e.onInteracao()
    const antes = r.agora()
    await e.esperar(r.dormir)
    expect(r.agora() - antes).toBe(TURNSTILE_ESPERA_INTERACAO_MS)
    expect(e.interacao).toBe(true)
  })

  it('an expired or stale token is not used', () => {
    const r = relogio()
    const e = criarEstadoToken(r.agora)
    e.onToken('tok-velho')
    r.avancar(TURNSTILE_TOKEN_MAX_MS + 1)
    expect(e.consumir()).toBeNull()
    e.onToken('tok-b')
    e.onExpirado()
    expect(e.consumir()).toBeNull()
  })

  it('after a widget error, waits only briefly for the automatic retry', async () => {
    const r = relogio()
    const e = criarEstadoToken(r.agora)
    e.onErro('600010')
    const antes = r.agora()
    await e.esperar(r.dormir)
    expect(r.agora() - antes).toBe(TURNSTILE_ESPERA_ERRO_MS)
  })

  it('keeps only the numeric error code', () => {
    const e = criarEstadoToken()
    e.onErro('300030')
    expect(e.erro).toBe('erro_300030')
    e.onErro('bad thing')
    expect(e.erro).toBe('erro_x')
    e.onToken('tok')
    expect(e.erro).toBeNull()
  })
})

describe('camposTurnstile (POST body)', () => {
  it('token: sends token and wait', () => {
    expect(camposTurnstile({ token: 'tok', motivo: null, esperaMs: 12.4 })).toEqual({ turnstileToken: 'tok', turnstileEsperaMs: 12 })
  })
  it('no token: sends the reason, never an empty token', () => {
    expect(camposTurnstile({ token: null, motivo: 'timeout', esperaMs: 8000 })).toEqual({ turnstileMotivo: 'timeout', turnstileEsperaMs: 8000 })
  })
  it('Turnstile off (no site key): sends nothing', () => {
    expect(camposTurnstile({ token: null, motivo: null, esperaMs: 0 })).toEqual({})
    expect(camposTurnstile(null)).toEqual({})
  })
})
