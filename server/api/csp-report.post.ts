// Receives Content-Security-Policy violation reports from browsers.
// During the baseline week these are just logged so an operator can
// grep the container output and build an accurate allowlist. The
// existing rate-limit middleware caps abuse per IP.

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    // The classic report-uri payload wraps the violation under "csp-report".
    // The newer Reporting API delivers a flat object — accept both.
    const report = (body && typeof body === 'object' && 'csp-report' in body)
      ? body['csp-report']
      : body
    if (report) {
      console.warn('[CSP]', JSON.stringify(report))
    }
  } catch {
    // never throw on a violation report
  }
  setResponseStatus(event, 204)
  return null
})
