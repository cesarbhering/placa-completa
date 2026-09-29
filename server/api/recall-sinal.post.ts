import { consultarRecallToyota } from '../utils/recall-toyota'
import { sinalDoRecall, marcaTemRecall, RECALL_INDISPONIVEL, type SinalRecall } from '../utils/sinal-recall'
import { dentroDoTetoDeSinal } from '../utils/sinal-leilao'

// Sinal de RECALL pra CONSULTA GRATIS. Endpoint proprio (como o leilao-sinal):
// nao atrasa a consulta gratis, cacheia por placa, e mantem a muralha num
// arquivo so. So Toyota/Lexus por ora.
//
// O que sai daqui: { consta, nivel }. Nada mais (nem nome da campanha, nem pdf).

/** 24h: a base de recall e por raspagem/import, nao muda de minuto a minuto. */
const TTL_MS = 24 * 60 * 60 * 1000
/** Teto curto: se a API demorar, a consulta gratis segue sem o sinal. */
const TIMEOUT_MS = 3000

const cache = new Map<string, { em: number; sinal: SinalRecall }>()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const placa = String(body?.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  if (placa.length !== 7) return RECALL_INDISPONIVEL

  // Fora do escopo (nao Toyota/Lexus): nao consultamos e nao afirmamos nada.
  // INDISPONIVEL (nao "nao consta"): a tela fica em silencio.
  const marca = String(body?.marca || '').trim()
  if (!marcaTemRecall(marca)) return RECALL_INDISPONIVEL

  // Mesmo motivo do leilao-sinal: sem teto da pra varrer placa por placa. Reusa
  // o MESMO teto por IP (e a mesma superficie de sinal gratis).
  const ip = getRequestIP(event, { xForwardedFor: true }) || ''
  if (!dentroDoTetoDeSinal(ip)) return RECALL_INDISPONIVEL

  // Cache por placa+marca (a marca entra pra nao servir um sinal de outra marca
  // pra mesma placa por engano de um payload trocado).
  const chaveCache = `${placa}|${marca.toUpperCase()}`
  const agora = Date.now()
  const emCache = cache.get(chaveCache)
  if (emCache && agora - emCache.em < TTL_MS) return emCache.sinal

  // Chassi CHEIO quando a consulta tiver (extra.chassi) -> pega o firme; senao
  // vai so com marca/modelo/ano -> suave. Mesmo padrao de disponibilidade do
  // sinal-leilao: nenhuma chamada nova a fonte paga acontece por causa disto.
  const resposta = await consultarRecallToyota({
    placa,
    chassi: String(body?.chassi || '').trim() || null,
    marca,
    modelo: String(body?.modelo || '').trim() || null,
    ano: body?.ano ?? null,
    ano_fab: body?.anoFab ?? null,
    ano_mod: body?.anoModelo ?? null,
  }, { timeoutMs: TIMEOUT_MS }).catch(() => null)

  const sinal = sinalDoRecall(resposta)

  // Guarda so quando a API respondeu (resposta != null). Guardar o vazio de um
  // timeout ensinaria o cache a mentir por 24h.
  if (resposta) {
    cache.set(chaveCache, { em: agora, sinal })
    if (cache.size > 5000) {
      for (const [k, v] of cache) if (agora - v.em >= TTL_MS) cache.delete(k)
      if (cache.size > 5000) cache.clear()
    }
  }

  return sinal
})
