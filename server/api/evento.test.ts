import { describe, it, expect, vi, beforeEach } from 'vitest'

let handler: any
let body: any
let headers: Record<string, string>
let status: number | null
let gravadas: any[]
vi.stubGlobal('defineEventHandler', (fn: any) => { handler = fn; return fn })
vi.stubGlobal('setResponseStatus', (_e: any, s: number) => { status = s })
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('getHeader', (_e: any, nome: string) => headers[nome.toLowerCase()])
vi.stubGlobal('useRuntimeConfig', () => ({ premiumSupabaseUrl: 'https://x.supabase.co', premiumSupabaseKey: 'k', funilIpSalt: 'sal' }))
vi.stubGlobal('usePremiumSupabase', () => ({ from: (t: string) => ({ insert: async (linhas: any[]) => { expect(t).toBe('eventos_funil'); gravadas.push(...linhas); return { error: null } } }) }))
vi.mock('../utils/client-ip', () => ({ getClientIp: () => '200.1.2.3' }))
vi.mock('../utils/dispositivo', () => ({ getDispositivo: () => ({ dispositivo: 'computador', sistema: 'linux', canal: 'web', app_versao: null }) }))
await import('./evento.post')

const lote = () => ({ eventos: [{ evento: 'resultado_exibido', placa: 'ABC1D23' }] })

describe('POST /api/evento: sonda do checkout', () => {
  beforeEach(() => { gravadas = []; headers = {}; status = null; body = lote() })

  it('sem o cabecalho: grava o evento no funil', async () => {
    expect(await handler({})).toBeNull()
    expect(status).toBe(204)
    expect(gravadas).toHaveLength(1)
    expect(gravadas[0]).toMatchObject({ evento: 'resultado_exibido', dispositivo: 'computador' })
  })

  it('com x-pc-sonda: 1: responde 204 e nao grava nada', async () => {
    headers = { 'x-pc-sonda': '1' }
    expect(await handler({})).toBeNull()
    expect(status).toBe(204)
    expect(gravadas).toHaveLength(0)
  })

  it('cabecalho com outro valor nao conta como sonda', async () => {
    headers = { 'x-pc-sonda': '0' }
    await handler({})
    expect(gravadas).toHaveLength(1)
  })

  it('fail-open: getHeader que lanca nao quebra a resposta', async () => {
    vi.stubGlobal('getHeader', () => { throw new Error('boom') })
    expect(await handler({})).toBeNull()
    expect(status).toBe(204)
    vi.stubGlobal('getHeader', (_e: any, nome: string) => headers[nome.toLowerCase()])
  })
})
