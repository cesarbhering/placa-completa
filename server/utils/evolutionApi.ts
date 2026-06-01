// Thin wrapper around the Evolution API REST endpoint we use to
// deliver consulta results over WhatsApp. Kept intentionally narrow:
// only the calls the app actually issues today.

interface EvolutionConfig {
  baseUrl: string
  apiKey: string
  instance: string
}

function getEvolutionConfig(): EvolutionConfig {
  const config = useRuntimeConfig()
  const baseUrl = String(config.evolutionApiUrl || '').replace(/\/+$/, '')
  const apiKey = String(config.evolutionApiKey || '')
  const instance = String(config.evolutionInstance || '')
  if (!baseUrl || !apiKey || !instance) {
    throw createError({
      statusCode: 500,
      message: 'Evolution API is not configured',
    })
  }
  return { baseUrl, apiKey, instance }
}

// Brazilian phone numbers are typically stored as 10 or 11 local digits.
// The Evolution API expects E.164 without the leading "+". For BR we
// prefix country code 55 when missing.
export function normalizePhoneForWhatsApp(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 13) return null
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }
  return digits
}

export interface SendWhatsAppResult {
  ok: boolean
  status: number
  messageId?: string
  error?: string
}

// Sends a plain-text WhatsApp message. Returns a structured result
// instead of throwing on HTTP errors so callers can decide whether
// to surface a generic error or retry.
export async function sendWhatsAppText(
  phone: string,
  text: string,
): Promise<SendWhatsAppResult> {
  const { baseUrl, apiKey, instance } = getEvolutionConfig()
  const number = normalizePhoneForWhatsApp(phone)
  if (!number) {
    return { ok: false, status: 400, error: 'invalid phone' }
  }

  const url = `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`
  try {
    const res = await $fetch.raw(url, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      body: { number, text },
      ignoreResponseError: true,
    })
    const status = res.status
    const payload = res._data as any
    if (status >= 200 && status < 300) {
      return {
        ok: true,
        status,
        messageId: payload?.key?.id || payload?.messageId,
      }
    }
    return {
      ok: false,
      status,
      error: typeof payload === 'string'
        ? payload.slice(0, 200)
        : payload?.message || payload?.error || `HTTP ${status}`,
    }
  } catch (err: any) {
    return { ok: false, status: 0, error: err?.message || 'fetch failed' }
  }
}
