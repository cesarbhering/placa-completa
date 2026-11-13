// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The bucket belongs to a visitor and a route path. The query string, the
// fragment and a trailing slash never take part in it. (h3 hands the path
// already percent-decoded, so an encoded "?" reaches the middleware as "?".)

// Documentation-only addresses (TEST-NET-3).
const VISITANTE_A = '203.0.113.10'
const VISITANTE_B = '203.0.113.20'

let limitar: (event: any) => Promise<void>
let homolog = false

function pedido(path: string, ip: string) {
  return { path, headers: { 'cf-connecting-ip': ip }, resposta: {} as Record<string, string> }
}

/** One request. Resolves with the response headers the middleware set; rejects with its 429. */
async function bater(path: string, ip = VISITANTE_A) {
  const event = pedido(path, ip)
  await limitar(event)
  return event.resposta
}

/** Sends `vezes` requests, the i-th to `caminho(i)`, and tells how many were let through. */
async function passaram(vezes: number, caminho: (i: number) => string, ip = VISITANTE_A) {
  let liberadas = 0
  for (let i = 0; i < vezes; i++) {
    try {
      await bater(caminho(i), ip)
      liberadas++
    } catch (e: any) {
      if (e?.statusCode !== 429) throw e
    }
  }
  return liberadas
}

beforeEach(async () => {
  homolog = false
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  // A fresh module per test: the buckets live in module memory.
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (f: any) => f)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { homolog } }))
  vi.stubGlobal('createError', (e: any) => Object.assign(new Error(e.message), e))
  vi.stubGlobal('getRequestHeaders', (ev: any) => ev.headers)
  vi.stubGlobal('setHeader', (ev: any, nome: string, valor: string) => { ev.resposta[nome] = valor })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  limitar = (await import('./rate-limit')).default as any
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('rate limit middleware', () => {
  it('default: 30 requests per minute for a visitor on a route, the rest is 429', async () => {
    expect(await passaram(40, () => '/api/rota-qualquer')).toBe(30)
  })

  it('allowed requests carry the quota headers', async () => {
    expect(await bater('/api/rota-qualquer')).toMatchObject({ 'X-RateLimit-Limit': '30', 'X-RateLimit-Remaining': '29' })
    expect(await bater('/api/rota-qualquer')).toMatchObject({ 'X-RateLimit-Limit': '30', 'X-RateLimit-Remaining': '28' })
  })

  it('a blocked request is told when to come back', async () => {
    await passaram(30, () => '/api/rota-qualquer')
    vi.advanceTimersByTime(20_000)
    const event = pedido('/api/rota-qualquer', VISITANTE_A)

    await expect(limitar(event)).rejects.toMatchObject({ statusCode: 429 })

    expect(event.resposta).toMatchObject({ 'X-RateLimit-Limit': '30', 'X-RateLimit-Remaining': '0', 'Retry-After': '40' })
  })

  it('the window restarts once it has elapsed', async () => {
    expect(await passaram(40, () => '/api/rota-qualquer')).toBe(30)

    vi.advanceTimersByTime(60_001)

    expect(await passaram(40, () => '/api/rota-qualquer')).toBe(30)
  })

  describe('what makes a bucket', () => {
    it('different query strings on the same route share one bucket', async () => {
      expect(await passaram(40, (i) => `/api/rota-qualquer?x=${i}`)).toBe(30)
    })

    it('with and without a query string share one bucket', async () => {
      expect(await passaram(30, () => '/api/rota-qualquer')).toBe(30)

      await expect(bater('/api/rota-qualquer?x=1')).rejects.toMatchObject({ statusCode: 429 })
    })

    it('different fragments on the same route share one bucket', async () => {
      expect(await passaram(40, (i) => `/api/rota-qualquer#${i}`)).toBe(30)
    })

    it('a trailing slash does not start another bucket', async () => {
      expect(await passaram(30, () => '/api/rota-qualquer')).toBe(30)

      await expect(bater('/api/rota-qualquer/')).rejects.toMatchObject({ statusCode: 429 })
      await expect(bater('/api/rota-qualquer/?x=1')).rejects.toMatchObject({ statusCode: 429 })
    })

    it('different routes do not share a bucket', async () => {
      expect(await passaram(40, () => '/api/rota-a')).toBe(30)

      expect(await passaram(40, () => '/api/rota-b')).toBe(30)
    })

    it('different visitors do not share a bucket', async () => {
      expect(await passaram(40, () => '/api/rota-qualquer', VISITANTE_A)).toBe(30)

      expect(await passaram(40, () => '/api/rota-qualquer', VISITANTE_B)).toBe(30)
    })
  })

  describe('per-route limits', () => {
    it.each([
      ['/api/consulta', 10],
      ['/api/empresas/proposta', 5],
      ['/api/premium/google-play/pedido', 120],
      ['/api/premium/status', 60],
      ['/api/premium/report', 60],
      ['/api/premium/foto', 120],
    ])('%s: %i requests per window, whatever the query string', async (rota, limite) => {
      expect(await bater(rota)).toMatchObject({ 'X-RateLimit-Limit': String(limite) })

      expect(await passaram(limite + 20, (i) => `${rota}?token=token-${i}`)).toBe(limite - 1)
    })

    it('an hourly limit is still closed a minute later and reopens after the hour', async () => {
      expect(await passaram(10, () => '/api/empresas/proposta')).toBe(5)

      vi.advanceTimersByTime(61_000)
      expect(await passaram(10, () => '/api/empresas/proposta')).toBe(0)

      vi.advanceTimersByTime(60 * 60 * 1000)
      expect(await passaram(10, () => '/api/empresas/proposta')).toBe(5)
    })
  })

  describe('what is never limited', () => {
    it('/api/csp-report, with or without a query string', async () => {
      expect(await passaram(200, (i) => (i % 2 ? '/api/csp-report' : `/api/csp-report?x=${i}`))).toBe(200)
      expect(await bater('/api/csp-report')).toEqual({})
    })

    it('paths outside /api/', async () => {
      expect(await passaram(200, (i) => `/premium?x=${i}`)).toBe(200)
      expect(await bater('/premium')).toEqual({})
    })

    it('homolog: every route', async () => {
      homolog = true

      expect(await passaram(200, () => '/api/consulta')).toBe(200)
      expect(await bater('/api/consulta')).toEqual({})
    })
  })

  it('the log line of a blocked request carries the route path, never the query string', async () => {
    await passaram(31, (i) => `/api/rota-qualquer?segredo=valor-secreto-${i}`)

    expect(console.warn).toHaveBeenCalledTimes(1)
    const linha = vi.mocked(console.warn).mock.calls[0]!.join(' ')
    expect(linha).toContain('/api/rota-qualquer')
    expect(linha).not.toContain('valor-secreto')
    expect(linha).not.toContain('segredo')
    expect(linha).not.toContain('?')
  })
})
