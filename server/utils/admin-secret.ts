import crypto from 'node:crypto'
import type { H3Event } from 'h3'

const digest = (texto: string) => crypto.createHash('sha256').update(texto, 'utf8').digest()

/**
 * Guard of the operator-only routes (host timers and routines run by hand):
 * the caller must send ADMIN_SECRET in the x-admin-secret header.
 *
 * Missing header, wrong value, or no secret configured in this environment:
 * 404, never 401. An operator route does not announce that it exists.
 *
 * The comparison is constant-time and runs over bytes. Both sides are hashed
 * to a fixed-size digest first, so it does not depend on the length of either
 * value and cannot throw, whatever the header carries (a value with the same
 * number of characters as the secret but a different number of bytes, for
 * instance).
 */
export function assertAdminSecret(event: H3Event): void {
  const segredo = String(useRuntimeConfig().adminSecret || '')
  const enviado = String(getRequestHeader(event, 'x-admin-secret') || '')
  const confere = !!segredo && crypto.timingSafeEqual(digest(enviado), digest(segredo))
  if (!confere) throw createError({ statusCode: 404, message: 'Not Found' })
}
