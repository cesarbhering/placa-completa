import { getClientIp } from '../utils/client-ip'
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

interface SampleEntry {
  count: number
  resetAt: number
}

const SAMPLE_WINDOW_MS = 60 * 1000
const LOG_EVERY_N = 5 // per IP per window, log 1 in N reports

const sampleStore = new Map<string, SampleEntry>()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of sampleStore.entries()) {
    if (now > entry.resetAt) {
      sampleStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

function shouldLog(ip: string): boolean {
  const now = Date.now()
  let entry = sampleStore.get(ip)
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + SAMPLE_WINDOW_MS }
    sampleStore.set(ip, entry)
    return true
  }
  entry.count++
  return entry.count % LOG_EVERY_N === 1
}

export default defineEventHandler(async (event) => {
  try {
    const ip = getClientIp(event)
    if (shouldLog(ip)) {
      const body = await readBody(event)
      // The classic report-uri payload wraps the violation under "csp-report".
      // The newer Reporting API delivers a flat object — accept both.
      const report = (body && typeof body === 'object' && 'csp-report' in body)
        ? body['csp-report']
        : body
      if (report) {
        console.warn('[CSP]', JSON.stringify(report))
      }
    }
  } catch {
    // never throw on a violation report
  }
  setResponseStatus(event, 204)
  return null
})
