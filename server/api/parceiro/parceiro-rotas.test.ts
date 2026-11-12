import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { supabaseMemoria } from '../../../tests/helpers/supabase-memoria'

// Rotas de acesso de parceiro: resposta unica no pedido de link, cookie com as
// flags certas so quando ativa. Nenhum e-mail real aqui.

const PID = '11111111-1111-4111-8111-111111111111'
const EMAIL = 'parceiro@exemplo.invalid'
let sb: ReturnType<typeof supabaseMemoria>
let body: any
let config: any
const cookies: any[] = []
const headers: Record<string, string> = {}
const resend = vi.fn(async () => ({}))

vi.stubGlobal('defineEventHandler', (f: any) => f)
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('useRuntimeConfig', () => config)
vi.stubGlobal('useSupabaseServer', () => sb)
vi.stubGlobal('setHeader', (_e: any, k: string, v: string) => { headers[k] = v })
vi.stubGlobal('setCookie', (_e: any, n: string, v: string, o: any) => { cookies.push({ n, v, o }) })
vi.stubGlobal('getRequestHeader', () => 'placacompleta.com.br')
vi.stubGlobal('$fetch', resend)

const { default: link, RESPOSTA_LINK } = await import('./link.post')
const { default: entrar } = await import('./entrar.post')
const { _zerarCacheParceiro } = await import('../../utils/parceiro-chassi')

beforeEach(() => {
  _zerarCacheParceiro()
  sb = supabaseMemoria()
  sb.tab('parceiros_chassi').push({ id: PID, email_normalizado: EMAIL, ativo: true })
  config = { parceiroChassi: 'on', parceiroChassiSecret: 's', resendApiKey: 'k', premiumBaseUrl: 'https://placacompleta.com.br', public: {} }
  cookies.length = 0
  resend.mockClear()
})

describe('POST /api/parceiro/link', () => {
  it('mesma resposta para e-mail da lista, fora da lista e feature desligada', async () => {
    body = { email: EMAIL }
    const a = await link({} as any)
    body = { email: 'outro@exemplo.invalid' }
    const b = await link({} as any)
    config.parceiroChassi = ''
    body = { email: EMAIL }
    const c = await link({} as any)
    expect(a).toEqual({ ok: true, mensagem: RESPOSTA_LINK })
    expect(b).toEqual(a)
    expect(c).toEqual(a)
    expect(resend).toHaveBeenCalledOnce()
    const msg = (resend.mock.calls[0] as any)[1].body
    expect(msg.from).toContain('contato@placacompleta.com.br')
    expect(msg.html).toContain('/parceiro/entrar?t=')
    expect(headers['Cache-Control']).toBe('private, no-store')
  })
})

describe('POST /api/parceiro/entrar', () => {
  async function pedir() {
    body = { email: EMAIL }
    await link({} as any)
    const html = (resend.mock.calls.at(-1) as any)[1].body.html as string
    return html.match(/\/parceiro\/entrar\?t=([A-Za-z0-9_-]+)/)![1]
  }

  it('link valido grava cookie HttpOnly, Secure, SameSite=Lax, 180 dias, no dominio-mae', async () => {
    const t = await pedir()
    body = { t }
    expect(await entrar({} as any)).toEqual({ ok: true })
    expect(cookies).toHaveLength(1)
    expect(cookies[0].n).toBe('pc_parceiro')
    expect(cookies[0].o).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', maxAge: 180 * 24 * 60 * 60, domain: 'placacompleta.com.br' })
  })

  it('link reusado ou feature desligada: sem cookie', async () => {
    const t = await pedir()
    body = { t }
    await entrar({} as any)
    cookies.length = 0
    expect(await entrar({} as any)).toEqual({ ok: false })
    config.parceiroChassi = ''
    expect(await entrar({} as any)).toEqual({ ok: false })
    expect(cookies).toHaveLength(0)
  })
})

describe('consulta gratis: visitante comum nunca recebe o chassi inteiro', () => {
  const src = readFileSync('server/api/consulta.post.ts', 'utf8')

  it('o chassi inteiro so sai com a decisao de parceiro do servidor', () => {
    expect(src).toContain('chassiParcial: parceiro ? chassiDoParceiro(apiResponse) : chassiParaExibicao(apiResponse),')
    expect(src).toContain('data: isPWA ? (parceiro ? apiResponse : comChassiParcial(apiResponse)) : undefined,')
    expect(src).toMatch(/const parceiro = await decidirParceiro\(\{[\s\S]*?cookie: getCookie\(event, PARCEIRO_COOKIE\)/)
    expect(src).toContain("if (parceiro) setHeader(event, 'Cache-Control', 'private, no-store')")
  })

  it('so o parceiro pula o gate e o limite gratis; Turnstile vem antes', () => {
    expect(src).toMatch(/const hourlyLimit = parceiro\s*\n\s*\? Infinity/)
    expect(src.indexOf('await decidirTurnstile(')).toBeLessThan(src.indexOf('await decidirParceiro('))
    expect(src.indexOf('await decidirParceiro(')).toBeLessThan(src.indexOf('await avaliarGateEmail('))
  })
})
