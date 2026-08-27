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

// Cria (ou reusa) o cliente na AbacatePay pelo email. Antes isto so fazia
// customers/create, nunca buscava antes: cada compra virava um customer novo
// pro mesmo email (confirmado no dashboard). Agora e get-or-create de verdade,
// com a tabela `usuarios` (email unique -> abacatepay_customer_id) como cache
// local e fonte da verdade pro "canonico".
//
// Ordem de resolucao:
//  1. usuarios.email ja tem customer_id? usa direto, sem chamar a AbacatePay.
//  2. senao, lista customers na AbacatePay por email (listCustomers) — se
//     achar 1+, o canonico e o MAIS ANTIGO (createdAt), pra nao trocar de
//     cliente numa conta que ja tem historico de compra.
//  3. senao, cria (customers/create).
//  Em qualquer caso que resolver um id, faz upsert em `usuarios` (best-effort:
//  falha no upsert nao derruba o checkout, so perde o cache pra proxima vez).
//
// Fail-open: qualquer erro aqui nao derruba o checkout, so ficamos sem o
// customerId (pedido segue sem rastreio de cliente no dashboard).
export async function criarOuObterCliente(opts: {
  email: string
  telefone?: string | null
  nome?: string | null
}): Promise<string | null> {
  const { base, key } = cfg()
  const email = opts.email.trim().toLowerCase()
  if (!email) return null

  const supabase = usePremiumSupabase()

  try {
    const { data: cached } = await supabase
      .from('usuarios')
      .select('abacatepay_customer_id')
      .eq('email', email)
      .maybeSingle()
    if (cached?.abacatepay_customer_id) return cached.abacatepay_customer_id
  } catch (e: any) {
    console.warn('[cliente] lookup em usuarios falhou:', e?.message)
  }

  let customerId: string | null = null

  try {
    const lista = await $fetch<AbacateResp<any[]>>(`${base}/customers/list`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      query: { email },
    })
    const candidatos = (lista.data || []).filter((c) => c?.email?.toLowerCase() === email)
    if (candidatos.length) {
      // Canonico = mais antigo. createdAt pode nao vir no shape; se faltar em
      // todos, o array ja costuma vir em ordem de criacao (mais antigo primeiro).
      const maisAntigo = candidatos.reduce((best, cur) => {
        const bd = best?.createdAt ? new Date(best.createdAt).getTime() : 0
        const cd = cur?.createdAt ? new Date(cur.createdAt).getTime() : 0
        return cd && (!bd || cd < bd) ? cur : best
      }, candidatos[0])
      customerId = maisAntigo?.id || null
    }
  } catch (e: any) {
    console.warn('[cliente] listCustomers falhou:', e?.data?.error || e?.message)
  }

  if (!customerId) {
    try {
      const res = await $fetch<AbacateResp<{ id: string }>>(`${base}/customers/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: {
          email,
          ...(opts.nome ? { name: opts.nome } : {}),
          ...(opts.telefone ? { cellphone: opts.telefone } : {}),
        },
      })
      customerId = res.data?.id || null
    } catch (e: any) {
      console.warn('[cliente] criar falhou:', e?.data?.error || e?.message)
    }
  }

  if (customerId) {
    try {
      await supabase
        .from('usuarios')
        .upsert({ email, abacatepay_customer_id: customerId, updated_at: new Date().toISOString() }, { onConflict: 'email' })
    } catch (e: any) {
      console.warn('[cliente] upsert em usuarios falhou:', e?.message)
    }
  }

  return customerId
}

export async function criarPixTransparente(opts: {
  amountCentavos: number
  pedidoId: string
  descricao?: string
  expiresIn?: number
  // Dados do cliente embutidos na cobranca: associam a compra a um cliente no
  // dashboard da AbacatePay (o transparente nao aceita customerId, so inline).
  customer?: { email: string; cellphone?: string; name?: string }
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
        ...(opts.customer ? { customer: opts.customer } : {}),
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

// Reembolso (POST /v2/transparents/refund {id, reason}). Reembolso TOTAL.
// Regras da AbacatePay: PIX precisa estar COMPLETE e o valor sai do saldo
// `available` da loja — sem saldo, retorna INSUFFICIENT_FUNDS (comum em conta
// nova, com o dinheiro pago ainda em `pending`). Antes o erro era engolido;
// agora devolvemos o motivo pra registrar e diagnosticar.
export async function reembolsarPix(
  id: string,
  reason = 'Consulta nao pode ser concluida apos pagamento.',
): Promise<{ ok: boolean; error: string | null }> {
  const { base, key } = cfg()
  try {
    const res = await $fetch<AbacateResp<{ refundPublicId: string }>>(`${base}/transparents/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: { id, reason },
    })
    if (!res.success) {
      console.warn('[reembolso] AbacatePay negou:', res.error, '| charge=', id)
      return { ok: false, error: res.error || 'reembolso nao confirmado' }
    }
    return { ok: true, error: null }
  } catch (e: any) {
    const msg = e?.data?.error || e?.data?.message || e?.message || 'erro desconhecido'
    console.warn('[reembolso] falhou:', msg, '| charge=', id)
    return { ok: false, error: String(msg) }
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
