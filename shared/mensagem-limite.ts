/**
 * Message to show the buyer when a checkout request is refused by our limits
 * (server/utils/checkout-limite.ts: 429 per plate, 503 card breaker). Only
 * responses marked `data.limite` by the server are echoed; any other error
 * (including the unmarked 503 "card not configured") returns null and the
 * caller keeps its generic text.
 */
export function mensagemDoLimite(e: any): string | null {
  const status = e?.statusCode ?? e?.status ?? e?.response?.status
  if (status !== 429 && status !== 503) return null
  // $fetch error: e.data is the h3 error body, whose own `data` carries the mark.
  if (e?.data?.data?.limite !== true) return null
  const m = e?.data?.message
  return typeof m === 'string' && m.trim() ? m.trim().slice(0, 200) : null
}
