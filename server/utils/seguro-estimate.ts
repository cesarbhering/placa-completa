import { fipePriceHistory, fipeGet } from './fipe-api'
import { getRegiaoCatchAll } from './regiao-susep'

/**
 * Estimativa de seguro (fipe-api / base SUSEP corrigida por IPCA) com
 * cascata de regioes: regiao do usuario -> catch-all do estado -> '11'
 * (SP Met., maior amostra do pais). Fail-open: qualquer erro => null.
 *
 * Usada pelo fluxo da consulta (modal pos-sucesso) e pela pagina
 * /cotacao (link do email, recalcula a estimativa na hora do clique).
 */

export interface SeguroEstimado {
  premioAnual: number
  franquia: number
  regiao: { codigo: string; descricao: string }
  regiaoDoUsuario: boolean
  veiculo: { marca: string; modelo: string; ano: number }
}

export async function getSeguroEstimado(opts: {
  codigoModelo?: string
  fipeModelId?: number | null   // se ja conhecido, pula a chamada de price-history
  ano: number
  regiaoCode: string | null
  marca: string
  modelo: string
}): Promise<SeguroEstimado | null> {
  const config = useRuntimeConfig()
  const { codigoModelo, ano, regiaoCode, marca, modelo } = opts
  if (!ano) return null

  // 1. codigo_modelo -> model.id interno da fipe-api (se nao veio pronto)
  let fipeModelId: number | null = opts.fipeModelId ?? null
  if (!fipeModelId && codigoModelo) {
    try {
      const historyData = (await fipePriceHistory(String(codigoModelo), { timeoutMs: 4000 })).bruto   // cache 7 d + log
      const normalized = historyData?.data || historyData
      fipeModelId = normalized?.model?.id ?? null
    } catch {
      return null
    }
  }
  if (!fipeModelId) return null

  // 2. cascata de regioes
  const tentativas: { codigo: string; doUsuario: boolean }[] = []
  if (regiaoCode) {
    tentativas.push({ codigo: regiaoCode, doUsuario: true })
    const catchAll = getRegiaoCatchAll(regiaoCode)
    if (catchAll) tentativas.push({ codigo: catchAll, doUsuario: false })
  }
  if (!tentativas.some(t => t.codigo === '11')) tentativas.push({ codigo: '11', doUsuario: false })

  for (const tentativa of tentativas) {
    try {
      const est = await fipeGet<any>(`/models/${fipeModelId}/insurance-estimate`,
        { params: { ano, regiao: tentativa.codigo }, timeoutMs: 3000 })   // log em api_chamadas
      const d = est?.data
      if (d?.seguro?.premioMedioEstimado) {
        return {
          premioAnual: Math.round(d.seguro.premioMedioEstimado * 100) / 100,
          franquia: Math.round((d.seguro.franquiaMediaEstimada || 0) * 100) / 100,
          regiao: { codigo: d.regiao?.codigo ?? tentativa.codigo, descricao: d.regiao?.descricao ?? '' },
          regiaoDoUsuario: tentativa.doUsuario,
          veiculo: { marca, modelo, ano },
        }
      }
    } catch {
      // 404 dessa regiao ou API fora — tenta a proxima da cascata
    }
  }
  return null
}
