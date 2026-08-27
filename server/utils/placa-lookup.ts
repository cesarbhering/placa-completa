// Cache das consultas wdapi2. O dado basico da placa (marca/modelo/ano/cor/
// chassi/fipe) e praticamente estatico por placa, entao guardamos a resposta
// bruta no DB (placa_cache) e servimos dela por TTL_DIAS, evitando pagar a API
// a cada consulta/preview/estimativa da mesma placa. So o dado SENATRAN do
// premium NAO passa por aqui: aquele continua consulta real a cada pedido pago.
const TTL_DIAS = 180
const TTL_MS = TTL_DIAS * 24 * 60 * 60 * 1000

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
 * Retorna o payload bruto da wdapi2 (do cache quando fresco), ou null se nao deu
 * pra obter. Nao lanca: os call sites tratam null como "nao encontrado".
 */
export async function consultarPlacaWdapi(placa: string): Promise<any | null> {
  const placaClean = normalizarPlaca(placa)
  if (placaClean.length < 7) return null
  const config = useRuntimeConfig()
  if (!config.placaApiToken) return null

  const supabase = useSupabaseServer()

  // 1) cache: hit fresco devolve na hora, sem custo de API.
  try {
    const { data } = await supabase
      .from('placa_cache')
      .select('payload, fetched_at')
      .eq('placa', placaClean)
      .maybeSingle()
    if (data?.payload && data.fetched_at) {
      const idade = Date.now() - new Date(data.fetched_at).getTime()
      if (idade < TTL_MS) return data.payload
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
  } catch {
    return null
  }

  // 3) grava no cache so quando veio veiculo. Fire-and-forget: nao segura a
  // resposta ao usuario; upsert e idempotente sob concorrencia.
  if (temVeiculo(payload)) {
    supabase
      .from('placa_cache')
      .upsert(
        { placa: placaClean, payload, encontrado: true, fetched_at: new Date().toISOString() },
        { onConflict: 'placa' },
      )
      .then(({ error }: any) => { if (error) console.warn('[placa_cache] upsert falhou:', error.message) })
  }

  return payload
}
