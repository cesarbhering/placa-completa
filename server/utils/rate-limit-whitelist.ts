/**
 * Limites customizados de rate limit por destinatario.
 * Fonte: tabela rate_limit_whitelist no Supabase (gerenciada no Studio,
 * sem deploy): hourly_limit N = N consultas/hora; NULL = ilimitado.
 * Quem nao esta na tabela usa o default (5/hora).
 *
 * Cache em memoria de 5 min; fail-closed: erro de leitura = todo mundo
 * no default.
 */
export const DEFAULT_HOURLY_LIMIT = 5

// null = ilimitado; number = limite customizado
type CustomLimit = number | null

let cache: Map<string, CustomLimit> | null = null
let cacheExpiresAt = 0
const TTL = 5 * 60 * 1000

/**
 * Retorna o limite/hora efetivo do destinatario, ou Infinity se ilimitado.
 */
export async function getHourlyLimit(recipient: string | null | undefined): Promise<number> {
  if (!recipient) return DEFAULT_HOURLY_LIMIT

  if (!cache || Date.now() > cacheExpiresAt) {
    try {
      const supabase = useSupabaseServer()
      const { data, error } = await supabase.from('rate_limit_whitelist').select('recipient, hourly_limit')
      if (error) throw error
      cache = new Map((data ?? []).map(r => [
        String(r.recipient).toLowerCase().trim(),
        r.hourly_limit === null || r.hourly_limit === undefined ? null : Number(r.hourly_limit),
      ]))
    } catch (e: any) {
      console.warn('[whitelist] leitura falhou, todos no default neste ciclo:', e?.message)
      cache = cache ?? new Map()
    }
    cacheExpiresAt = Date.now() + TTL
  }

  const key = recipient.toLowerCase().trim()
  if (!cache.has(key)) return DEFAULT_HOURLY_LIMIT
  const custom = cache.get(key)
  return custom === null ? Infinity : (custom as number)
}
