import crypto from 'node:crypto'

// Integracao AbacatePay v2 (Pix transparente). Shapes validados na homologacao:
// create: POST /transparents/create {method:'PIX', data:{amount, ...}} -> {id, brCode, brCodeBase64, status, expiresAt}
// check:  GET  /transparents/check?id=...
type AbacateResp<T> = { data: T | null; success: boolean; error: string | null }

function cfg() {
  const c = useRuntimeConfig()
  if (!c.abacatepayApiKey) throw createError({ statusCode: 503, message: 'AbacatePay nao configurado.' })
  return { base: c.abacatepayBase as string, key: c.abacatepayApiKey as string, secret: c.abacatepayWebhookSecret as string }
}

export interface PixCharge {
  id: string
  amount: number
  status: string
  brCode: string
  brCodeBase64: string
  expiresAt: string | null
}

export async function criarPixTransparente(opts: {
  amountCentavos: number
  pedidoId: string
  descricao?: string
  expiresIn?: number
}): Promise<PixCharge> {
  const { base, key } = cfg()
  const res = await $fetch<AbacateResp<PixCharge>>(`${base}/transparents/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: {
      method: 'PIX',
      data: {
        amount: opts.amountCentavos,
        description: opts.descricao || 'Consulta Premium PlacaCompleta',
        expiresIn: opts.expiresIn ?? 900,
        metadata: { pedidoId: opts.pedidoId },
      },
    },
  })
  if (!res.success || !res.data) throw createError({ statusCode: 502, message: 'AbacatePay: ' + (res.error || 'falha ao criar Pix') })
  return res.data
}

export async function checarPix(id: string): Promise<{ status: string } | null> {
  const { base, key } = cfg()
  try {
    const res = await $fetch<AbacateResp<{ status: string }>>(`${base}/transparents/check`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      query: { id },
    })
    return res.data
  } catch {
    return null
  }
}

// Reembolso (falha pos-pagamento). Endpoint provavel; tratado como best-effort.
export async function reembolsarPix(id: string): Promise<boolean> {
  const { base, key } = cfg()
  try {
    const res = await $fetch<AbacateResp<any>>(`${base}/transparents/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: { id },
    })
    return !!res.success
  } catch {
    return false
  }
}

// Verifica a assinatura HMAC do webhook (payload cru + secret).
export function verificarWebhook(rawBody: string, signature: string | undefined): boolean {
  const { secret } = cfg()
  if (!secret || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}
