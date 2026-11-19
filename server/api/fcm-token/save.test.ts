// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabaseMemoria } from '../../../tests/helpers/supabase-memoria'
import { isValidEmail, sanitizeEmail } from '../../utils/validation'

// POST /api/fcm-token/save is anonymous: only the expected fields, within the
// sizes of the table CHECK, may reach the database.

let db: ReturnType<typeof supabaseMemoria>

async function salvar(body: any) {
  const { default: handler } = await import('./save.post')
  return (handler as any)({ body })
}

const UUID = '3f0c7c4e-5d7b-4a5e-9a51-0b7d2c9e8f11'
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36'

beforeEach(() => {
  db = supabaseMemoria()
  vi.stubGlobal('defineEventHandler', (f: any) => f)
  vi.stubGlobal('readBody', async (ev: any) => ev.body)
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
  vi.stubGlobal('useSupabaseServer', () => db)
  vi.stubGlobal('isValidEmail', isValidEmail)
  vi.stubGlobal('sanitizeEmail', sanitizeEmail)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('POST /api/fcm-token/save', () => {
  it('stores what the client sends today', async () => {
    const r = await salvar({ token: UUID, userEmail: 'a@b.com', userAgent: UA, deviceInfo: 'Mobile', pushToken: 'x'.repeat(163) })
    expect(r.success).toBe(true)
    expect(db.tab('fcm_tokens')).toHaveLength(1)
    expect(db.tab('fcm_tokens')[0]).toMatchObject({ token: UUID, user_email: 'a@b.com', user_agent: UA, device_info: 'Mobile' })
  })

  it('updates an existing token without taking over its email', async () => {
    db.tab('fcm_tokens').push({ id: 'x', token: UUID, user_email: 'dono@b.com' })
    await salvar({ token: UUID, userEmail: 'outro@b.com', userAgent: UA, deviceInfo: 'Desktop' })
    expect(db.tab('fcm_tokens')).toHaveLength(1)
    expect(db.tab('fcm_tokens')[0]).toMatchObject({ user_email: 'dono@b.com', device_info: 'Desktop' })
  })

  it.each([
    ['token', { token: 'x'.repeat(257) }],
    ['userAgent', { token: UUID, userAgent: 'x'.repeat(513) }],
    ['deviceInfo', { token: UUID, deviceInfo: 'x'.repeat(65) }],
    ['pushToken', { token: UUID, pushToken: 'x'.repeat(4097) }],
  ])('refuses %s above the limit with 400 and writes nothing', async (_campo, body) => {
    await expect(salvar(body)).rejects.toMatchObject({ statusCode: 400 })
    expect(db.tab('fcm_tokens')).toHaveLength(0)
  })

  it('accepts every field exactly at the limit', async () => {
    await salvar({ token: 'x'.repeat(256), userAgent: 'x'.repeat(512), deviceInfo: 'x'.repeat(64), pushToken: 'x'.repeat(4096) })
    expect(db.tab('fcm_tokens')).toHaveLength(1)
  })

  it.each([
    ['an unexpected field', { token: UUID, extra: 'x' }],
    ['a non-string user agent', { token: UUID, userAgent: { a: 1 } }],
    ['a non-string email', { token: UUID, userEmail: ['a@b.com'] }],
    ['a missing token', { userAgent: UA }],
    ['an array body', [{ token: UUID }]],
  ])('refuses %s with 400', async (_caso, body) => {
    await expect(salvar(body)).rejects.toMatchObject({ statusCode: 400 })
    expect(db.tab('fcm_tokens')).toHaveLength(0)
  })

  it('still ignores an invalid email instead of refusing', async () => {
    await salvar({ token: UUID, userEmail: 'not-an-email' })
    expect(db.tab('fcm_tokens')[0].user_email).toBeNull()
  })
})
