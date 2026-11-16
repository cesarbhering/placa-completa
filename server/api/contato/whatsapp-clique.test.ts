import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let handler: any
let body: any
let headers: Record<string, string> = {}
let config: any = { resendApiKey: 're_x' }
let falhar = false
const enviados: any[] = []
const status: number[] = []
vi.mock('../../utils/client-ip', () => ({ getClientIp: (e: any) => e.ip }))
vi.stubGlobal('defineEventHandler', (fn: any) => { handler = fn; return fn })
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('getHeader', (_e: any, nome: string) => headers[nome.toLowerCase()])
vi.stubGlobal('setResponseStatus', (_e: any, s: number) => { status.push(s) })
vi.stubGlobal('useRuntimeConfig', () => config)
vi.stubGlobal('$fetch', async (_u: string, o: any) => { if (falhar) throw new Error('down'); enviados.push(o.body) })
const mod: any = await import('./whatsapp-clique.post')

const CELULAR = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
const ev = (ip = '200.1.1.1') => ({ ip })

describe('POST /api/contato/whatsapp-clique', () => {
  beforeEach(() => {
    enviados.length = 0; status.length = 0; falhar = false
    headers = { 'user-agent': CELULAR }
    body = { onde: 'flutuante', pagina: 'home', origem: 'bing' }
    config = { resendApiKey: 're_x' }
    mod._zerarAvisoWhatsapp()
  })
  afterEach(() => { vi.useRealTimers() })

  it('e-mails Cesar from contato@ and answers 204', async () => {
    expect(await handler(ev())).toBeNull()
    expect(status).toContain(204)
    expect(enviados).toHaveLength(1)
    expect(enviados[0]).toMatchObject({
      from: 'PlacaCompleta <contato@placacompleta.com.br>',
      to: ['cesar.bhering@placacompleta.com.br'],
      subject: 'Clique no WhatsApp do site: botão flutuante',
    })
    expect(enviados[0].text).toContain('Aparelho: celular')
    expect(enviados[0].text).toContain('Origem: anúncio do Bing')
  })

  it('probe, bot or empty user agent, and invalid body: 204 and no e-mail', async () => {
    headers = { 'user-agent': CELULAR, 'x-pc-sonda': '1' }
    await handler(ev('200.1.1.2'))
    headers = { 'user-agent': 'Mozilla/5.0 (compatible; bingbot/2.0)' }
    await handler(ev('200.1.1.3'))
    headers = {}
    await handler(ev('200.1.1.4'))
    headers = { 'user-agent': CELULAR }
    body = { onde: 'qualquer' }
    await handler(ev('200.1.1.5'))
    expect(enviados).toHaveLength(0)
    expect(status.every((s) => s === 204)).toBe(true)
  })

  it('same visitor within 10 minutes sends one e-mail; another visitor or 10 minutes later sends again', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-16T15:00:00Z'))
    await handler(ev())
    await handler(ev())
    expect(enviados).toHaveLength(1)
    await handler(ev('200.1.1.9'))
    expect(enviados).toHaveLength(2)
    vi.setSystemTime(new Date('2026-11-16T15:10:01Z'))
    await handler(ev())
    expect(enviados).toHaveLength(3)
  })

  it('stops at 40 e-mails per hour', async () => {
    for (let i = 0; i < 45; i++) await handler(ev(`200.1.2.${i}`))
    expect(enviados).toHaveLength(40)
  })

  it('no Resend key or Resend down: the visitor never gets an error', async () => {
    config = {}
    await expect(handler(ev())).resolves.toBeNull()
    expect(enviados).toHaveLength(0)
    mod._zerarAvisoWhatsapp()
    config = { resendApiKey: 're_x' }
    falhar = true
    await expect(handler(ev())).resolves.toBeNull()
  })
})
