import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { supabaseMemoria } from '../../../tests/helpers/supabase-memoria'

// The paid preview shares the per-IP cap with the free lookup (same count:
// consultas + wdapi_preview_calls), so it shares the in-flight reservation too.
const IP = '203.0.113.10'

let sb: ReturnType<typeof supabaseMemoria>
let chamadasPagas = 0
let handler: (event: any) => Promise<any>

async function montar(atrasoMs = 20) {
  vi.resetModules()
  chamadasPagas = 0
  const agora = () => ({ created_at: new Date().toISOString() })
  sb = supabaseMemoria({ padroes: { consultas: agora, wdapi_preview_calls: agora, blocked_requests: agora } })
  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('assertPremiumGate', () => {})
  vi.stubGlobal('readBody', async (event: any) => event.corpo)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { homolog: false } }))
  vi.stubGlobal('getRequestHeaders', (event: any) => event.cabecalhos || {})
  vi.stubGlobal('getRequestHeader', (event: any, nome: string) => (event.cabecalhos || {})[nome])
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
  vi.stubGlobal('useSupabaseServer', () => sb)
  vi.stubGlobal('usePremiumSupabase', () => supabaseMemoria())
  vi.stubGlobal('avisarAbuso', async () => {})
  vi.stubGlobal('contarBloqueiosNaHora', async () => 0)
  vi.stubGlobal('consultarPlacaWdapi', async (placa: string) => {
    chamadasPagas++
    await new Promise((r) => setTimeout(r, atrasoMs))
    return { MARCA: 'MARCA', MODELO: 'MODELO TESTE', anoModelo: '2021', cor: 'Prata', placa }
  })
  vi.doMock('~/server/utils/supabase', () => ({ useSupabaseServer: () => sb }))
  const { getClientIp } = await import('~/server/utils/client-ip')
  const { estaBloqueado } = await import('~/server/utils/blocklist')
  const limite = await import('~/server/utils/ip-wdapi-limit')
  vi.stubGlobal('getClientIp', getClientIp)
  vi.stubGlobal('estaBloqueado', estaBloqueado)
  vi.stubGlobal('checarLimiteIpWdapi', limite.checarLimiteIpWdapi)
  vi.stubGlobal('registrarChamadaPreviewWdapi', limite.registrarChamadaPreviewWdapi)
  handler = (await import('./preview.post')).default as any
}

const chamar = (placa: string, ip = IP) => handler({ corpo: { placa }, cabecalhos: { 'cf-connecting-ip': ip, 'user-agent': 'Mozilla/5.0 test' } })
const placa = (i: number) => `TST0A${String(i).padStart(2, '0')}`
const codigos = (rs: PromiseSettledResult<any>[]) => rs.map((r) => (r.status === 'fulfilled' ? 200 : r.reason?.statusCode))

beforeEach(() => montar())
afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock('~/server/utils/supabase') })

describe('paid preview: per-IP cap with simultaneous requests', () => {
  it('10 previews at once from one IP with cap 5 spend at most 5 paid calls', async () => {
    const rs = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => chamar(placa(i))))
    const c = codigos(rs)
    expect(chamadasPagas).toBe(5)
    expect(c.filter((x) => x === 200)).toHaveLength(5)
    expect(c.filter((x) => x === 429)).toHaveLength(5)
    expect(sb.tab('wdapi_preview_calls')).toHaveLength(5)
  })

  it('free lookups already counted and previews in flight add up', async () => {
    for (let i = 0; i < 3; i++) sb.tab('consultas').push({ ip_address: IP, created_at: new Date(Date.now() - 600_000).toISOString() })
    const rs = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => chamar(placa(i))))
    expect(chamadasPagas).toBe(2)
    expect(codigos(rs).filter((x) => x === 429)).toHaveLength(4)
  })

  it('one preview after another is never counted twice: 5 pass, the 6th is blocked', async () => {
    for (let i = 0; i < 5; i++) expect((await chamar(placa(i))).encontrado).toBe(true)
    await expect(chamar(placa(9))).rejects.toMatchObject({ statusCode: 429 })
    expect(chamadasPagas).toBe(5)
  })

  it('a plate already in the cache costs nothing and takes no slot, as before', async () => {
    sb.tab('placa_cache').push({ placa: 'TST0B00', payload: { MARCA: 'MARCA', MODELO: 'X' }, encontrado: true, fetched_at: new Date().toISOString() })
    const rs = await Promise.allSettled(Array.from({ length: 10 }, () => chamar('TST0B00')))
    expect(codigos(rs).every((x) => x === 200)).toBe(true)
    expect(chamadasPagas).toBe(0)
    for (let i = 0; i < 5; i++) expect((await chamar(placa(i))).encontrado).toBe(true)
  })

  it('a failed write of the counting row gives the slot back instead of holding it', async () => {
    const original = sb.from
    sb.from = ((tabela: string) => {
      const b = original(tabela)
      if (tabela === 'wdapi_preview_calls') b.insert = () => ({ then: (ok: any) => Promise.resolve({ error: { message: 'db down' } }).then(ok) })
      return b
    }) as any
    for (let i = 0; i < 8; i++) expect((await chamar(placa(i))).encontrado).toBe(true)
  })
})
