/**
 * Cloudflare Turnstile na consulta gratis (POST /api/consulta).
 *
 * Tres modos, via NUXT_TURNSTILE_MODE:
 *   off      (padrao) nao verifica nada. Tambem e forcado quando falta o secret.
 *   log      verifica e registra o resultado, mas nunca barra.
 *   enforce  token ausente ou invalido: 403.
 *
 * Fail open: se o siteverify da Cloudflare nao responde (rede, timeout, 5xx),
 * a consulta segue e o resultado fica registrado como 'erro_siteverify'. Uma
 * queda do lado deles nao pode derrubar o funil principal.
 *
 * Nada de token ou IP em log: o registro (tabela turnstile_eventos) guarda so
 * resultado, modo, canal e o dia.
 */

export type TurnstileModo = 'off' | 'log' | 'enforce'
export type TurnstileResultado = 'ok' | 'ausente' | 'invalido' | 'erro_siteverify'

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TIMEOUT_MS = 3000

export function resolverModoTurnstile(modo: unknown, secret: unknown): TurnstileModo {
  if (!secret || typeof secret !== 'string' || !secret.trim()) return 'off'
  const m = String(modo || '').trim().toLowerCase()
  return m === 'log' || m === 'enforce' ? m : 'off'
}

type FetchLike = (url: string, init: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>

export async function verificarTokenTurnstile(opts: {
  token: unknown
  secret: string
  ip?: string | null
  fetchImpl?: FetchLike
  timeoutMs?: number
}): Promise<TurnstileResultado> {
  const token = typeof opts.token === 'string' ? opts.token.trim() : ''
  // Token do Turnstile tem ate 2048 caracteres; maior que isso nem vai pra Cloudflare.
  if (!token) return 'ausente'
  if (token.length > 2048) return 'invalido'

  const fetchImpl: FetchLike = opts.fetchImpl || (globalThis.fetch as any)
  const form = new URLSearchParams()
  form.set('secret', opts.secret)
  form.set('response', token)
  if (opts.ip) form.set('remoteip', opts.ip)

  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
    })
    if (!res.ok) return 'erro_siteverify'
    const data = await res.json()
    if (data?.success === true) return 'ok'
    // internal-error e do lado da Cloudflare, nao do token: trata como queda.
    const codigos: string[] = Array.isArray(data?.['error-codes']) ? data['error-codes'] : []
    if (codigos.includes('internal-error')) return 'erro_siteverify'
    return 'invalido'
  } catch {
    return 'erro_siteverify'
  }
}

export interface DecisaoTurnstile {
  modo: TurnstileModo
  resultado: TurnstileResultado | null
  bloquear: boolean
}

export async function decidirTurnstile(opts: {
  modo: unknown
  secret: unknown
  token: unknown
  ip?: string | null
  fetchImpl?: FetchLike
  timeoutMs?: number
}): Promise<DecisaoTurnstile> {
  const modo = resolverModoTurnstile(opts.modo, opts.secret)
  if (modo === 'off') return { modo, resultado: null, bloquear: false }
  const resultado = await verificarTokenTurnstile({
    token: opts.token,
    secret: String(opts.secret),
    ip: opts.ip,
    fetchImpl: opts.fetchImpl,
    timeoutMs: opts.timeoutMs,
  })
  const bloquear = modo === 'enforce' && (resultado === 'ausente' || resultado === 'invalido')
  return { modo, resultado, bloquear }
}

export const MENSAGEM_TURNSTILE =
  'Não conseguimos confirmar a verificação de segurança. Recarregue a página e tente de novo.'

/** Linha sem PII pra contar depois: resultado, modo, canal e o dia (created_at). */
export function linhaEventoTurnstile(d: DecisaoTurnstile, ctx: { isPwa: boolean; isApp: boolean }) {
  return {
    resultado: d.resultado,
    modo: d.modo,
    bloqueado: d.bloquear,
    is_pwa: ctx.isPwa,
    is_app: ctx.isApp,
  }
}
