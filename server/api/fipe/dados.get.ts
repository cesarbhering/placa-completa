import { createHash } from 'node:crypto'
import fipePrices from '~/data/fipe-prices.json'
import seguroModelos from '~/data/seguro-modelos.json'
import { fipeBrands } from '~/data/fipe-brands'
import { modelSeoData } from '~/data/fipe-model-intros'

// Entrega ao app os mesmos dados das paginas /tabela-fipe (docs/api-fipe-dados.md).
// Os dados sao fixos por build, entao o corpo e o ETag saem uma vez no load do
// modulo e cada chamada so compara If-None-Match.

// Mes mais recente entre as entradas de precos: a primeira linha do priceTable
// de cada entrada carrega o referenceMonth/referenceYear daquele modelo.
function mesMaisRecente(precos: Record<string, { priceTable: Array<{ referenceMonth: number; referenceYear: number }> }>) {
  let mes = 0
  let ano = 0
  for (const entrada of Object.values(precos)) {
    const linha = entrada.priceTable[0]
    if (!linha) continue
    if (linha.referenceYear * 100 + linha.referenceMonth > ano * 100 + mes) {
      mes = linha.referenceMonth
      ano = linha.referenceYear
    }
  }
  return { mes, ano }
}

const corpo = {
  versao: 1,
  referencia: mesMaisRecente(fipePrices as any),
  marcas: fipeBrands,
  precos: fipePrices,
  intros: modelSeoData,
  seguro: seguroModelos,
}
const etag = `"${createHash('sha1').update(JSON.stringify(corpo)).digest('hex')}"`

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
  setResponseHeader(event, 'ETag', etag)

  if (getHeader(event, 'if-none-match') === etag) {
    setResponseStatus(event, 304)
    return null
  }
  return corpo
})
