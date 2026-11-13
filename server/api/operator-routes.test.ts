// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { _resetarEmVoo } from '../utils/tarefas-em-voo'

// Every operator-only route answers 404 unless the caller sends ADMIN_SECRET in
// the x-admin-secret header, and nothing of the route runs before that check.

const SEGREDO = 'segredo-de-teste'
const ALEM_DA_GUARDA = new Error('past the guard')

const ROTAS: [string, () => Promise<any>][] = [
  ['premium/jobs/run', () => import('./premium/jobs/run.post')],
  ['premium/gcc-reserva', () => import('./premium/gcc-reserva.post')],
  ['premium/nfse/reconciliar', () => import('./premium/nfse/reconciliar.post')],
  ['premium/avaliacao/run', () => import('./premium/avaliacao/run.post')],
  ['premium/multas/backfill', () => import('./premium/multas/backfill.post')],
  ['premium/recall/backfill', () => import('./premium/recall/backfill.post')],
  ['premium/recall/agrupar-backfill', () => import('./premium/recall/agrupar-backfill.post')],
  ['premium/em-voo-teste', () => import('./premium/em-voo-teste.post')],
  ['suporte/fila', () => import('./suporte/fila.post')],
]

let config: any
const lerCorpo = vi.fn()
const banco = vi.fn()

beforeEach(() => {
  // homolog and nfse on, so the routes that also depend on them reach the secret check.
  config = { adminSecret: SEGREDO, nfse: 'on', public: { homolog: true } }
  lerCorpo.mockReset()
  lerCorpo.mockResolvedValue({ ambiente: 'homolog', desde: '2026-01-01T00:00:00.000Z', token: 'token-de-teste', segundos: 1 })
  // The database is the first thing a route reaches for after the guard.
  banco.mockReset()
  banco.mockImplementation(() => { throw ALEM_DA_GUARDA })
  vi.stubGlobal('defineEventHandler', (f: any) => f)
  vi.stubGlobal('useRuntimeConfig', () => config)
  vi.stubGlobal('createError', (e: any) => Object.assign(new Error(e.message), e))
  vi.stubGlobal('getRequestHeader', (ev: any, nome: string) => ev.headers[nome])
  vi.stubGlobal('getHeader', (ev: any, nome: string) => ev.headers[nome])
  vi.stubGlobal('readBody', lerCorpo)
  vi.stubGlobal('setResponseStatus', () => {})
  vi.stubGlobal('usePremiumSupabase', banco)
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  _resetarEmVoo()
})

describe.each(ROTAS)('POST /api/%s', (_rota, carregar) => {
  const chamar = async (headers: Record<string, string>) => ((await carregar()).default as any)({ headers })

  it.each([
    ['no header', {}],
    ['a wrong secret', { 'x-admin-secret': 'errado' }],
    ['a wrong secret of the same length', { 'x-admin-secret': 'segredo-de-testE' }],
    ['the same number of characters with a non-ASCII one', { 'x-admin-secret': 'segredo-de-testé' }],
  ])('%s: 404 and nothing runs', async (_caso, headers) => {
    await expect(chamar(headers)).rejects.toMatchObject({ statusCode: 404 })

    expect(lerCorpo).not.toHaveBeenCalled()
    expect(banco).not.toHaveBeenCalled()
  })

  it('secret not configured: 404 whatever is sent', async () => {
    config.adminSecret = ''

    await expect(chamar({})).rejects.toMatchObject({ statusCode: 404 })
    await expect(chamar({ 'x-admin-secret': '' })).rejects.toMatchObject({ statusCode: 404 })

    expect(lerCorpo).not.toHaveBeenCalled()
    expect(banco).not.toHaveBeenCalled()
  })
})

// The homolog sleep test never touches the database; it has its own case below.
describe.each(ROTAS.filter(([rota]) => rota !== 'premium/em-voo-teste'))('POST /api/%s', (_rota, carregar) => {
  it('right secret: the route runs', async () => {
    const handler = (await carregar()).default as any

    await expect(handler({ headers: { 'x-admin-secret': SEGREDO } })).rejects.toBe(ALEM_DA_GUARDA)
  })
})

describe('POST /api/premium/em-voo-teste', () => {
  const chamar = async (headers: Record<string, string>) => ((await import('./premium/em-voo-teste.post')).default as any)({ headers })

  it('right secret in homolog: the route runs', async () => {
    await import('./premium/em-voo-teste.post')
    vi.useFakeTimers()
    try {
      expect(await chamar({ 'x-admin-secret': SEGREDO })).toMatchObject({ ok: true, segundos: 1 })
      await vi.advanceTimersByTimeAsync(1000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('right secret outside homolog: 404', async () => {
    config.public.homolog = false

    await expect(chamar({ 'x-admin-secret': SEGREDO })).rejects.toMatchObject({ statusCode: 404 })

    expect(lerCorpo).not.toHaveBeenCalled()
  })
})
