import { getClientIp, chaveTetoIp } from '../utils/client-ip'
// Receives Content-Security-Policy violation reports from browsers.
// During the baseline week these are just logged so an operator can
// grep the container output and build an accurate allowlist.
//
// This endpoint MUST NEVER return an error status: it is the browser
// itself reporting a violation, and a 429/5xx here shows up as a
// "Failed to load resource" console error for every visitor, on top
// of the CSP warning it's already logging (the remedy becomes worse
// than the disease). Global IP rate-limit middleware skips this path
// entirely; instead we do lightweight in-process sampling per IP so a
// noisy client can't flood logs, but the HTTP response is always 204.
//
// Anyone can post here, so what is read and what is logged are bounded:
// - the body is refused above 16 KiB, by the announced content-length before
//   reading and by a cap on the read itself (a real report is a few KiB). A
//   refused body is dropped unread and the answer is still 204;
// - the log entry is one line with trimmed values.

interface SampleEntry {
  count: number
  resetAt: number
}

const SAMPLE_WINDOW_MS = 60 * 1000
const LOG_EVERY_N = 5 // per IP per window, log 1 in N reports
/** Hard ceiling of the sampling map between sweeps. */
const SAMPLE_MAX_KEYS = 10_000

/** Largest body accepted. */
export const CSP_REPORT_MAX_BYTES = 16 * 1024
/** Log entry: at most this many keys, each value and the whole line trimmed. */
const LOG_MAX_KEYS = 20
const LOG_MAX_VALUE = 300
const LOG_MAX_LINE = 2000

const sampleStore = new Map<string, SampleEntry>()

const sweep = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of sampleStore.entries()) {
    if (now > entry.resetAt) {
      sampleStore.delete(key)
    }
  }
}, 5 * 60 * 1000)
// Never keeps the process alive on its own.
;(sweep as any).unref?.()

function shouldLog(ip: string): boolean {
  const now = Date.now()
  // Same key as the caps: the address on IPv4, the /64 on IPv6.
  const key = chaveTetoIp(ip)
  let entry = sampleStore.get(key)
  if (!entry || now > entry.resetAt) {
    if (sampleStore.size >= SAMPLE_MAX_KEYS) sampleStore.clear()
    entry = { count: 1, resetAt: now + SAMPLE_WINDOW_MS }
    sampleStore.set(key, entry)
    return true
  }
  entry.count++
  return entry.count % LOG_EVERY_N === 1
}

/**
 * Reads the body as text, up to `max` bytes. Returns null when it is larger
 * (announced or actual), unreadable, or absent. Never throws, and never
 * buffers more than `max`.
 */
async function readBoundedBody(event: any, max: number): Promise<string | null> {
  const req = event?.node?.req
  if (!req) return null

  // Body already parsed by the platform (serverless adapters): same ceiling.
  const pronto = (req as any).body
  if (pronto !== undefined && pronto !== null) {
    try {
      const texto = typeof pronto === 'string' ? pronto : Buffer.isBuffer(pronto) ? pronto.toString('utf8') : JSON.stringify(pronto)
      return Buffer.byteLength(texto, 'utf8') > max ? null : texto
    } catch {
      return null
    }
  }

  const anunciado = Number(req.headers?.['content-length'])
  if (Number.isFinite(anunciado) && anunciado > max) return null

  return await new Promise<string | null>((resolve) => {
    const partes: Buffer[] = []
    let total = 0
    let acabou = false
    const fim = (texto: string | null) => {
      if (acabou) return
      acabou = true
      req.off('data', onData)
      req.off('end', onEnd)
      req.off('error', onErro)
      req.off('close', onErro)
      resolve(texto)
    }
    const onData = (pedaco: Buffer | string) => {
      const b = typeof pedaco === 'string' ? Buffer.from(pedaco, 'utf8') : pedaco
      total += b.length
      if (total > max) {
        // Over the ceiling: keep nothing and answer now. The rest of the
        // stream is left flowing with no listener, so it is discarded as it
        // arrives (no memory held, and the connection is not left stalled).
        partes.length = 0
        fim(null)
        try { req.resume() } catch { /* nothing to do */ }
        return
      }
      partes.push(b)
    }
    const onEnd = () => fim(Buffer.concat(partes).toString('utf8'))
    const onErro = () => fim(null)
    req.on('data', onData)
    req.on('end', onEnd)
    req.on('error', onErro)
    req.on('close', onErro)
  })
}

function trimValue(v: unknown): unknown {
  if (typeof v === 'string') return v.length > LOG_MAX_VALUE ? `${v.slice(0, LOG_MAX_VALUE)}…` : v
  if (typeof v === 'number' || typeof v === 'boolean' || v === null) return v
  // Nested data is not part of a violation report: keep a short trace of it only.
  try { return trimValue(JSON.stringify(v)) } catch { return '[unserializable]' }
}

/** One bounded log line for a report: first keys only, values trimmed. */
function logLine(report: unknown): string | null {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null
  const curto: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(report as Record<string, unknown>).slice(0, LOG_MAX_KEYS)) {
    curto[k.slice(0, 60)] = trimValue(v)
  }
  // JSON.stringify escapes line breaks; U+2028/2029 are escaped by hand so the
  // entry is a single line in every log viewer.
  const linha = JSON.stringify(curto).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  return linha.length > LOG_MAX_LINE ? `${linha.slice(0, LOG_MAX_LINE)}…` : linha
}

export default defineEventHandler(async (event) => {
  try {
    const ip = getClientIp(event)
    if (shouldLog(ip)) {
      const texto = await readBoundedBody(event, CSP_REPORT_MAX_BYTES)
      const body = texto ? JSON.parse(texto) : null
      // The classic report-uri payload wraps the violation under "csp-report".
      // The newer Reporting API delivers a flat object — accept both.
      const report = (body && typeof body === 'object' && 'csp-report' in body)
        ? body['csp-report']
        : body
      const linha = logLine(report)
      if (linha) {
        console.warn('[CSP]', linha)
      }
    }
  } catch {
    // never throw on a violation report
  }
  setResponseStatus(event, 204)
  return null
})
