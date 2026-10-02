import { sinalDoHistorico, SINAL_INDISPONIVEL, dentroDoTetoDeSinal } from '../utils/sinal-leilao'
import { getClientIp } from '../utils/client-ip'
import { chassiDoServidor } from '../utils/chassi-servidor'

// Sinal de leilao para a CONSULTA GRATIS. Endpoint proprio, e nao um campo a
// mais no /api/consulta, por tres motivos: nao atrasa a consulta gratis (ela
// responde primeiro, o sinal chega depois), permite cache por placa sem mexer
// no cache da consulta, e mantem a muralha num arquivo so.
//
// O que sai daqui: { positivo, quantidade }. Nada mais. Ver sinal-leilao.ts.

/** 24h: a base de leilao e atualizada por raspagem, nao muda de minuto a minuto. */
const TTL_MS = 24 * 60 * 60 * 1000
/** Teto curto: se a API demorar, a consulta gratis segue sem o sinal. */
// 5s (era 3s): com a leiloes-api lenta (medicao pesada no leiloes-poc-db) os
// dois sinais davam "sem_sinal" numa venda (NIY4575, 01/out). A consulta gratis
// nao espera por isto (chamada propria, depois do resultado na tela).
const TIMEOUT_MS = 5000

const cache = new Map<string, { em: number; sinal: { positivo: boolean | null; quantidade: number } }>()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const placa = String(body?.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  if (placa.length !== 7) return SINAL_INDISPONIVEL

  // Sem teto, da pra varrer placa por placa e montar um indice de quais carros
  // tem passagem, que e o produto que a gente vende. Devolve INDISPONIVEL, nao
  // vazio: quem passou do teto nao pode receber "nao tem registro" como se
  // fosse resposta da base.
  // IP REAL do visitante (cf-connecting-ip), nao o interno do proxy: com o
  // interno o teto virava global. Contador proprio do leilao.
  const ip = getClientIp(event)
  if (!dentroDoTetoDeSinal(ip, Date.now(), 'leilao')) return SINAL_INDISPONIVEL

  const agora = Date.now()
  const emCache = cache.get(placa)
  if (emCache && agora - emCache.em < TTL_MS) return emCache.sinal

  // Chassi do SERVIDOR (placa_cache da consulta gratis): completo quando a
  // WDAPI mandou extra.chassi, senao o sufixo mascarado. O body?.chassi do
  // cliente e IGNORADO (era o prefixo "LJ11K*****", so a montadora). So le o
  // cache: nenhuma chamada nova a fonte paga. O chassi nao sai daqui.
  const { chassi } = await chassiDoServidor(placa)
  const historico = await consultarHistoricoLeilao({
    placa,
    chassi,
    marca: String(body?.marca || '').trim() || null,
    modelo: String(body?.modelo || '').trim() || null,
    ano: body?.ano ?? null,
    ano_fab: body?.anoFab ?? null,
    ano_mod: body?.anoModelo ?? null,
    cor: String(body?.cor || '').trim() || null,
    uf: String(body?.uf || '').trim() || null,
  }, { timeoutMs: TIMEOUT_MS }).catch(() => null)

  // Sem historico (timeout, servico fora, key errada), sinalDoHistorico ja
  // devolve INDISPONIVEL: a tela nao mostra frase nenhuma.
  const sinal = sinalDoHistorico(historico)

  // Guarda so quando a API respondeu. Guardar o vazio de um timeout ensinaria
  // o cache a mentir por 24h pra uma placa que talvez tenha registro.
  if (historico) {
    cache.set(placa, { em: agora, sinal })
    // Teto de memoria: o processo e longo e o cache nao pode virar vazamento.
    if (cache.size > 5000) {
      for (const [k, v] of cache) {
        if (agora - v.em >= TTL_MS) cache.delete(k)
      }
      if (cache.size > 5000) cache.clear()
    }
  }

  return sinal
})
