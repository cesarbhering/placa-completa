// Cache por chave (placa, chassi, codigo FIPE) com TTL POR FONTE (Relatorio 2.0, Cesar 14/out/2026).
// Tabela public.fonte_cache (migration 20261014200100). TTLs: multas 24 h, leilao e chassi 30 d,
// recall 7 d, FIPE 7 d. So 'ok' e 'sem_dado' sao cacheados; falha nunca (a proxima chamada tenta de novo).
// "consultadoEm" volta junto para o relatorio mostrar de quando e o dado.

const H = 60 * 60 * 1000
const D = 24 * H

export const TTL_POR_FONTE: Array<[RegExp, number]> = [
  [/^multas/, 24 * H],
  [/^leilao/, 30 * D],
  [/^chassi/, 30 * D],
  [/^recall/, 7 * D],
  [/^fipe/, 7 * D],
  [/^nhtsa/, 30 * D],          // Lead 14/out: recall EUA cache 30 d
]

export function ttlDaFonte(fonte: string): number {
  return TTL_POR_FONTE.find(([re]) => re.test(fonte))?.[1] ?? 24 * H
}

export function chaveDePlaca(placa: string): string {
  return String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export type Cacheado<T> = { payload: T; status: 'ok' | 'sem_dado'; consultadoEm: string }

type Sb = { from: (t: string) => any }

export async function lerFonteCache<T = any>(sb: Sb, fonte: string, chave: string, agora = Date.now()): Promise<Cacheado<T> | null> {
  if (!chave) return null
  try {
    const { data } = await sb.from('fonte_cache')
      .select('payload, status, consultado_em, expira_em')
      .eq('fonte', fonte).eq('chave', chave).maybeSingle()
    if (!data || new Date(data.expira_em).getTime() <= agora) return null
    return { payload: data.payload as T, status: data.status, consultadoEm: data.consultado_em }
  } catch {
    return null                             // cache nunca derruba a consulta
  }
}

export async function gravarFonteCache(sb: Sb, fonte: string, chave: string, payload: unknown,
  status: 'ok' | 'sem_dado' = 'ok', agora = Date.now()): Promise<string | null> {
  if (!chave) return null
  const consultadoEm = new Date(agora).toISOString()
  try {
    const { error } = await sb.from('fonte_cache').upsert({
      fonte, chave, status, payload: payload ?? {}, consultado_em: consultadoEm,
      expira_em: new Date(agora + ttlDaFonte(fonte)).toISOString(),
    }, { onConflict: 'fonte,chave' })
    if (error) console.warn('[fonte_cache] upsert falhou:', error.message)
  } catch (e: any) {
    console.warn('[fonte_cache] upsert falhou:', e?.message)
  }
  return consultadoEm
}

/**
 * Le do cache; se nao houver (ou vencido), executa `buscar`, grava o resultado e devolve.
 * `buscar` devolve { status, payload } ou lanca (falha nao e cacheada e propaga).
 */
export async function comFonteCache<T>(sb: Sb, fonte: string, chave: string,
  buscar: () => Promise<{ status: 'ok' | 'sem_dado'; payload: T }>): Promise<Cacheado<T> & { cacheHit: boolean }> {
  const hit = await lerFonteCache<T>(sb, fonte, chave)
  if (hit) return { ...hit, cacheHit: true }
  const r = await buscar()
  const consultadoEm = (await gravarFonteCache(sb, fonte, chave, r.payload, r.status)) || new Date().toISOString()
  return { payload: r.payload, status: r.status, consultadoEm, cacheHit: false }
}
