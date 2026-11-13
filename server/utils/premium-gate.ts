import crypto from 'node:crypto'
import type { H3Event } from 'h3'
import { gateBloqueado, registrarSenhaErrada, MSG_GATE_LIMITE } from './gate-limite'

function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)) } catch { return false }
}

/** Fixed version label of the gate cookie: changing it logs everyone out once. */
const ROTULO_COOKIE = 'premium-gate-cookie-v1'

/**
 * Value stored in the 'premium_gate' cookie: HMAC-SHA256 keyed by the
 * password, so the cookie never carries the password itself.
 */
export function valorCookieGate(senha: string): string {
  return crypto.createHmac('sha256', senha).update(ROTULO_COOKIE).digest('base64url')
}

// Simple gate of the premium area (homolog and staging). Passes with the
// 'premium_gate' cookie (a value derived from the password, set by
// /api/premium/gate) or with the password in the 'x-premium-pass' header. A
// wrong header password counts in the same lock as /api/premium/gate
// (server/utils/gate-limite.ts) and, while the lock is on, the header answers
// 429. An invalid cookie (including the old one, which held the password)
// answers 401 and does not count: a stale cookie must not lock the environment.
export function assertPremiumGate(event: H3Event) {
  const config = useRuntimeConfig()
  // Production does not set `gated`: the premium area is open to every buyer.
  // The password gate only applies to the protected environments.
  if (!config.public.gated) return
  const expected = config.premiumPagePassword as string
  if (!expected) throw createError({ statusCode: 503, message: 'Premium nao configurado.' })
  const cookie = getCookie(event, 'premium_gate') || ''
  if (cookie && safeEq(cookie, valorCookieGate(expected))) return
  const header = getRequestHeader(event, 'x-premium-pass') || ''
  if (header) {
    if (gateBloqueado()) throw createError({ statusCode: 429, message: MSG_GATE_LIMITE })
    if (safeEq(header, expected)) return
    registrarSenhaErrada()
  }
  throw createError({ statusCode: 401, message: 'Acesso restrito.' })
}
