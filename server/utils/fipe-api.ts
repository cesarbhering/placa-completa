// Ponto unico de chamada a fipe-api (Relatorio 2.0, item c): timeout, log em api_chamadas e cache por
// codigo FIPE no fonte_cache (7 dias) para a serie de precos. Antes cada chamador fazia $fetch solto,
// sem timeout em alguns (price-history), sem cache e sem log (invisivel no painel de APIs).
import { comFonteCache } from './fonte-cache'
import { registrarChamada } from './api-chamadas'

type Sb = { from: (t: string) => any }
type Opcoes = { timeoutMs?: number; sb?: Sb | null; pedidoId?: string | null; fetcher?: typeof $fetch; params?: Record<string, any> }

function sbPadrao(): Sb | null {
  try { return useSupabaseServer() } catch { return null }
}

/** GET {fipeApiUrl}{caminho} com Bearer, timeout e log. Lanca em erro (como o $fetch antigo). */
export async function fipeGet<T = any>(caminho: string, op: Opcoes = {}): Promise<T> {
  const config = useRuntimeConfig()
  const sb = op.sb === undefined ? sbPadrao() : op.sb
  const f = op.fetcher || $fetch
  const t0 = Date.now()
  try {
    const r = await f<T>(`${config.fipeApiUrl}${caminho}`, {
      headers: { Authorization: `Bearer ${config.fipeApiToken}` },
      timeout: op.timeoutMs ?? 8000,
      ...(op.params ? { params: op.params } : {}),
    } as any)
    registrarChamada(sb, { fonte: 'fipe', caminho, code: 200, ms: Date.now() - t0, pedidoId: op.pedidoId })
    return r as T
  } catch (e: any) {
    const code = e?.statusCode ?? e?.response?.status ?? null
    registrarChamada(sb, { fonte: 'fipe', caminho, code, ms: Date.now() - t0, pedidoId: op.pedidoId })
    throw e
  }
}

/**
 * Serie de precos de um codigo FIPE, com cache de 7 dias (fonte 'fipe_historico', chave = codigo).
 * Devolve o corpo bruto da fipe-api ({success, data} ou data) + consultadoEm. Falha nao e cacheada.
 */
export async function fipePriceHistory(codigoFipe: string, op: Opcoes = {}): Promise<{ bruto: any; consultadoEm: string; cacheHit: boolean }> {
  const sb = op.sb === undefined ? sbPadrao() : op.sb
  const caminho = `/models/fipe/${codigoFipe}/price-history`
  if (!sb) {
    return { bruto: await fipeGet(caminho, { ...op, sb: null }), consultadoEm: new Date().toISOString(), cacheHit: false }
  }
  const r = await comFonteCache(sb, 'fipe_historico', codigoFipe, async () => {
    const bruto = await fipeGet(caminho, { ...op, sb })
    const norm = (bruto as any)?.data || bruto
    return { status: norm?.price_history?.length ? 'ok' : 'sem_dado', payload: bruto }
  })
  if (r.cacheHit) registrarChamada(sb, { fonte: 'fipe', caminho, code: 200, ms: 0, cacheHit: true, pedidoId: op.pedidoId })
  return { bruto: r.payload, consultadoEm: r.consultadoEm, cacheHit: r.cacheHit }
}


/**
 * Estimativa de seguro de um modelo (id interno da fipe-api) num ano e numa
 * regiao SUSEP, com cache de 14 dias (fonte 'seguro_estimado', chave
 * modelo:ano:regiao). O valor so muda quando a base SUSEP e atualizada; antes
 * eram ~10 mil chamadas por semana sem cache, mediana de 0,6 s cada.
 * 404 (regiao sem amostra) vira 'sem_dado' cacheado, pra cascata nao repetir
 * a mesma tentativa perdida. Qualquer outra falha propaga e nao e cacheada.
 * Devolve o corpo bruto ou null quando a regiao nao tem estimativa.
 */
export async function fipeSeguroEstimado(modelId: number | string, ano: number, regiao: string, op: Opcoes = {}): Promise<any | null> {
  const sb = op.sb === undefined ? sbPadrao() : op.sb
  const caminho = `/models/${modelId}/insurance-estimate`
  const buscar = () => fipeGet<any>(caminho, { ...op, sb, params: { ano, regiao } })
  if (!sb) return buscar()
  const r = await comFonteCache(sb, 'seguro_estimado', `${modelId}:${ano}:${regiao}`, async () => {
    try {
      const bruto = await buscar()
      return { status: bruto?.data?.seguro?.premioMedioEstimado ? 'ok' : 'sem_dado', payload: bruto }
    } catch (e: any) {
      const code = e?.statusCode ?? e?.response?.status ?? null
      if (code === 404) return { status: 'sem_dado', payload: null }
      throw e
    }
  })
  if (r.cacheHit) registrarChamada(sb, { fonte: 'fipe', caminho, code: 200, ms: 0, cacheHit: true, pedidoId: op.pedidoId })
  return r.status === 'ok' ? r.payload : null
}
