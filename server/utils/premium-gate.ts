import crypto from 'node:crypto'
import type { H3Event } from 'h3'

function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)) } catch { return false }
}

// Gate simples da area premium (homologacao). A senha vem via cookie
// 'premium_gate' (setado pelo /api/premium/gate) ou header 'x-premium-pass'.
export function assertPremiumGate(event: H3Event) {
  const config = useRuntimeConfig()
  // Prod/main nao seta `gated`: a area premium fica aberta pra todo comprador.
  // O gate por senha vale so pros ambientes protegidos (homolog e staging).
  if (!config.public.gated) return
  const expected = config.premiumPagePassword as string
  if (!expected) throw createError({ statusCode: 503, message: 'Premium nao configurado.' })
  const given = getCookie(event, 'premium_gate') || getRequestHeader(event, 'x-premium-pass') || ''
  if (!safeEq(given, expected)) throw createError({ statusCode: 401, message: 'Acesso restrito.' })
}
