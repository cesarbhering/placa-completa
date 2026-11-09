import { describe, it, expect, vi } from 'vitest'
import {
  resolverModoTurnstile,
  verificarTokenTurnstile,
  decidirTurnstile,
  linhaEventoTurnstile,
  SITEVERIFY_URL,
} from './turnstile'

const SECRET = 'test-secret'
const TOKEN = 'test-token-abc'

function respostaCf(body: any, ok = true, status = 200) {
  return vi.fn(async () => ({ ok, status, json: async () => body }))
}

describe('resolverModoTurnstile', () => {
  it('defaults to off', () => {
    expect(resolverModoTurnstile(undefined, SECRET)).toBe('off')
    expect(resolverModoTurnstile('', SECRET)).toBe('off')
    expect(resolverModoTurnstile('something', SECRET)).toBe('off')
  })

  it('accepts log and enforce (case insensitive)', () => {
    expect(resolverModoTurnstile('log', SECRET)).toBe('log')
    expect(resolverModoTurnstile('ENFORCE', SECRET)).toBe('enforce')
  })

  it('forces off when the secret is missing', () => {
    expect(resolverModoTurnstile('enforce', '')).toBe('off')
    expect(resolverModoTurnstile('log', undefined)).toBe('off')
    expect(resolverModoTurnstile('enforce', '   ')).toBe('off')
  })
})

describe('verificarTokenTurnstile', () => {
  it('posts secret, token and remoteip to siteverify', async () => {
    const f = respostaCf({ success: true })
    const r = await verificarTokenTurnstile({ token: TOKEN, secret: SECRET, ip: '203.0.113.7', fetchImpl: f })
    expect(r).toBe('ok')
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0] as any
    expect(url).toBe(SITEVERIFY_URL)
    const form = new URLSearchParams(init.body)
    expect(form.get('secret')).toBe(SECRET)
    expect(form.get('response')).toBe(TOKEN)
    expect(form.get('remoteip')).toBe('203.0.113.7')
    expect(init.signal).toBeDefined()
  })

  it('returns ausente without calling Cloudflare when there is no token', async () => {
    const f = respostaCf({ success: true })
    expect(await verificarTokenTurnstile({ token: undefined, secret: SECRET, fetchImpl: f })).toBe('ausente')
    expect(await verificarTokenTurnstile({ token: '  ', secret: SECRET, fetchImpl: f })).toBe('ausente')
    expect(f).not.toHaveBeenCalled()
  })

  it('returns invalido when Cloudflare rejects the token', async () => {
    const f = respostaCf({ success: false, 'error-codes': ['invalid-input-response'] })
    expect(await verificarTokenTurnstile({ token: TOKEN, secret: SECRET, fetchImpl: f })).toBe('invalido')
  })

  it('rejects oversized tokens without calling Cloudflare', async () => {
    const f = respostaCf({ success: true })
    expect(await verificarTokenTurnstile({ token: 'x'.repeat(3000), secret: SECRET, fetchImpl: f })).toBe('invalido')
    expect(f).not.toHaveBeenCalled()
  })

  it('treats network errors, timeouts, 5xx and internal-error as erro_siteverify', async () => {
    const rede = vi.fn(async () => { throw new Error('ECONNRESET') })
    expect(await verificarTokenTurnstile({ token: TOKEN, secret: SECRET, fetchImpl: rede })).toBe('erro_siteverify')

    const lento = vi.fn((_u: string, init: any) => new Promise<any>((_r, rej) => {
      init.signal.addEventListener('abort', () => rej(new Error('aborted')))
    }))
    expect(await verificarTokenTurnstile({ token: TOKEN, secret: SECRET, fetchImpl: lento, timeoutMs: 20 })).toBe('erro_siteverify')

    expect(await verificarTokenTurnstile({ token: TOKEN, secret: SECRET, fetchImpl: respostaCf({}, false, 503) })).toBe('erro_siteverify')

    const interno = respostaCf({ success: false, 'error-codes': ['internal-error'] })
    expect(await verificarTokenTurnstile({ token: TOKEN, secret: SECRET, fetchImpl: interno })).toBe('erro_siteverify')
  })
})

describe('decidirTurnstile', () => {
  it('off mode never calls Cloudflare and never blocks', async () => {
    const f = respostaCf({ success: false })
    const d = await decidirTurnstile({ modo: 'off', secret: SECRET, token: undefined, fetchImpl: f })
    expect(d).toEqual({ modo: 'off', resultado: null, bloquear: false })
    expect(f).not.toHaveBeenCalled()
  })

  it('missing secret forces off even when mode is enforce', async () => {
    const f = respostaCf({ success: false })
    const d = await decidirTurnstile({ modo: 'enforce', secret: '', token: undefined, fetchImpl: f })
    expect(d.modo).toBe('off')
    expect(d.bloquear).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })

  it('log mode records the outcome but never blocks', async () => {
    const semToken = await decidirTurnstile({ modo: 'log', secret: SECRET, token: undefined, fetchImpl: respostaCf({}) })
    expect(semToken).toEqual({ modo: 'log', resultado: 'ausente', bloquear: false })

    const invalido = await decidirTurnstile({ modo: 'log', secret: SECRET, token: TOKEN, fetchImpl: respostaCf({ success: false }) })
    expect(invalido).toEqual({ modo: 'log', resultado: 'invalido', bloquear: false })

    const ok = await decidirTurnstile({ modo: 'log', secret: SECRET, token: TOKEN, fetchImpl: respostaCf({ success: true }) })
    expect(ok).toEqual({ modo: 'log', resultado: 'ok', bloquear: false })
  })

  it('enforce mode blocks missing and invalid tokens', async () => {
    const semToken = await decidirTurnstile({ modo: 'enforce', secret: SECRET, token: undefined, fetchImpl: respostaCf({}) })
    expect(semToken).toEqual({ modo: 'enforce', resultado: 'ausente', bloquear: true })

    const invalido = await decidirTurnstile({ modo: 'enforce', secret: SECRET, token: TOKEN, fetchImpl: respostaCf({ success: false }) })
    expect(invalido).toEqual({ modo: 'enforce', resultado: 'invalido', bloquear: true })
  })

  it('enforce mode lets valid tokens through', async () => {
    const d = await decidirTurnstile({ modo: 'enforce', secret: SECRET, token: TOKEN, fetchImpl: respostaCf({ success: true }) })
    expect(d).toEqual({ modo: 'enforce', resultado: 'ok', bloquear: false })
  })

  it('enforce mode fails open when siteverify is unreachable', async () => {
    const rede = vi.fn(async () => { throw new Error('ENOTFOUND') })
    const d = await decidirTurnstile({ modo: 'enforce', secret: SECRET, token: TOKEN, fetchImpl: rede })
    expect(d).toEqual({ modo: 'enforce', resultado: 'erro_siteverify', bloquear: false })
  })
})

describe('linhaEventoTurnstile', () => {
  it('carries only outcome, mode and channel flags (no token, no IP)', () => {
    const linha = linhaEventoTurnstile(
      { modo: 'log', resultado: 'ausente', bloquear: false },
      { isPwa: true, isApp: false },
    )
    expect(linha).toEqual({ resultado: 'ausente', modo: 'log', bloqueado: false, is_pwa: true, is_app: false })
  })
})
