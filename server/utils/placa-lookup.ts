import { consultarPlacaFipe } from './placafipe'
import { registrarChamada } from './api-chamadas'

// Cache das consultas de placa (PlacaFipe primeiro, wdapi2 no fallback). O dado basico da placa (marca/modelo/ano/cor/
// chassi/fipe) e praticamente estatico por placa, entao guardamos a resposta
// bruta no DB (placa_cache) e servimos dela por TTL, evitando pagar a API a cada
// consulta/preview/estimativa da mesma placa. So o dado SENATRAN do premium NAO
// passa por aqui: aquele continua consulta real a cada pedido pago.
const TTL_DIAS = 180
const TTL_MS = TTL_DIAS * 24 * 60 * 60 * 1000
// Nao-encontradas tambem entram no cache, mas com TTL curto: placa invalida ou
// ainda nao registrada e repique nao pode custar uma chamada wdapi cada vez
// (foi um dos vetores do abuso). Curto porque uma placa pode passar a existir.
const TTL_NAO_ENCONTRADA_MS = 6 * 60 * 60 * 1000

function normalizarPlaca(placa: string): string {
  return String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
}

// Considera "encontrado" quando veio algum identificador de veiculo. Erros de
// rede ou respostas vazias nao entram no cache (nao viram "nao encontrado"
// permanente): so cacheamos acerto.
function temVeiculo(p: any): boolean {
  return !!(p && (p.MARCA || p.marca || p.MODELO || p.modelo || p.anoModelo))
}

export type FonteDados = 'cache' | 'placafipe' | 'wdapi'

export interface ResultadoConsultaPlaca {
  payload: any | null
  cacheHit: boolean
  /**
   * Quem respondeu: cache (sem custo), placafipe (franquia fixa) ou wdapi
   * (cobrada por chamada). null quando ninguem trouxe veiculo (nao encontrada,
   * fonte fora, placa invalida).
   */
  fonte: FonteDados | null
}

/**
 * Consulta da placa com a ordem cache -> PlacaFipe -> wdapi.
 *
 * PlacaFipe (plano fixo, 09/nov/2026) e a fonte primaria; a wdapi (cobrada por
 * chamada) so entra quando a primaria falha: erro, timeout, nao encontrada,
 * cota do dia esgotada ou disjuntor aberto (ver server/utils/placafipe.ts).
 * As duas devolvem o mesmo formato interno, entao quem chama nao muda nada.
 *
 * O nome ficou por compatibilidade: todo call site (consulta gratis, preview do
 * checkout, valor-custo e relatorio pago) passa por aqui.
 *
 * cacheHit e false quando a placa nao foi encontrada, mesmo que a resposta
 * tenha saido do cache de nao-encontradas: nesse caminho tambem nao houve
 * chamada paga, mas nao houve consulta util nenhuma pra contabilizar.
 */
export async function consultarPlacaWdapiDetalhado(placa: string): Promise<ResultadoConsultaPlaca> {
  const placaClean = normalizarPlaca(placa)
  const vazio: ResultadoConsultaPlaca = { payload: null, cacheHit: false, fonte: null }
  if (placaClean.length < 7) return vazio
  const config = useRuntimeConfig()
  const tokenPlacaFipe = String((config as any).placafipeToken || '')
  const tokenWdapi = String(config.placaApiToken || '')
  if (!tokenPlacaFipe && !tokenWdapi) return vazio

  const supabase = useSupabaseServer()

  // grava no cache sem segurar a resposta ao usuario; upsert idempotente por PK.
  const gravar = (encontrado: boolean, payload: any) => {
    supabase
      .from('placa_cache')
      .upsert(
        { placa: placaClean, payload: payload ?? {}, encontrado, fetched_at: new Date().toISOString() },
        { onConflict: 'placa' },
      )
      .then(({ error }: any) => { if (error) console.warn('[placa_cache] upsert falhou:', error.message) })
  }

  // 1) cache: hit fresco devolve na hora, sem custo de API. Encontradas valem
  // TTL_MS; nao-encontradas valem so TTL_NAO_ENCONTRADA_MS.
  try {
    const { data } = await supabase
      .from('placa_cache')
      .select('payload, encontrado, fetched_at')
      .eq('placa', placaClean)
      .maybeSingle()
    if (data?.fetched_at) {
      const idade = Date.now() - new Date(data.fetched_at).getTime()
      if (data.encontrado === false) {
        // nao-encontrada ainda fresca: devolve null sem bater em fonte nenhuma.
        if (idade < TTL_NAO_ENCONTRADA_MS) return vazio
      } else if (data.payload && idade < TTL_MS) {
        return { payload: data.payload, cacheHit: true, fonte: 'cache' }
      }
    }
  } catch (e: any) {
    // Cache indisponivel nao pode derrubar a consulta: cai pra API.
    console.warn('[placa_cache] leitura falhou:', e?.message)
  }

  // 2) fonte primaria (franquia fixa). Qualquer coisa que nao seja veiculo
  // encontrado segue pro fallback; o disjuntor evita martelar quando ela cai.
  if (tokenPlacaFipe) {
    const r = await consultarPlacaFipe(placaClean, tokenPlacaFipe, {
      aoTerminar: (http, ms) => registrarChamada(supabase, { fonte: 'placafipe', caminho: '/getplacafipe', code: http, ms }),
    })
    if (r.tipo === 'ok') {
      gravar(true, r.payload)
      return { payload: r.payload, cacheHit: false, fonte: 'placafipe' }
    }
  }

  // 3) fallback: wdapi, cobrada por chamada.
  if (!tokenWdapi) return vazio
  let payload: any = null
  const t0 = Date.now()
  try {
    payload = await $fetch<Record<string, any>>(
      `https://wdapi2.com.br/consulta/${placaClean}/${tokenWdapi}`,
    )
    registrarChamada(supabase, { fonte: 'wdapi', caminho: '/consulta/:placa/:token', code: 200, ms: Date.now() - t0 })
  } catch (e: any) {
    // 404/400 = placa genuinamente nao encontrada -> cacheia como nao-encontrada
    // (TTL curto) pra repique nao custar. Qualquer outro erro (500/rede/timeout)
    // e transitorio: NAO cacheia, so devolve null.
    const status = e?.status ?? e?.statusCode ?? e?.response?.status
    registrarChamada(supabase, { fonte: 'wdapi', caminho: '/consulta/:placa/:token', code: status ?? null, ms: Date.now() - t0 })
    if (status === 404 || status === 400) gravar(false, null)
    return vazio
  }

  // 4) grava no cache: encontrada (TTL longo) ou nao-encontrada (TTL curto).
  // So chega aqui quando a API RESPONDEU (2xx), entao resposta sem veiculo e um
  // nao-encontrado legitimo, nao erro de rede.
  if (temVeiculo(payload)) {
    gravar(true, payload)
    return { payload, cacheHit: false, fonte: 'wdapi' }
  }
  gravar(false, payload)
  return { payload, cacheHit: false, fonte: null }
}

/** Nome novo e neutro da mesma funcao (a fonte deixou de ser so a wdapi). */
export const consultarPlacaDetalhado = consultarPlacaWdapiDetalhado

/**
 * Numero do motor do payload interno, so quando inteiro (sem mascara).
 * Dado do VEICULO, mas so sai no relatorio PAGO (basica e completa): nunca na
 * consulta gratis, em log ou em analytics. Ver semMotor.
 */
export function motorDoPayload(payload: any): string | null {
  const bruto = String(payload?.extra?.motor ?? '').trim().toUpperCase()
  if (!bruto || bruto.includes('*')) return null
  const limpo = bruto.replace(/[^A-Z0-9]/g, '')
  return limpo.length >= 4 ? limpo : null
}

/**
 * Copia do payload SEM o numero do motor, pra tudo que sai da consulta gratis
 * (resposta do app, linha de `consultas`, e-mail, WhatsApp). O placa_cache
 * guarda o payload inteiro so no servidor.
 */
export function semMotor<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload
  const p: any = payload
  if (!p.extra || typeof p.extra !== 'object' || !('motor' in p.extra)) return payload
  const { motor: _motor, ...extra } = p.extra
  return { ...p, extra } as T
}

/**
 * So o cache: payload da placa se estiver no placa_cache como ENCONTRADA e
 * fresca (TTL_MS), senao null. Nao chama a API paga. Serve pro preview do
 * checkout decidir o teto: placa ja em cache nao custa wdapi, entao nao conta
 * nem e barrada (quem acabou de consultar gratis precisa conseguir comprar).
 */
export async function lerPlacaCacheFresca(placa: string): Promise<any | null> {
  const placaClean = normalizarPlaca(placa)
  if (placaClean.length < 7) return null
  try {
    const { data } = await useSupabaseServer()
      .from('placa_cache')
      .select('payload, encontrado, fetched_at')
      .eq('placa', placaClean)
      .maybeSingle()
    if (!data?.fetched_at || data.encontrado === false || !data.payload) return null
    return Date.now() - new Date(data.fetched_at).getTime() < TTL_MS ? data.payload : null
  } catch {
    return null
  }
}

/**
 * Retorna o payload bruto da wdapi2 (do cache quando fresco), ou null se nao deu
 * pra obter / placa nao encontrada. Nao lanca: os call sites tratam null como
 * "nao encontrado".
 */
export async function consultarPlacaWdapi(placa: string): Promise<any | null> {
  return (await consultarPlacaWdapiDetalhado(placa)).payload
}
