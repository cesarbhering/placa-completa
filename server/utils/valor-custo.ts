import { getRegiaoSusep } from './regiao-susep'
import { getSeguroEstimado } from './seguro-estimate'
import { calcularICV5, inferirCategoria } from './icv5'

// Valor FIPE, historico de depreciacao, seguro estimado e custo em 5 anos.
//
// Saiu da consulta gratis e virou conteudo pago, entao o relatorio precisa
// entregar. Vive aqui, fora do handler da consulta, porque agora dois fluxos
// pedem a mesma coisa e a versao antiga estava soldada no meio de
// consulta.post.ts (dependia de flags de PWA e do IP de quem consultava).
//
// A UF vem do veiculo, nao do IP: e o dado certo pro calculo, e no relatorio
// quem abre pode nao ser quem consultou.

export type ValorCusto = {
  fipe: string | null
  fipeModelo: string | null
  historico: { label: string; price: number }[] | null
  quedaAno: number | null      // % de variacao nos ultimos 12 meses
  seguroAnual: number | null
  percentualFipe: number | null
  custo5anos: number | null
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function pontos(historyData: any, anoModelo: string | number) {
  if (!historyData?.price_history?.length) return null
  const anoStr = String(anoModelo)
  let entries = historyData.price_history.find((h: any) => String(h.year) === anoStr)
  if (!entries) entries = historyData.price_history[0]
  if (!entries?.prices?.length) return null

  const ordenado = [...entries.prices].sort((a: any, b: any) =>
    new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime())

  const MAX = 8
  const amostra = ordenado.length > MAX
    ? Array.from({ length: MAX }, (_, i) => ordenado[Math.round(i * ((ordenado.length - 1) / (MAX - 1)))])
    : ordenado

  const pts = amostra
    .filter((h: any) => typeof h.price === 'number' && h.price > 0)
    .map((h: any) => ({ label: `${MESES[h.month - 1]}/${String(h.year).slice(2)}`, price: h.price }))
  return pts.length > 1 ? pts : null
}

export async function getValorCusto(placa: string, uf?: string | null, municipio?: string | null): Promise<ValorCusto | null> {
  const config = useRuntimeConfig()
  if (!config.placaApiToken) return null

  let dados: any = null
  try {
    dados = await $fetch<any>(`https://wdapi2.com.br/consulta/${placa}/${config.placaApiToken}`)
  } catch {
    return null
  }
  const lista = dados?.fipe?.dados
  if (!lista?.length) return null

  const melhor = lista.reduce((b: any, i: any) => ((i.score || 0) > (b.score || 0) ? i : b), lista[0])
  const fipe = melhor?.texto_valor || null
  const valorFipe = fipe ? parseFloat(String(fipe).replace(/[^\d,]/g, '').replace(',', '.')) : NaN
  const anoModelo = dados.anoModelo || dados.ano || null

  // historico + id do modelo (o id so existe nessa chamada, e o seguro precisa dele)
  let historico: ValorCusto['historico'] = null
  let fipeModelId: number | null = null
  if (melhor?.codigo_modelo) {
    try {
      const bruto = await $fetch<any>(
        `${config.fipeApiUrl}/models/fipe/${melhor.codigo_modelo}/price-history`,
        { headers: { Authorization: `Bearer ${config.fipeApiToken}` } },
      )
      const norm = bruto?.data || bruto
      fipeModelId = norm?.model?.id ?? null
      historico = pontos(norm, anoModelo)
    } catch { /* fail-open: sem historico o resto continua valendo */ }
  }

  const quedaAno = historico && historico.length > 1
    ? Math.round(((historico[historico.length - 1].price - historico[0].price) / historico[0].price) * 1000) / 10
    : null

  let seguroAnual: number | null = null
  let percentualFipe: number | null = null
  const anoNum = parseInt(String(anoModelo || ''), 10)
  if (fipeModelId && anoNum) {
    // Com o municipio a regiao SUSEP e mais precisa; sem ele cai no padrao da UF.
    const regiao = uf ? getRegiaoSusep(uf, municipio) : null
    const est = await getSeguroEstimado({
      fipeModelId,
      ano: anoNum,
      regiaoCode: regiao?.code ?? null,
      marca: dados.MARCA || dados.marca || '',
      modelo: dados.MODELO || dados.modelo || '',
    })
    if (est) {
      seguroAnual = est.premioAnual
      if (Number.isFinite(valorFipe) && valorFipe > 1000) {
        percentualFipe = Math.round((est.premioAnual / valorFipe) * 1000) / 10
      }
    }
  }

  let custo5anos: number | null = null
  if (uf && Number.isFinite(valorFipe) && valorFipe > 0) {
    try {
      const extra = dados.extra || {}
      custo5anos = calcularICV5({
        valorFipe,
        anoFabricacao: parseInt(String(dados.ano), 10) || new Date().getFullYear(),
        uf,
        categoria: inferirCategoria(extra.sub_segmento || '', extra.combustivel || ''),
      })?.custoTotal5anos ?? null
    } catch { /* fail-open */ }
  }

  return {
    fipe,
    fipeModelo: melhor?.texto_modelo || null,
    historico,
    quedaAno,
    seguroAnual,
    percentualFipe,
    custo5anos,
  }
}
