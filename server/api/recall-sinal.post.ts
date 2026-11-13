import { normalizarMarcaRecall } from '../../shared/marcas-recall'
import { consultarRecallToyota } from '../utils/recall-toyota'
import { sinalDoRecall, marcaTemRecall, RECALL_INDISPONIVEL, type SinalRecall } from '../utils/sinal-recall'
import { dentroDoTetoDeSinal } from '../utils/sinal-leilao'
import { getClientIp } from '../utils/client-ip'
import { chassiDoPayload } from '../utils/chassi-servidor'
import { lerPlacaCacheFresca } from '../utils/placa-lookup'
import { perfilDoSinal, textoCurto, TAM_MARCA } from '../utils/perfil-sinal'
import { placaBloqueadaComRegistro } from '../utils/blocklist'

// Sinal de RECALL pra CONSULTA GRATIS. Endpoint proprio (como o leilao-sinal):
// nao atrasa a consulta gratis, cacheia por placa, e mantem a muralha num
// arquivo so. So Toyota/Lexus por ora.
//
// O que sai daqui: { consta, nivel }. Nada mais (nem nome da campanha, nem pdf).

/** 24h: a base de recall e por raspagem/import, nao muda de minuto a minuto. */
const TTL_MS = 24 * 60 * 60 * 1000
/** Teto curto: se a API demorar, a consulta gratis segue sem o sinal. */
// 5s (era 3s): com a leiloes-api lenta (medicao pesada no leiloes-poc-db) os
// dois sinais davam "sem_sinal" numa venda (NIY4575, 01/out). A consulta gratis
// nao espera por isto (chamada propria, depois do resultado na tela).
const TIMEOUT_MS = 5000

const cache = new Map<string, { em: number; sinal: SinalRecall }>()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const placa = String(body?.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  if (placa.length !== 7) return RECALL_INDISPONIVEL

  // Fora do escopo (nao Toyota/Lexus): nao consultamos e nao afirmamos nada.
  // INDISPONIVEL (nao "nao consta"): a tela fica em silencio.
  // "CHEV" (SENATRAN) vira "CHEVROLET" pra /v1/recall (e pro cache).
  // Esta primeira triagem usa a marca do corpo (com teto de tamanho) so pra
  // sair cedo, antes de qualquer leitura; a marca que VALE e conferida de novo
  // la embaixo com o que o servidor guarda da placa.
  const marcaDoCorpo = normalizarMarcaRecall(textoCurto(body?.marca, TAM_MARCA) || '')
  if (!marcaTemRecall(marcaDoCorpo)) return RECALL_INDISPONIVEL

  // Mesmo motivo do leilao-sinal: sem teto da pra varrer placa por placa. IP
  // REAL do visitante e contador PROPRIO do recall (a consulta chama os dois).
  const ip = getClientIp(event)
  if (!dentroDoTetoDeSinal(ip, Date.now(), 'recall')) return RECALL_INDISPONIVEL

  // Placa bloqueada a pedido do proprietario: a mesma resposta de "nao
  // sabemos", sem tocar no cache nem na base (igual ao leilao-sinal).
  if (placaBloqueadaComRegistro(event, placa)) return RECALL_INDISPONIVEL

  // Cache por placa+marca (a marca entra pra nao servir um sinal de outra marca
  // pra mesma placa por engano de um payload trocado). So entra no cache o que
  // foi calculado com os dados do SERVIDOR (ver abaixo), entao a leitura pela
  // marca do corpo so acha algo quando ela e a marca verdadeira da placa.
  const agora = Date.now()
  const emCache = cache.get(`${placa}|${marcaDoCorpo.toUpperCase()}`)
  if (emCache && agora - emCache.em < TTL_MS) return emCache.sinal

  // Chassi CHEIO do SERVIDOR (placa_cache, extra.chassi) -> firme; senao so
  // marca/modelo/ano -> suave. O body?.chassi do cliente e IGNORADO (a tela
  // nunca tinha o cheio, entao o recall gratis era sempre suave). Sufixo
  // mascarado nao serve pro recall (casa por VIN cheio). So le o cache.
  const doServidor = await lerPlacaCacheFresca(placa)
  const chassi = chassiDoPayload(doServidor)
  // Marca, modelo e ano tambem saem do que o servidor guarda da placa
  // (server/utils/perfil-sinal.ts); o corpo so preenche o que falta, com
  // tamanho limitado, e nesse caso o resultado nao vai pro cache.
  const perfil = perfilDoSinal(doServidor, body)
  const marca = normalizarMarcaRecall(perfil.marca || '')
  if (!marcaTemRecall(marca)) return RECALL_INDISPONIVEL
  const resposta = await consultarRecallToyota({
    placa,
    chassi: chassi.tipo === 'completo' ? chassi.chassi : null,
    marca,
    modelo: normalizarMarcaRecall(perfil.modelo || '') || null,
    ano: perfil.ano,
    ano_fab: perfil.anoFab,
    ano_mod: perfil.anoModelo,
  }, { timeoutMs: TIMEOUT_MS }).catch(() => null)

  const sinal = sinalDoRecall(resposta)

  // Guarda so quando a API respondeu (resposta != null). Guardar o vazio de um
  // timeout ensinaria o cache a mentir por 24h. E so o resultado calculado com
  // o que o servidor sabe da placa, na chave da marca do servidor.
  if (resposta && !perfil.doCorpo) {
    cache.set(`${placa}|${marca.toUpperCase()}`, { em: agora, sinal })
    if (cache.size > 5000) {
      for (const [k, v] of cache) if (agora - v.em >= TTL_MS) cache.delete(k)
      if (cache.size > 5000) cache.clear()
    }
  }

  return sinal
})
