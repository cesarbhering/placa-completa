import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Internal alert e-mails are text. The message is built by ~20 callers, many
// with text that came from a client (e-mail, origin, plate, order id) or from
// a provider response, so it is escaped in ONE place (sendErrorEmail) and line
// breaks are turned into <br> there. Callers send plain text with \n.
const MARCACAO = '<img src="https://example.test/x.png" onerror="x()">'
const PROD = { public: { gated: false }, supabaseUrl: 'https://prod.example.test', resendApiKey: 're_test' }

let enviados: any[] = []
async function carregar() {
  vi.resetModules()
  enviados = []
  vi.stubGlobal('useRuntimeConfig', () => PROD)
  vi.doMock('resend', () => ({ Resend: class { emails = { send: async (m: any) => { enviados.push(m) } } } }))
  return await import('./sendErrorEmail')
}

beforeEach(() => { vi.stubEnv('NODE_ENV', 'test') })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.doUnmock('resend') })

describe('sendErrorEmail: the message is text, never markup', () => {
  it('markup in the message arrives escaped', async () => {
    const { sendErrorEmail } = await carregar()
    await sendErrorEmail({ endpoint: '/api/x', errorMessage: `Failed to send email to ${MARCACAO}: boom` })
    const html = enviados[0].html as string
    expect(html).not.toContain(MARCACAO)
    expect(html).not.toContain('<img')
    expect(html).toContain('Failed to send email to &lt;img src=&quot;https://example.test/x.png&quot; onerror=&quot;x()&quot;&gt;: boom')
  })

  it('line breaks in the message become <br>, in any newline flavour', async () => {
    const { sendErrorEmail } = await carregar()
    await sendErrorEmail({ endpoint: '/api/x', errorMessage: 'first\nsecond\r\nthird\rfourth' })
    expect(enviados[0].html).toContain('<div class="value">first<br>second<br>third<br>fourth</div>')
  })

  it('a caller that still sends <br> shows it as text (no markup accepted from callers)', async () => {
    const { sendErrorEmail } = await carregar()
    await sendErrorEmail({ endpoint: '/api/x', errorMessage: 'a<br>b' })
    expect(enviados[0].html).toContain('a&lt;br&gt;b')
  })

  it('a message that is not a string does not lose the alert', async () => {
    const { sendErrorEmail } = await carregar()
    await sendErrorEmail({ endpoint: '/api/x', errorMessage: undefined as any })
    await sendErrorEmail({ endpoint: '/api/x', errorMessage: { a: 1 } as any })
    expect(enviados).toHaveLength(2)
  })
})

describe('sendErrorEmail: the other fields of the template', () => {
  it('endpoint, IP, user agent, stack and timestamp are escaped', async () => {
    const { sendErrorEmail } = await carregar()
    await sendErrorEmail({
      endpoint: `/api/x ${MARCACAO}`,
      errorMessage: 'm',
      errorStack: `Error: ${MARCACAO}\n    at f (file.ts:1:1)`,
      userAgent: MARCACAO,
      ip: MARCACAO,
      timestamp: MARCACAO,
    })
    const html = enviados[0].html as string
    expect(html).not.toContain(MARCACAO)
    expect(html).not.toContain('<img')
    expect(html.match(/&lt;img src=/g)?.length).toBe(5)
  })

  it('the request body is escaped inside the <pre>, and the e-mail is still masked', async () => {
    const { sendErrorEmail } = await carregar()
    await sendErrorEmail({
      endpoint: '/api/x',
      errorMessage: 'm',
      requestBody: { placa: 'TST1A23', isPWA: `</pre>${MARCACAO}`, email: 'pessoa@example.com' },
    })
    const html = enviados[0].html as string
    expect(html).not.toContain(MARCACAO)
    expect(html).not.toContain('</pre><img')
    expect(html).toContain('&quot;isPWA&quot;: &quot;&lt;/pre&gt;&lt;img src=')
    expect(html).toContain('pe***@example.com')
    expect(html).not.toContain('pessoa@example.com')
  })

  it('a request body that cannot be masked or serialized does not lose the alert', async () => {
    const { sendErrorEmail } = await carregar()
    const circular: any = { email: { not: 'a string' }, image: 42 }
    circular.self = circular
    await sendErrorEmail({ endpoint: '/api/x', errorMessage: 'still sent', requestBody: circular })
    expect(enviados).toHaveLength(1)
    expect(enviados[0].html).toContain('still sent')
  })

  it('the subject is one line, whatever the endpoint text is', async () => {
    const { sendErrorEmail } = await carregar()
    await sendErrorEmail({ endpoint: '/api/x\r\nBcc: someone@example.com', errorMessage: 'm' })
    expect(enviados[0].subject).not.toMatch(/[\r\n]/)
    expect(enviados[0].subject).toMatch(/^\[Erro API\] \/api\/x Bcc: someone@example\.com - /)
  })

  it('a plain alert keeps the same layout as before', async () => {
    const { sendErrorEmail } = await carregar()
    await sendErrorEmail({ endpoint: '/premium/processar', errorMessage: 'ESTORNO AUTOMATICO | pedido=abc | placa=TST1A23', ip: '203.0.113.9', timestamp: '2026-09-22T17:30:00.000Z' })
    const html = enviados[0].html as string
    expect(html).toContain('<div class="value">22/09/2026, 14:30:00 BRT</div>')
    expect(html).toContain('<div class="value"><span class="code">/premium/processar</span></div>')
    expect(html).toContain('<div class="value">ESTORNO AUTOMATICO | pedido=abc | placa=TST1A23</div>')
    expect(html).toContain('<div class="value">203.0.113.9</div>')
    expect(enviados[0].to).toEqual(['erros@placacompleta.com.br'])
  })
})

describe('real caller: the abuse alert carries client text', () => {
  it('an e-mail typed by the client arrives escaped, one line per fact', async () => {
    const { sendErrorEmail } = await carregar()
    vi.stubGlobal('sendErrorEmail', sendErrorEmail)
    const { avisarAbuso } = await import('./alerta-abuso')
    await avisarAbuso({ ip: '203.0.113.9', rota: '/api/consulta', teto: 5, email: `x${MARCACAO}@example.com`, userAgent: MARCACAO, bloqueiosNaHora: 7 })
    expect(enviados).toHaveLength(1)
    const html = enviados[0].html as string
    expect(html).not.toContain(MARCACAO)
    expect(html).toContain('IP 203.0.113.9 bateu o teto de 5 consultas por hora.<br>E-mail informado: x&lt;img src=')
    expect(html).toContain('<br>Bloqueios deste IP na ultima hora: 7.<br>')
  })
})

// Guard for the callers: with the message escaped, an HTML line break written
// by a caller would show up as literal text in the alert.
describe('callers send plain text', () => {
  function arquivos(dir: string): string[] {
    return readdirSync(dir).flatMap((nome) => {
      const caminho = join(dir, nome)
      if (statSync(caminho).isDirectory()) return arquivos(caminho)
      return /\.ts$/.test(nome) && !/\.test\.ts$/.test(nome) ? [caminho] : []
    })
  }

  it('no caller builds the message with HTML tags', () => {
    const culpados: string[] = []
    for (const arquivo of arquivos('server')) {
      if (arquivo.endsWith('sendErrorEmail.ts')) continue
      const src = readFileSync(arquivo, 'utf8')
      let i = -1
      while ((i = src.indexOf('sendErrorEmail(', i + 1)) !== -1) {
        // The call and its arguments: up to the next blank line or 1500 chars.
        const trecho = src.slice(i, i + 1500).split(/\n\s*\n/)[0]
        if (/<br\s*\/?>|<\/?(b|strong|p|div|span|a|code|pre)[\s>]/i.test(trecho)) culpados.push(arquivo)
      }
    }
    expect(culpados).toEqual([])
  })
})
