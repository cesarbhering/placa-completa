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
  // Distincao no dashboard da AbacatePay: o Pix transparente nao linka produto
  // (isso e so pra checkout hosted/assinatura), entao amarramos o plano pela
  // `description` (nome do produto) e pelo `metadata` (plano + externalId, que
  // batem com o produto criado no catalogo). Assim cada cobranca e rastreavel.
  metadata?: Record<string, string>
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
        metadata: { pedidoId: opts.pedidoId, ...(opts.metadata || {}) },
      },
    },
  })
  if (!res.success || !res.data) throw createError({ statusCode: 502, message: 'AbacatePay: ' + (res.error || 'falha ao criar Pix') })
  return res.data
}

/**
 * Consulta a cobranca existente. Devolve o status e, quando o provedor manda,
 * tambem o copia-e-cola e o QR — a tela de retomada usa isso pra mostrar o QR
 * de novo sem criar outra cobranca (duplicar cobranca seria pior que nao ter QR).
 */
export async function checarPix(
  id: string,
): Promise<{ status: string; brCode?: string; brCodeBase64?: string } | null> {
  const { base, key } = cfg()
  try {
    const res = await $fetch<AbacateResp<{ status: string; brCode?: string; brCodeBase64?: string }>>(
      `${base}/transparents/check`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
        query: { id },
      },
    )
    return res.data
  } catch {
    return null
  }
}

// Reembolso (POST /v2/transparents/refund {id, reason}). Suportado.
export async function reembolsarPix(id: string, reason = 'Consulta nao pode ser concluida apos pagamento.'): Promise<boolean> {
  const { base, key } = cfg()
  try {
    const res = await $fetch<AbacateResp<{ refundPublicId: string }>>(`${base}/transparents/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: { id, reason },
    })
    return !!res.success
  } catch {
    return false
  }
}

// Simula pagamento em DEV (pra testar o fluxo inteiro sem Pix real).
export async function simularPagamento(id: string): Promise<boolean> {
  const { base, key } = cfg()
  try {
    const res = await $fetch<AbacateResp<any>>(`${base}/transparents/simulate-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      query: { id },
    })
    return !!res.success
  } catch {
    return false
  }
}

// Verifica o webhook: secret via query (?webhookSecret=), assinatura HMAC-SHA256
// em BASE64 no header x-webhook-signature, e timestamp anti-replay (±5min).
export function verificarWebhook(opts: {
  rawBody: string
  signature?: string
  timestamp?: string
  querySecret?: string
}): boolean {
  const { secret } = cfg()
  if (!secret) return false
  // 1) secret na query
  if (opts.querySecret && opts.querySecret !== secret) return false
  // 2) timestamp (anti-replay)
  if (opts.timestamp) {
    const t = parseInt(opts.timestamp, 10)
    if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false
  }
  // 3) assinatura HMAC base64
  if (!opts.signature) return !!opts.querySecret // se so tem query secret valido, aceita
  const expected = crypto.createHmac('sha256', secret).update(opts.rawBody).digest('base64')
  try {
    return crypto.timingSafeEqual(Buffer.from(opts.signature, 'base64'), Buffer.from(expected, 'base64'))
  } catch {
    return false
  }
}
