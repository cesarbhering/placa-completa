// Cache das consultas wdapi2. O dado basico da placa (marca/modelo/ano/cor/
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

/**
 * Igual a consultarPlacaWdapi, mas diz TAMBEM se a resposta veio do cache.
 *
 * Existe porque o relatorio de uso precisa separar chamada real a API paga de
 * leitura do cache; sem isso o numero de "chamadas ao wdapi por canal" e
 * estimativa. Quem nao se importa com a origem continua usando a funcao de
 * sempre, que e um wrapper desta.
 *
 * cacheHit e false quando a placa nao foi encontrada, mesmo que a resposta
 * tenha saido do cache de nao-encontradas: nesse caminho tambem nao houve
 * chamada paga, mas nao houve consulta util nenhuma pra contabilizar.
 */
export async function consultarPlacaWdapiDetalhado(
  placa: string,
): Promise<{ payload: any | null; cacheHit: boolean }> {
  const placaClean = normalizarPlaca(placa)
  if (placaClean.length < 7) return { payload: null, cacheHit: false }
  const config = useRuntimeConfig()
  if (!config.placaApiToken) return { payload: null, cacheHit: false }

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
        // nao-encontrada ainda fresca: devolve null sem bater na wdapi.
        if (idade < TTL_NAO_ENCONTRADA_MS) return { payload: null, cacheHit: false }
      } else if (data.payload && idade < TTL_MS) {
        return { payload: data.payload, cacheHit: true }
      }
    }
  } catch (e: any) {
    // Cache indisponivel nao pode derrubar a consulta: cai pra API.
    console.warn('[placa_cache] leitura falhou:', e?.message)
  }

  // 2) API paga.
  let payload: any = null
  try {
    payload = await $fetch<Record<string, any>>(
      `https://wdapi2.com.br/consulta/${placaClean}/${config.placaApiToken}`,
    )
  } catch (e: any) {
    // 404/400 = placa genuinamente nao encontrada -> cacheia como nao-encontrada
    // (TTL curto) pra repique nao custar. Qualquer outro erro (500/rede/timeout)
    // e transitorio: NAO cacheia, so devolve null.
    const status = e?.status ?? e?.statusCode ?? e?.response?.status
    if (status === 404 || status === 400) gravar(false, null)
    return { payload: null, cacheHit: false }
  }

  // 3) grava no cache: encontrada (TTL longo) ou nao-encontrada (TTL curto).
  // So chega aqui quando a API RESPONDEU (2xx), entao resposta sem veiculo e um
  // nao-encontrado legitimo, nao erro de rede.
  if (temVeiculo(payload)) {
    gravar(true, payload)
    return { payload, cacheHit: false }
  }
  gravar(false, payload)
  return { payload, cacheHit: false }
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
