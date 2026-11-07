import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseMemoria } from '../../../../tests/helpers/supabase-memoria'
import { ehIdIntencao } from '../../../../shared/intencao-play'

const barrar = vi.fn()
vi.mock('../../../utils/blocklist', () => ({ barrarPlacaBloqueada: (...a: any[]) => barrar(...a) }))

let body: any
let sb: ReturnType<typeof supabaseMemoria>
const gate = vi.fn()
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
vi.stubGlobal('assertPremiumGate', gate)
vi.stubGlobal('usePremiumSupabase', () => sb)
vi.stubGlobal('defineEventHandler', (fn: any) => fn)
const handler = (await import('./intencao.post')).default

const intencoes = () => sb.tab('google_play_intencoes')

describe('POST /api/premium/google-play/intencao', () => {
  beforeEach(() => {
    sb = supabaseMemoria()
    gate.mockClear()
    barrar.mockReset()
  })

  it('stores normalized plate and e-mail and returns an opaque id', async () => {
    body = { placa: 'abc-1d23', email: '  Test@Example.com ' }
    const r = await handler({})
    expect(Object.keys(r)).toEqual(['id'])
    expect(ehIdIntencao(r.id)).toBe(true)
    expect(r.id.length).toBeLessThanOrEqual(64)
    expect(r.id).not.toMatch(/ABC1D23|example/i)
    expect(intencoes()).toHaveLength(1)
    expect(intencoes()[0]).toMatchObject({ id: r.id, placa: 'ABC1D23', email: 'test@example.com' })
    expect(gate).toHaveBeenCalledOnce()
    expect(barrar).toHaveBeenCalledWith({}, 'ABC1D23', 'test@example.com')
  })

  it('returns a different id on each call', async () => {
    body = { placa: 'ABC1D23', email: 'a@b.com' }
    const a = await handler({})
    const b = await handler({})
    expect(a.id).not.toBe(b.id)
  })

  it.each([
    [{ placa: 'ABC1D23', email: '' }],
    [{ placa: 'ABC1D23' }],
    [{ placa: 'ABC1D23', email: 'not-an-email' }],
    [{ placa: 'ABC1D23', email: 'a@b' }],
    [{ placa: 'ABC1D23', email: `${'x'.repeat(200)}@b.com` }],
  ])('rejects a missing or invalid e-mail with 400 (%o)', async (b) => {
    body = b
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
    expect(intencoes()).toHaveLength(0)
  })

  it('rejects an invalid plate with 400', async () => {
    body = { placa: 'AB12', email: 'a@b.com' }
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
    expect(intencoes()).toHaveLength(0)
  })

  it('blocked plate is refused before anything is stored', async () => {
    barrar.mockImplementation(() => { throw Object.assign(new Error('bloqueada'), { statusCode: 403 }) })
    body = { placa: 'ABC1D23', email: 'a@b.com' }
    await expect(handler({})).rejects.toMatchObject({ statusCode: 403 })
    expect(intencoes()).toHaveLength(0)
  })

  it('database failure returns 500 with a retry message', async () => {
    body = { placa: 'ABC1D23', email: 'a@b.com' }
    sb = { from: () => ({ insert: async () => ({ error: { message: 'down' } }) }) } as any
    await expect(handler({})).rejects.toMatchObject({ statusCode: 500 })
  })
})
