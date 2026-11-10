import { describe, it, expect, vi } from 'vitest'
import {
  resolverModoTurnstile,
  verificarTokenTurnstile,
  decidirTurnstile,
  linhaEventoTurnstile,
  sanearMotivoTurnstile,
  sanearEsperaTurnstile,
  gravarEventoTurnstile,
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
    expect(linha).toEqual({ resultado: 'ausente', modo: 'log', bloqueado: false, is_pwa: true, is_app: false, motivo: null, espera_ms: null })
  })

  it('records the client reason only when the token is missing, plus the wait time', () => {
    expect(linhaEventoTurnstile({ modo: 'log', resultado: 'ausente', bloquear: false }, { isPwa: false, isApp: true, motivo: 'interacao', esperaMs: 25010.4 }))
      .toMatchObject({ motivo: 'interacao', espera_ms: 25010 })
    expect(linhaEventoTurnstile({ modo: 'log', resultado: 'ok', bloquear: false }, { isPwa: false, isApp: false, motivo: 'timeout', esperaMs: 0 }))
      .toMatchObject({ motivo: null, espera_ms: 0 })
  })
})

describe('client reason and wait sanitizing', () => {
  it('accepts only known reasons and numeric error codes', () => {
    for (const ok of ['timeout', 'interacao', 'sem_script', 'sem_widget', 'erro_300030', 'erro_x']) expect(sanearMotivoTurnstile(ok)).toBe(ok)
    for (const ruim of ['', 'TIMEOUT', 'erro_abc', 'erro_1234567', '<script>', 42, null, 'x'.repeat(30)]) expect(sanearMotivoTurnstile(ruim)).toBeNull()
  })
  it('clamps the wait to 0..60 s and drops junk', () => {
    expect(sanearEsperaTurnstile(1234.6)).toBe(1235)
    expect(sanearEsperaTurnstile(999_999)).toBe(60_000)
    expect(sanearEsperaTurnstile(-1)).toBeNull()
    expect(sanearEsperaTurnstile('100')).toBeNull()
    expect(sanearEsperaTurnstile(Number.NaN)).toBeNull()
  })
})

describe('gravarEventoTurnstile', () => {
  const sb = (falhaColuna: boolean) => {
    const inserts: any[] = []
    return {
      inserts,
      from: () => ({
        insert: async (row: any) => {
          inserts.push(row)
          if (falhaColuna && 'motivo' in row) return { error: { message: "Could not find the 'motivo' column of 'turnstile_eventos'" } }
          return { error: null }
        },
      }),
    }
  }
  const linha = { resultado: 'ausente', modo: 'log', bloqueado: false, is_pwa: false, is_app: false, motivo: 'timeout', espera_ms: 8000 }
  it('inserts the full row when the columns exist', async () => {
    const s = sb(false)
    await gravarEventoTurnstile(s, linha)
    expect(s.inserts).toEqual([linha])
  })
  it('retries without the new columns before the migration runs', async () => {
    const s = sb(true)
    await gravarEventoTurnstile(s, linha)
    expect(s.inserts).toHaveLength(2)
    expect(s.inserts[1]).toEqual({ resultado: 'ausente', modo: 'log', bloqueado: false, is_pwa: false, is_app: false })
  })
})
