import { describe, it, expect, vi, beforeEach } from 'vitest'

let handler: any
let body: any
let config: any = { resendApiKey: 're_x' }
let falhar = false
const enviados: any[] = []
vi.stubGlobal('defineEventHandler', (fn: any) => { handler = fn; return fn })
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
vi.stubGlobal('useRuntimeConfig', () => config)
vi.stubGlobal('$fetch', async (_u: string, o: any) => { if (falhar) throw new Error('down'); enviados.push(o.body) })
await import('./mensagem.post')

const valido = () => ({ email: ' Ana@X.com ', telefone: '(31) 98888-7777', mensagem: 'Quero saber do relatório', pagina: 'resultado' })

describe('POST /api/contato/mensagem', () => {
  beforeEach(() => { enviados.length = 0; config = { resendApiKey: 're_x' }; falhar = false })
  it('e-mails Cesar from contato@ with reply_to set to the person', async () => {
    body = valido()
    expect(await handler({})).toEqual({ ok: true })
    expect(enviados).toHaveLength(1)
    expect(enviados[0]).toMatchObject({
      from: 'PlacaCompleta <contato@placacompleta.com.br>',
      to: ['cesar.bhering@placacompleta.com.br'],
      reply_to: 'ana@x.com',
      subject: 'Contato pelo site (resultado): ana@x.com',
    })
    expect(enviados[0].text).toContain('Telefone: 31988887777')
    expect(enviados[0].text).toContain('Quero saber do relatório')
    expect(enviados[0].text).not.toContain('—')
  })
  it('unknown page value becomes a generic category (never a raw path)', async () => {
    body = { ...valido(), pagina: '/premium/abc123' }
    await handler({})
    expect(enviados[0].subject).toBe('Contato pelo site (conteudo): ana@x.com')
    expect(enviados[0].text).not.toContain('abc123')
  })
  it('honeypot filled: answers ok and sends nothing', async () => {
    body = { ...valido(), site: 'http://spam' }
    expect(await handler({})).toEqual({ ok: true })
    expect(enviados).toHaveLength(0)
  })
  it('invalid e-mail or phone: 400 with the field', async () => {
    body = { ...valido(), email: 'ana@' }
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400, data: { campo: 'email' } })
    body = { ...valido(), telefone: '9888' }
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400, data: { campo: 'telefone' } })
    expect(enviados).toHaveLength(0)
  })
  it('message is optional', async () => {
    body = { ...valido(), mensagem: '' }
    await handler({})
    expect(enviados[0].text).toContain('Sem mensagem escrita.')
  })
  it('Resend failure or missing key: error, so the person knows it did not go', async () => {
    falhar = true
    body = valido()
    await expect(handler({})).rejects.toMatchObject({ statusCode: 502 })
    config = {}
    await expect(handler({})).rejects.toMatchObject({ statusCode: 503 })
  })
})
