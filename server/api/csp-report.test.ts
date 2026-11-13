import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'node:stream'

// POST /api/csp-report takes reports from any browser, with no authentication
// and outside the global rate limit (it must always answer 204). What it reads
// and what it logs are therefore bounded: at most 16 KiB of body, and a short
// single-line log entry.
const LIMITE = 16 * 1024
let handler: (event: any) => Promise<any>
let status: number | undefined
let avisos: string[][]
let ipSeq = 0
let leiturasSemTeto = 0

beforeEach(async () => {
  vi.resetModules()
  status = undefined
  avisos = []
  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('getRequestHeaders', (event: any) => event.node.req.headers)
  vi.stubGlobal('getRequestHeader', (event: any, nome: string) => event.node.req.headers[nome])
  vi.stubGlobal('setResponseStatus', (_e: any, s: number) => { status = s })
  // The framework's reader has no ceiling: it buffers the whole body. The
  // handler must not go through it.
  leiturasSemTeto = 0
  vi.stubGlobal('readBody', async (event: any) => {
    leiturasSemTeto++
    const partes: Buffer[] = []
    for await (const p of event.node.req) partes.push(Buffer.from(p))
    return JSON.parse(Buffer.concat(partes).toString('utf8'))
  })
  vi.spyOn(console, 'warn').mockImplementation((...a: any[]) => { avisos.push(a.map(String)) })
  handler = (await import('./csp-report.post')).default as any
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

/**
 * A request whose body arrives over time, one chunk per turn of the event
 * loop, like a socket. `lido()` tells how many bytes have left the "wire";
 * `terminou` resolves when the whole body has been pulled.
 */
function requisicao(corpo: string | Buffer, o: { contentLength?: string | null; ip?: string; pedacos?: number } = {}) {
  const dados = Buffer.isBuffer(corpo) ? corpo : Buffer.from(corpo, 'utf8')
  const tam = o.pedacos ?? 1024
  let entregue = 0
  const stream = new Readable({
    highWaterMark: tam,
    read() {
      setImmediate(() => {
        if (entregue >= dados.length) { this.push(null); return }
        const inicio = entregue
        entregue = Math.min(inicio + tam, dados.length)
        this.push(dados.subarray(inicio, entregue))
      })
    },
  })
  const terminou = new Promise<void>((resolve) => { stream.once('end', () => resolve()); stream.once('close', () => resolve()) })
  const headers: Record<string, string> = {
    'content-type': 'application/csp-report',
    'cf-connecting-ip': o.ip ?? `203.0.113.${(ipSeq++ % 250) + 1}`,
  }
  if (o.contentLength !== null) headers['content-length'] = o.contentLength ?? String(dados.length)
  ;(stream as any).headers = headers
  return { event: { node: { req: stream } }, lido: () => entregue, terminou, total: dados.length }
}

const relatorio = (extra: Record<string, any> = {}) => JSON.stringify({
  'csp-report': { 'document-uri': 'https://example.test/', 'violated-directive': 'script-src', 'blocked-uri': 'https://cdn.example.test/x.js', ...extra },
})
const doCsp = () => avisos.filter((a) => a[0] === '[CSP]')

describe('POST /api/csp-report', () => {
  it('logs a normal report and answers 204', async () => {
    const r = requisicao(relatorio())
    expect(await handler(r.event)).toBeNull()
    expect(status).toBe(204)
    expect(doCsp()).toHaveLength(1)
    expect(doCsp()[0][1]).toContain('"violated-directive":"script-src"')
    expect(doCsp()[0][1]).toContain('https://cdn.example.test/x.js')
  })

  it('never reads the body through the unbounded reader', async () => {
    await handler(requisicao(relatorio()).event)
    await handler(requisicao('x'.repeat(100_000), { contentLength: null }).event)
    expect(leiturasSemTeto).toBe(0)
  })

  it('accepts the flat shape of the newer reporting format too', async () => {
    await handler(requisicao(JSON.stringify({ documentURL: 'https://example.test/', effectiveDirective: 'img-src' })).event)
    expect(doCsp()[0][1]).toContain('"effectiveDirective":"img-src"')
  })

  it('a body announced above 16 KiB is not read at all', async () => {
    const r = requisicao('x'.repeat(200_000), { contentLength: String(200_000) })
    expect(await handler(r.event)).toBeNull()
    expect(status).toBe(204)
    expect(r.lido()).toBe(0)
    expect(doCsp()).toHaveLength(0)
  })

  it('exactly 16 KiB is still accepted', async () => {
    const base = relatorio({ 'script-sample': '' })
    const corpo = relatorio({ 'script-sample': 'a'.repeat(LIMITE - base.length) })
    expect(Buffer.byteLength(corpo)).toBe(LIMITE)
    await handler(requisicao(corpo).event)
    expect(doCsp()).toHaveLength(1)
  })

  it('no content-length: the answer goes out at the cap, nothing is kept or logged, the rest is discarded', async () => {
    const r = requisicao('{"csp-report":{"x":"' + 'y'.repeat(2_000_000) + '"}}', { contentLength: null, pedacos: 4096 })
    expect(await handler(r.event)).toBeNull()
    expect(status).toBe(204)
    // Answered as soon as the cap was crossed, not after the whole body.
    expect(r.lido()).toBeLessThanOrEqual(LIMITE + 4096 * 3)
    expect(doCsp()).toHaveLength(0)
    // The rest keeps flowing and is thrown away, so the connection is not left stalled.
    await r.terminou
    expect(r.lido()).toBe(r.total)
    expect(doCsp()).toHaveLength(0)
  })

  it('a content-length that understates the body does not get past the cap either', async () => {
    const r = requisicao('{"csp-report":{"x":"' + 'y'.repeat(1_000_000) + '"}}', { contentLength: '120', pedacos: 4096 })
    await handler(r.event)
    expect(status).toBe(204)
    expect(r.lido()).toBeLessThanOrEqual(LIMITE + 4096 * 3)
    expect(doCsp()).toHaveLength(0)
  })

  it('what goes to the log is trimmed: long values, many keys, nested data', async () => {
    const muitas = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`k${i}`, 'v']))
    await handler(requisicao(relatorio({ 'original-policy': 'p'.repeat(6000), 'blocked-uri': `https://example.test/${'u'.repeat(3000)}`, aninhado: { a: { b: 'c'.repeat(2000) } }, ...muitas })).event)
    const linha = doCsp()[0][1]
    expect(linha.length).toBeLessThanOrEqual(2100)
    expect(linha).not.toContain('p'.repeat(400))
    expect(linha).not.toContain('u'.repeat(400))
    expect(linha).toContain('"violated-directive":"script-src"')
  })

  it('the log entry is one line, whatever the report contains', async () => {
    await handler(requisicao(relatorio({ 'blocked-uri': 'https://example.test/\n[CSP] forged line\r\n\u2028x' })).event)
    expect(doCsp()[0][1]).not.toMatch(/[\r\n\u2028\u2029]/)
  })

  it('a body that is not JSON, or empty, is ignored without an error status', async () => {
    for (const corpo of ['not json', '', '{"csp-report":', '[]', 'null', '42']) {
      expect(await handler(requisicao(corpo).event)).toBeNull()
      expect(status).toBe(204)
    }
    expect(doCsp()).toHaveLength(0)
  })

  it('a body already parsed by the platform is bounded the same way', async () => {
    const pequeno = requisicao('')
    ;(pequeno.event.node.req as any).body = { 'csp-report': { 'violated-directive': 'style-src' } }
    await handler(pequeno.event)
    expect(doCsp()[0][1]).toContain('style-src')
    const grande = requisicao('')
    ;(grande.event.node.req as any).body = 'z'.repeat(LIMITE + 1)
    await handler(grande.event)
    expect(doCsp()).toHaveLength(1)
  })

  it('keeps sampling per address: of 10 reports in a minute, 2 are logged and the others are not read', async () => {
    const lidos: number[] = []
    for (let i = 0; i < 10; i++) {
      const r = requisicao(relatorio(), { ip: '198.51.100.20' })
      await handler(r.event)
      lidos.push(r.lido())
    }
    expect(doCsp()).toHaveLength(2)
    expect(lidos.filter((n) => n > 0)).toHaveLength(2)
  })

  it('a stream error while reading still answers 204', async () => {
    const r = requisicao(relatorio(), { contentLength: null })
    const req = r.event.node.req as Readable
    req._read = function () { this.destroy(new Error('socket closed')) }
    expect(await handler(r.event)).toBeNull()
    expect(status).toBe(204)
  })
})
