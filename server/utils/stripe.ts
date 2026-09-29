import crypto from 'node:crypto'

// Cartao via Stripe (forma de pagamento SECUNDARIA; Pix segue principal).
// v1 = a vista, sem parcelas. Falamos com a API REST do Stripe direto (fetch),
// SEM a dependencia `stripe` no bundle: a Checkout Session hospedada e um
// POST form-urlencoded, e a verificacao do webhook e um HMAC-SHA256 que o
// node:crypto ja faz. Menos superficie, e o webhook fica testavel na mao.

const STRIPE_API = 'https://api.stripe.com/v1'

function stripeConfig(): { secret: string; webhookSecret: string } {
  const c = useRuntimeConfig()
  return {
    secret: String((c as any).stripeSecretKey || ''),
    webhookSecret: String((c as any).stripeWebhookSecret || ''),
  }
}

/** Sem a chave configurada, o cartao simplesmente nao existe (o endpoint 503). */
export function stripeConfigurado(): boolean {
  return !!stripeConfig().secret
}

// Achata { a: { b: 'c' }, list: ['x'] } em a[b]=c & list[0]=x, do jeito que a
// API do Stripe le form-urlencoded aninhado. So o que a gente usa: objeto,
// array e valor escalar.
function paraForm(obj: Record<string, any>, prefixo = '', acc: URLSearchParams = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    const chave = prefixo ? `${prefixo}[${k}]` : k
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') paraForm(item, `${chave}[${i}]`, acc)
        else acc.append(`${chave}[${i}]`, String(item))
      })
    } else if (v !== null && typeof v === 'object') {
      paraForm(v, chave, acc)
    } else {
      acc.append(chave, String(v))
    }
  }
  return acc
}

export interface StripeSession {
  id: string
  url: string | null
  payment_status?: string
  status?: string
}

/**
 * Cria a Checkout Session hospedada. Um unico item, BRL, valor em centavos que
 * SAI DO SERVIDOR (nunca do client). metadata carrega o token/pedido pra casar
 * o webhook e o return. Idempotency-Key pelo pedido: retry de rede nao cria
 * duas sessoes (nem duas cobrancas) pro mesmo pedido.
 */
export async function criarStripeSession(opts: {
  pedidoId: string
  tokenEntrega: string
  plano: string
  nome: string
  valorCentavos: number
  email?: string | null
  successUrl: string
  cancelUrl: string
}): Promise<StripeSession> {
  const { secret } = stripeConfig()
  if (!secret) throw createError({ statusCode: 503, message: 'Cartao indisponivel' })

  const form = paraForm({
    mode: 'payment',
    locale: 'pt-BR',
    payment_method_types: ['card'],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    client_reference_id: opts.pedidoId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'brl',
          unit_amount: opts.valorCentavos,
          product_data: { name: opts.nome },
        },
      },
    ],
    metadata: { pedido_id: opts.pedidoId, token_entrega: opts.tokenEntrega, plano: opts.plano },
    // Pre-preenche o e-mail no checkout do Stripe quando temos (entrega + recibo).
    ...(opts.email ? { customer_email: opts.email } : {}),
  })

  const resp = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      // Sessao unica por pedido: mesma chave = Stripe devolve a mesma sessao.
      'Idempotency-Key': `sess_${opts.pedidoId}`,
    },
    body: form.toString(),
  })
  const data: any = await resp.json().catch(() => ({}))
  if (!resp.ok || !data?.id) {
    console.warn('[stripe] criar sessao falhou:', resp.status, data?.error?.message)
    throw createError({ statusCode: 502, message: 'Falha ao iniciar pagamento com cartao' })
  }
  return { id: data.id, url: data.url, payment_status: data.payment_status, status: data.status }
}

/** Le a sessao (usado pelo status polling: confirma pagamento sem depender do webhook). */
export async function consultarStripeSession(sessionId: string): Promise<StripeSession | null> {
  const { secret } = stripeConfig()
  if (!secret || !sessionId) return null
  try {
    const resp = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const data: any = await resp.json().catch(() => ({}))
    if (!resp.ok || !data?.id) return null
    return { id: data.id, url: data.url, payment_status: data.payment_status, status: data.status }
  } catch {
    return null
  }
}

/** Pagamento confirmado? Stripe marca payment_status='paid' quando o cartao passa. */
export function stripeSessionPaga(s: StripeSession | null | undefined): boolean {
  return !!s && s.payment_status === 'paid'
}

/**
 * Verifica a assinatura do webhook (header Stripe-Signature: "t=<ts>,v1=<hex>").
 * signedPayload = `${t}.${rawBody}`; compara HMAC-SHA256(signedPayload, whsec)
 * com cada v1 em tempo constante. Rejeita timestamp velho (replay) alem da
 * tolerancia (default 5 min). rawBody = corpo CRU (nao o parseado): um byte
 * diferente muda o HMAC.
 */
export function verificarAssinaturaStripe(
  rawBody: string,
  sigHeader: string | null | undefined,
  segredo: string,
  toleranciaSegundos = 300,
): boolean {
  if (!rawBody || !sigHeader || !segredo) return false
  let t = ''
  const assinaturas: string[] = []
  for (const parte of sigHeader.split(',')) {
    const idx = parte.indexOf('=')
    if (idx < 0) continue
    const chave = parte.slice(0, idx).trim()
    const valor = parte.slice(idx + 1).trim()
    if (chave === 't') t = valor
    else if (chave === 'v1') assinaturas.push(valor)
  }
  if (!t || assinaturas.length === 0) return false

  const ts = Number(t)
  if (!Number.isFinite(ts)) return false
  if (Math.abs(Date.now() / 1000 - ts) > toleranciaSegundos) return false

  const esperado = crypto.createHmac('sha256', segredo).update(`${t}.${rawBody}`).digest('hex')
  const bufEsperado = Buffer.from(esperado, 'utf8')
  return assinaturas.some((sig) => {
    const buf = Buffer.from(sig, 'utf8')
    return buf.length === bufEsperado.length && crypto.timingSafeEqual(buf, bufEsperado)
  })
}

export function stripeWebhookSecret(): string {
  return stripeConfig().webhookSecret
}
