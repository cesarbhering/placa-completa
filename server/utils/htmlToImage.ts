// Renders an HTML document to a PNG via Gotenberg (Chromium-backed
// headless rendering). Self-hosted, on the internal Docker network —
// no third-party dependency at render time.
//
// The HTML must be self-contained: every image/font/stylesheet either
// inlined (data URI) or embedded in the <style> tag. Gotenberg will
// not fetch external resources reliably under our network settings.

interface RenderOptions {
  /** Viewport / output width in CSS pixels. Default 480 — fits well
   *  in WhatsApp's inline image preview. */
  width?: number
  /** If true, page height is determined by content. Default true. */
  fullHeight?: boolean
  /** Device pixel ratio for crisper output. Default 2. */
  scale?: number
  /** Hard ceiling on the Gotenberg call. Default 15s. */
  timeoutMs?: number
}

export interface RenderHtmlResult {
  ok: boolean
  bytes?: Buffer
  status: number
  error?: string
  durationMs?: number
}

export async function renderHtmlToPng(
  html: string,
  options: RenderOptions = {},
): Promise<RenderHtmlResult> {
  const config = useRuntimeConfig()
  const baseUrl = String(config.gotenbergUrl || '').replace(/\/+$/, '')
  if (!baseUrl) {
    return { ok: false, status: 500, error: 'GOTENBERG_URL not configured' }
  }

  const width = options.width ?? 480
  const scale = options.scale ?? 2
  const timeoutMs = options.timeoutMs ?? 15_000

  const form = new FormData()
  form.append(
    'index.html',
    new Blob([html], { type: 'text/html' }),
    'index.html',
  )
  form.append('width', String(width / 96)) // Gotenberg uses inches
  form.append('paperWidth', String(width / 96))
  form.append('paperHeight', '0') // 0 = auto
  form.append('omitBackground', 'false')
  form.append('emulatedMediaType', 'screen')
  form.append('preferCssPageSize', 'true')
  form.append('format', 'png')
  form.append('optimizeForSpeed', 'true')
  form.append('quality', '90')
  form.append('clip', 'true')

  const started = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(`${baseUrl}/forms/chromium/screenshot/html`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    })
    clearTimeout(timer)
    const durationMs = Date.now() - started

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        ok: false,
        status: res.status,
        error: text.slice(0, 300) || `HTTP ${res.status}`,
        durationMs,
      }
    }

    const buf = Buffer.from(await res.arrayBuffer())
    return { ok: true, bytes: buf, status: res.status, durationMs }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err?.name === 'AbortError' ? 'gotenberg timeout' : (err?.message || 'fetch failed'),
      durationMs: Date.now() - started,
    }
  }
}
