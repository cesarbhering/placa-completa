/**
 * Limites customizados de rate limit, por chave.
 * Fonte: tabela rate_limit_whitelist no Supabase (gerenciada no Studio,
 * sem deploy): hourly_limit N = N consultas/hora; NULL = sem teto.
 * Quem nao esta na tabela usa o default (5/hora).
 *
 * Dois tipos de chave, e cada um so mexe no SEU teto (server/api/consulta.post.ts):
 * - destinatario (e-mail em minusculas ou telefone normalizado): teto por
 *   destinatario. Nao desliga o teto por IP nem o gate de e-mail: digitar um
 *   e-mail liberado nao prova a posse dele.
 * - 'ip:<endereco>': teto por IP daquele endereco (sonda de checkout, testes
 *   de prod). IPv6 em qualquer grafia (vale pro /64 dele), ou escrito como
 *   'ip:<4 grupos>::/64'. 'ip:unknown' = o balde de quem chega sem endereco
 *   conhecido.
 *
 * Cache em memoria de 5 min; fail-closed: erro de leitura = todo mundo
 * no default.
 */
import { normalizarIp } from './client-ip'

export const DEFAULT_HOURLY_LIMIT = 5

/** Chave como o codigo procura: minusculas, sem espaco, e o IP de 'ip:<ip>' na grafia unica. */
function chaveDaEntrada(recipient: unknown): string {
  const chave = String(recipient).toLowerCase().trim()
  if (!chave.startsWith('ip:')) return chave
  const ip = normalizarIp(chave.slice(3))
  return ip ? `ip:${ip}` : chave
}

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
        chaveDaEntrada(r.recipient),
        r.hourly_limit === null || r.hourly_limit === undefined ? null : Number(r.hourly_limit),
      ]))
    } catch (e: any) {
      console.warn('[whitelist] leitura falhou, todos no default neste ciclo:', e?.message)
      cache = cache ?? new Map()
    }
    cacheExpiresAt = Date.now() + TTL
  }

  const key = chaveDaEntrada(recipient)
  if (!cache.has(key)) return DEFAULT_HOURLY_LIMIT
  const custom = cache.get(key)
  return custom === null ? Infinity : (custom as number)
}
