import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseMemoria } from '../../../tests/helpers/supabase-memoria'

let handler: any
let body: any
let sb: ReturnType<typeof supabaseMemoria>
const enviados: any[] = []
vi.stubGlobal('defineEventHandler', (fn: any) => { handler = fn; return fn })
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
vi.stubGlobal('useRuntimeConfig', () => ({ resendApiKey: 're_x', suporteSecret: 's' }))
vi.stubGlobal('usePremiumSupabase', () => sb)
vi.stubGlobal('getClientIp', () => '200.1.2.3')
vi.stubGlobal('getHeader', () => 'Mozilla/5.0')
vi.stubGlobal('$fetch', async (_u: string, o: any) => { enviados.push(o.body) })
await import('./proposta.post')

const valido = () => ({ nome: 'Ana', empresa: 'Garagem Boa', tipo: 'Garagem', cidade: 'Recife', uf: 'PE', volume_faixa: 'até 20', whatsapp: '81988887777', email: 'ana@x.com', aceite: true, origem: 'utm_source=bing' })

describe('POST /api/empresas/proposta', () => {
  beforeEach(() => { sb = supabaseMemoria(); enviados.length = 0 })
  it('grava o lead e avisa o Cesar (nunca o lead)', async () => {
    body = valido()
    const r = await handler({})
    expect(r).toEqual({ ok: true, mensagem: 'Recebemos seu pedido. Respondemos em até 24 horas úteis.' })
    const l = sb.tab('leads_empresas')[0]
    expect(l).toMatchObject({ nome: 'Ana', empresa: 'Garagem Boa', tipo: 'Garagem', uf: 'PE', volume_faixa: 'até 20', origem: 'utm_source=bing', user_agent: 'Mozilla/5.0' })
    expect(l.ip_hash).toMatch(/^[0-9a-f]{32}$/)
    expect(JSON.stringify(l)).not.toContain('200.1.2.3')
    expect(enviados).toHaveLength(1)
    expect(enviados[0]).toMatchObject({ from: 'PlacaCompleta <contato@placacompleta.com.br>', to: ['cesarcbhering@gmail.com'], subject: 'Proposta de pacote: Garagem Boa (Garagem, até 20 por mês)', reply_to: 'ana@x.com' })
  })
  it('honeypot preenchido: responde ok e nao grava nem avisa', async () => {
    body = { ...valido(), site: 'http://spam' }
    expect((await handler({})).ok).toBe(true)
    expect(sb.tab('leads_empresas')).toHaveLength(0)
    expect(enviados).toHaveLength(0)
  })
  it('invalido: 400 com o campo', async () => {
    body = { ...valido(), aceite: false }
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400, data: { campo: 'aceite' } })
  })
})
