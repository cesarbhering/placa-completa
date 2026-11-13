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

// Gate simples da area premium (homologacao). Passa com o cookie 'premium_gate'
// (valor derivado da senha, setado pelo /api/premium/gate) ou com a senha no
// header 'x-premium-pass'. Senha errada no header conta na mesma trava do
// /api/premium/gate (server/utils/gate-limite.ts) e, com a trava armada, o
// header responde 429. Cookie invalido (inclusive o antigo, que guardava a
// senha) responde 401 e nao conta: um cookie velho nao pode travar o ambiente.
export function assertPremiumGate(event: H3Event) {
  const config = useRuntimeConfig()
  // Prod/main nao seta `gated`: a area premium fica aberta pra todo comprador.
  // O gate por senha vale so pros ambientes protegidos (homolog e staging).
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
