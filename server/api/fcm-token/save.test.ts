import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabaseMemoria } from '../../../tests/helpers/supabase-memoria'

// POST /api/fcm-token/save is anonymous and writes what the client sends into
// fcm_tokens. Every field has a size ceiling before it reaches the database.
let sb: ReturnType<typeof supabaseMemoria>
let handler: (event: any) => Promise<any>
const TOKEN = 'tokenFicticioDePush-0001'
const linhas = () => sb.tab('fcm_tokens')
const salvar = (corpo: any) => handler({ corpo })
const erro = async (corpo: any) => { try { await salvar(corpo); return null } catch (e: any) { return e } }

beforeEach(async () => {
  vi.resetModules()
  sb = supabaseMemoria()
  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('readBody', async (event: any) => event.corpo)
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
  vi.stubGlobal('useSupabaseServer', () => sb)
  const validacao = await import('../../utils/validation')
  vi.stubGlobal('isValidEmail', validacao.isValidEmail)
  vi.stubGlobal('sanitizeEmail', validacao.sanitizeEmail)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  handler = (await import('./save.post')).default as any
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('POST /api/fcm-token/save', () => {
  it('saves a normal registration as before', async () => {
    const r = await salvar({ token: TOKEN, userEmail: 'pessoa@example.com', userAgent: 'Mozilla/5.0 test', deviceInfo: 'Mobile' })
    expect(r).toEqual({ success: true, message: 'Token salvo com sucesso' })
    expect(linhas()[0]).toMatchObject({ token: TOKEN, user_email: 'pessoa@example.com', user_agent: 'Mozilla/5.0 test', device_info: 'Mobile' })
  })

  it('updates an existing token and never replaces its e-mail', async () => {
    await salvar({ token: TOKEN, userEmail: 'pessoa@example.com', userAgent: 'a', deviceInfo: 'Mobile' })
    const r = await salvar({ token: TOKEN, userEmail: 'outra@example.com', userAgent: 'b', deviceInfo: 'Desktop' })
    expect(r).toEqual({ success: true, message: 'Token atualizado' })
    expect(linhas()).toHaveLength(1)
    expect(linhas()[0]).toMatchObject({ user_email: 'pessoa@example.com', user_agent: 'b', device_info: 'Desktop' })
  })

  it('refuses a token above the ceiling, or one that is not a plain string', async () => {
    for (const token of ['t'.repeat(1025), '', '   ', null, undefined, 42, { a: 1 }, ['x'], 'com espaco\ne quebra']) {
      const e = await erro({ token, userAgent: 'a', deviceInfo: 'Mobile' })
      expect(e?.statusCode, JSON.stringify(token)?.slice(0, 30)).toBe(400)
    }
    expect(linhas()).toHaveLength(0)
  })

  it('a token at the ceiling is accepted', async () => {
    expect((await salvar({ token: 't'.repeat(1024), userAgent: 'a', deviceInfo: 'Mobile' })).success).toBe(true)
  })

  it('user agent and device info are trimmed to their ceilings', async () => {
    await salvar({ token: TOKEN, userAgent: 'u'.repeat(5000), deviceInfo: 'd'.repeat(5000) })
    expect(linhas()[0].user_agent).toHaveLength(300)
    expect(linhas()[0].device_info).toHaveLength(100)
  })

  it('user agent and device info that are not text are stored as null, on insert and on update', async () => {
    await salvar({ token: TOKEN, userAgent: { $ne: null }, deviceInfo: ['Mobile'] })
    expect(linhas()[0]).toMatchObject({ user_agent: null, device_info: null })
    await salvar({ token: TOKEN, userAgent: 12345, deviceInfo: { a: 'b'.repeat(9000) } })
    expect(linhas()[0]).toMatchObject({ user_agent: null, device_info: null })
  })

  it('an e-mail that is not valid is ignored, as before', async () => {
    await salvar({ token: TOKEN, userEmail: 'x'.repeat(400), userAgent: 'a', deviceInfo: 'Mobile' })
    expect(linhas()[0].user_email).toBeNull()
  })
})
