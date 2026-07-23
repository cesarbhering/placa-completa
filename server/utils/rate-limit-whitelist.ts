/**
 * Whitelist de destinatarios isentos do rate limit (5 consultas/hora).
 * Fonte: tabela rate_limit_whitelist no Supabase (gerenciada no Studio,
 * sem deploy). Cache em memoria de 5 min pra nao custar 1 query extra
 * por consulta; fail-closed: erro de leitura = ninguem isento.
 */
let cache: Set<string> | null = null
let cacheExpiresAt = 0
const TTL = 5 * 60 * 1000

export async function isWhitelisted(recipient: string | null | undefined): Promise<boolean> {
  if (!recipient) return false

  if (!cache || Date.now() > cacheExpiresAt) {
    try {
      const supabase = useSupabaseServer()
      const { data, error } = await supabase.from('rate_limit_whitelist').select('recipient')
      if (error) throw error
      cache = new Set((data ?? []).map(r => String(r.recipient).toLowerCase().trim()))
    } catch (e: any) {
      console.warn('[whitelist] leitura falhou, ninguem isento neste ciclo:', e?.message)
      cache = cache ?? new Set()
    }
    cacheExpiresAt = Date.now() + TTL
  }

  return cache.has(recipient.toLowerCase().trim())
}
