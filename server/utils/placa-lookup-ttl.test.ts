// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'

// The found-plate cache lives 90 days (aligned with the pruning of
// pc-supabase-arquivar): a row of 89 days is served, one of 91 is not.
let db: ReturnType<typeof supabaseMemoria>
const DIA = 24 * 60 * 60 * 1000

beforeEach(() => {
  db = supabaseMemoria()
  vi.stubGlobal('useSupabaseServer', () => db)
})
afterEach(() => vi.unstubAllGlobals())

async function fresca(dias: number, encontrado = true) {
  db.tab('placa_cache').push({ placa: 'ABC1D23', payload: { marca: 'X' }, encontrado, fetched_at: new Date(Date.now() - dias * DIA).toISOString() })
  const { lerPlacaCacheFresca } = await import('./placa-lookup')
  return lerPlacaCacheFresca('ABC-1D23')
}

describe('placa_cache TTL', () => {
  it('serves a found plate fetched 89 days ago', async () => {
    expect(await fresca(89)).toEqual({ marca: 'X' })
  })
  it('does not serve a found plate fetched 91 days ago', async () => {
    expect(await fresca(91)).toBeNull()
  })
  it('never serves a not-found plate from this reader', async () => {
    expect(await fresca(0, false)).toBeNull()
  })
})
