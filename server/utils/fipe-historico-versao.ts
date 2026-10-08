import { marcaDoRegistro, marcaParaFipeApi } from './fipe-candidato'
import { pontos } from './valor-custo'
import { tabelaDoSegmento } from '../../shared/tabela-fipe'

// Historico de preco de UMA versao da shortlist ambigua, sob demanda (o
// acordeao "versoes compativeis" do relatorio). So responde codigo FIPE que
// esta na shortlist do snapshot do proprio relatorio: sem isso o endpoint
// virava proxy aberto da fipe-api.
//
// A fipe-api nao busca historico pelo codigo FIPE ("002061-3"), so pelo codigo
// interno do modelo ("2229"). Ele sai do nome da versao dentro da marca.

export interface AlvoHistorico {
  modelo: string
  marca: string
  anoModelo: string | number
}

const CODIGO_FIPE = /^\d{6}-\d$/

/** Valida o pedido contra o snapshot. null = nao autorizado/nao existe. */
export function alvoDoSnapshot(snapshot: any, codigo: string): AlvoHistorico | null {
  if (!CODIGO_FIPE.test(String(codigo || ''))) return null
  const candidatos = snapshot?.valorCusto?.fipeCandidato?.candidatos
  if (!Array.isArray(candidatos)) return null
  const c = candidatos.find((x: any) => x?.codigo_fipe === codigo)
  if (!c?.modelo) return null
  const resp = snapshot?.consulta?.response
  const reg = Array.isArray(resp) ? resp[0] : resp
  const anoModelo = reg?.anoModelo
  const marcaReg = marcaDoRegistro(reg?.descricaoMarcaModelo)
  if (!anoModelo || !marcaReg) return null
  const tabela = tabelaDoSegmento(snapshot?.segmento)
  return { modelo: String(c.modelo), marca: marcaParaFipeApi(marcaReg, tabela), anoModelo }
}

const cache = new Map<string, { em: number; pts: { label: string; price: number }[] | null }>()
const TTL = 12 * 60 * 60 * 1000

async function json(url: string, token: string): Promise<any> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) })
  if (!r.ok) return null
  const b = await r.json()
  return b?.data ?? b
}

/** Codigo interno do modelo pelo nome, em toda marca com esse nome (carro e caminhao podem ter o mesmo). */
async function codigoModelo(alvo: AlvoHistorico, url: string, token: string): Promise<string | null> {
  const marcas = await json(`${url}/brands`, token)
  if (!Array.isArray(marcas)) return null
  const chave = alvo.marca.trim().toLowerCase()
  for (const b of marcas.filter((m: any) => String(m?.name || '').trim().toLowerCase() === chave)) {
    const modelos = await json(`${url}/brands/${b.id}/models`, token)
    const m = Array.isArray(modelos) ? modelos.find((x: any) => String(x?.name || '').trim() === alvo.modelo.trim()) : null
    if (m?.fipe_code) return String(m.fipe_code)
  }
  return null
}

export async function historicoDaVersao(alvo: AlvoHistorico, codigo: string, url: string, token: string) {
  const k = `${codigo}|${alvo.anoModelo}`
  const hit = cache.get(k)
  if (hit && Date.now() - hit.em < TTL) return hit.pts
  let pts: { label: string; price: number }[] | null = null
  try {
    const cm = await codigoModelo(alvo, url, token)
    if (cm) pts = pontos(await json(`${url}/models/fipe/${cm}/price-history`, token), alvo.anoModelo)
  } catch { pts = null }
  cache.set(k, { em: Date.now(), pts })
  if (cache.size > 500) cache.clear()
  return pts
}
