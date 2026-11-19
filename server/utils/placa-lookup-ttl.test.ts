// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'

// The found-plate cache lives 90 days for new lookups (aligned with the
// pruning of pc-supabase-arquivar), but a report already sold keeps reading
// the engine number and the logo from the cache whatever its age, without
// calling any source.
const placafipe = vi.fn()
vi.mock('./placafipe', () => ({ consultarPlacaFipe: (...a: any[]) => placafipe(...a) }))
vi.mock('./api-chamadas', () => ({ registrarChamada: () => {} }))

let db: ReturnType<typeof supabaseMemoria>
const DIA = 24 * 60 * 60 * 1000
const PAYLOAD = { marca: 'X', logo: 'https://logo.test/x.png', extra: { motor: 'MTR123' } }

beforeEach(() => {
  db = supabaseMemoria()
  placafipe.mockReset()
  placafipe.mockResolvedValue({ tipo: 'ok', payload: { marca: 'NOVA' } })
  vi.stubGlobal('useSupabaseServer', () => db)
  vi.stubGlobal('useRuntimeConfig', () => ({ placafipeToken: 'token-de-teste', placaApiToken: '' }))
})
afterEach(() => vi.unstubAllGlobals())

function cache(dias: number, encontrado = true) {
  db.tab('placa_cache').push({ placa: 'ABC1D23', payload: PAYLOAD, encontrado, fetched_at: new Date(Date.now() - dias * DIA).toISOString() })
}

describe('placa_cache TTL', () => {
  it('a free lookup serves a found plate fetched 89 days ago from the cache', async () => {
    cache(89)
    const { consultarPlacaDetalhado } = await import('./placa-lookup')
    const r = await consultarPlacaDetalhado('ABC-1D23')
    expect(r.fonte).toBe('cache')
    expect(placafipe).not.toHaveBeenCalled()
  })

  it('a free lookup fetches again a found plate fetched 91 days ago', async () => {
    cache(91)
    const { consultarPlacaDetalhado } = await import('./placa-lookup')
    const r = await consultarPlacaDetalhado('ABC-1D23')
    expect(r.fonte).toBe('placafipe')
    expect(placafipe).toHaveBeenCalledTimes(1)
  })

  it('the fresh-cache reader of the checkout ignores a found plate of 91 days', async () => {
    cache(91)
    const { lerPlacaCacheFresca } = await import('./placa-lookup')
    expect(await lerPlacaCacheFresca('ABC1D23')).toBeNull()
  })

  it('a paid report still reads the engine and the logo from a cache of 120 days, without any source', async () => {
    cache(120)
    const { lerPlacaCacheParaRelatorio, motorDoPayload } = await import('./placa-lookup')
    const c = await lerPlacaCacheParaRelatorio('ABC-1D23')
    expect(motorDoPayload(c)).toBe('MTR123')
    expect(c.logo).toBe('https://logo.test/x.png')
    expect(placafipe).not.toHaveBeenCalled()
  })

  it('the report reader never serves a not-found plate', async () => {
    cache(0, false)
    const { lerPlacaCacheParaRelatorio } = await import('./placa-lookup')
    expect(await lerPlacaCacheParaRelatorio('ABC1D23')).toBeNull()
  })
})
