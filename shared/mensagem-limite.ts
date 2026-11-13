/**
 * Message to show the buyer when a checkout request is refused by our limits
 * (server/utils/checkout-limite.ts: 429 per plate, 503 card breaker) or by the
 * card being unavailable (503). Only those statuses are echoed, and only when
 * the server sent a message; anything else returns null and the caller keeps
 * its generic text.
 */
export function mensagemDoLimite(e: any): string | null {
  const status = e?.statusCode ?? e?.status ?? e?.response?.status
  if (status !== 429 && status !== 503) return null
  const m = e?.data?.message
  return typeof m === 'string' && m.trim() ? m.trim().slice(0, 200) : null
}
