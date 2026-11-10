import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { criarEstadoToken, camposTurnstile, limitesEspera, TURNSTILE_ESPERA_LOG_MS, TURNSTILE_ESPERA_MS, TURNSTILE_ESPERA_ERRO_MS, TURNSTILE_ESPERA_INTERACAO_MS, TURNSTILE_TOKEN_MAX_MS } from './useTurnstile'

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

describe('wait limits by server mode', () => {
  const enforce = limitesEspera('enforce')
  const log = limitesEspera('log')

  it('enforce keeps 8 s / 3 s after an error / 25 s with the checkbox', () => {
    expect(enforce).toEqual({ base: 8000, erro: 3000, interacao: 25000 })
  })
  it('log never holds the lookup more than 2 s, with no extra wait for interaction', () => {
    expect(log).toEqual({ base: TURNSTILE_ESPERA_LOG_MS, erro: TURNSTILE_ESPERA_LOG_MS, interacao: TURNSTILE_ESPERA_LOG_MS })
    expect(TURNSTILE_ESPERA_LOG_MS).toBe(2000)
  })
  it('off does not wait; unknown or missing mode falls back to log', () => {
    expect(limitesEspera('off')).toEqual({ base: 0, erro: 0, interacao: 0 })
    expect(limitesEspera(undefined)).toEqual(log)
    expect(limitesEspera('ENFORCE ')).toEqual(enforce)
  })

  for (const [modo, lim, esperado] of [
    ['enforce', enforce, { nada: 8000, erro: 3000, interacao: 25000 }],
    ['log', log, { nada: 2000, erro: 2000, interacao: 2000 }],
  ] as const) {
    it(`${modo}: waits ${esperado.nada} / ${esperado.erro} / ${esperado.interacao} ms (no token / widget error / checkbox shown)`, async () => {
      for (const [caso, preparar] of [['nada', () => {}], ['erro', (e: any) => e.onErro('600010')], ['interacao', (e: any) => e.onInteracao()]] as const) {
        const r = relogio()
        const e = criarEstadoToken(r.agora)
        preparar(e)
        const antes = r.agora()
        await e.esperar(r.dormir, lim)
        expect(r.agora() - antes).toBe(esperado[caso])
      }
    })
  }

  it('log: a token that arrives within 2 s is still used', async () => {
    const r = relogio()
    const e = criarEstadoToken(r.agora)
    let n = 0
    await e.esperar(async (ms) => { r.avancar(ms); if (++n === 1) e.onToken('tok-1s') }, log)
    expect(e.consumir()).toBe('tok-1s')
  })

  it('the server hands the effective mode to the client without a new env and without the secret', () => {
    const plugin = readFileSync('plugins/turnstile-modo.server.ts', 'utf8')
    expect(plugin).toContain('useState(TURNSTILE_MODO_STATE, () => resolverModoTurnstile(config.turnstileMode, config.turnstileSecret))')
    expect(readFileSync('nuxt.config.ts', 'utf8')).not.toContain('NUXT_PUBLIC_TURNSTILE_MODE')
    expect(readFileSync('composables/useTurnstile.ts', 'utf8')).toContain('limitesEspera(useState<string>(TURNSTILE_MODO_STATE')
  })
})
