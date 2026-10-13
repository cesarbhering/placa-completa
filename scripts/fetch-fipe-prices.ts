/**
 * Pre-build script: fetches FIPE prices for all models with fipeCode (and the
 * extra versions in fipeCodes, aggregated per model year)
 * and saves them to data/fipe-prices.json for static prerender.
 *
 * Usage: npx tsx scripts/fetch-fipe-prices.ts
 */

import { fipeBrands } from '../data/fipe-brands'
import { agregarPorAno, estaAtual, referenciaAtual, rotuloAno, type EntradaHistorico, type Referencia, type ValorAno } from '../shared/fipe-por-ano'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const API_URL = process.env.FIPE_API_URL
const API_TOKEN = process.env.FIPE_API_TOKEN
if (!API_URL || !API_TOKEN) {
  console.error('FIPE_API_URL and FIPE_API_TOKEN must be set in the environment.')
  process.exit(1)
}

interface PriceEntry {
  year: number
  fuel: string
  price: number
  priceFormatted: string
  variation: number | null
  referenceMonth: number
  referenceYear: number
}

interface ChartPoint {
  month: number
  year: number
  price: number
  label: string
}

interface FipePriceData {
  modelName: string
  brandName: string
  fipeCode: string
  priceTable: PriceEntry[]
  historyChart: ChartPoint[]
  referenceLabel: string
  /** Mes da tabela usada (o mais recente da API no momento do fetch). */
  referencia: Referencia
  /** Valor por ano-modelo, juntando todas as versoes de fipeCodes. */
  porAno: ValorAno[]
  /** Versoes usadas no porAno (codigo e nome na FIPE). */
  versoes: { fipeCode: string; nome: string }[]
}

interface Bruto { fipeCode: string; nome: string; marca: string; historico: EntradaHistorico[] }

async function fetchHistorico(fipeCode: string): Promise<Bruto | null> {
  try {
    const response = await fetch(`${API_URL}/models/fipe/${fipeCode}/price-history`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    })
    const json = await response.json()
    if (!json.success || !json.data) {
      console.error(`  [FAIL] fipeCode=${fipeCode}: API returned success=false`)
      return null
    }
    const { model, price_history } = json.data
    return { fipeCode: String(model.fipe_code), nome: model.name, marca: model.brand, historico: price_history }
  } catch (error) {
    console.error(`  [FAIL] fipeCode=${fipeCode}:`, error)
    return null
  }
}

function montar(principal: Bruto, todas: Bruto[], ref: Referencia): FipePriceData {
  // So linhas com preco do mes atual: ano que saiu da tabela (0 km de modelo
  // fora de linha) ficava com o ultimo preco congelado e a referencia errada.
  const atuais = principal.historico.filter((e) => estaAtual(e, ref))

  const priceTable: PriceEntry[] = atuais.map((entry) => {
    const latestPrice = entry.prices[0]
    const previousPrice = entry.prices.length > 1 ? entry.prices[1] : null
    const variation = previousPrice
      ? ((latestPrice.price - previousPrice.price) / previousPrice.price) * 100
      : null
    return {
      year: entry.year,
      fuel: entry.fuel,
      price: latestPrice.price,
      priceFormatted: `R$ ${latestPrice.price.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      variation: variation !== null ? Math.round(variation * 10) / 10 : null,
      referenceMonth: latestPrice.month,
      referenceYear: latestPrice.year,
    }
  })

  const mostRecent = atuais[0]
  const historyChart: ChartPoint[] = mostRecent
    ? mostRecent.prices
        .slice(0, 12)
        .reverse()
        .map((p) => ({
          month: p.month,
          year: p.year,
          price: p.price,
          label: `${String(p.month).padStart(2, '0')}/${p.year}`,
        }))
    : []

  return {
    modelName: principal.nome,
    brandName: principal.marca,
    fipeCode: principal.fipeCode,
    priceTable,
    historyChart,
    referenceLabel: mostRecent ? rotuloAno(mostRecent.fuel) : '',
    referencia: ref,
    porAno: agregarPorAno(todas.map((b) => b.historico), ref),
    versoes: todas.map((b) => ({ fipeCode: b.fipeCode, nome: b.nome })),
  }
}

async function main() {
  console.log('Fetching FIPE prices...')
  console.log(`API: ${API_URL}`)

  const brutos: { key: string; principal: Bruto; todas: Bruto[] }[] = []
  let failed = 0

  for (const brand of Object.values(fipeBrands)) {
    for (const model of brand.models) {
      const codigos = [...new Set([model.fipeCode, ...(model.fipeCodes || [])].filter(Boolean) as string[])]
      if (!codigos.length) continue

      const key = `${brand.slug}-${model.slug}`
      console.log(`  Fetching ${brand.name} ${model.name} (${codigos.length} versao(oes))...`)

      const todas: Bruto[] = []
      for (const c of codigos) {
        const b = await fetchHistorico(c)
        if (b) todas.push(b)
        else failed++
      }
      // A principal e o fipeCode (tabela da versao e grafico); sem ele, a primeira.
      const principal = todas.find((b) => b.fipeCode === (model.fipeCode || codigos[0]))
      if (!principal) {
        console.error(`  [FAIL] ${key}: versao principal sem dado`)
        continue
      }
      brutos.push({ key, principal, todas })
    }
  }

  const ref = referenciaAtual(brutos.flatMap((b) => b.todas.map((t) => t.historico)))
  if (!ref) {
    console.error('Nenhuma referencia FIPE encontrada; abortando sem sobrescrever o JSON.')
    process.exit(1)
  }

  const results: Record<string, FipePriceData> = {}
  for (const b of brutos) {
    results[b.key] = montar(b.principal, b.todas, ref)
    const r = results[b.key]
    console.log(`  [OK] ${b.key}: ${r.priceTable.length} linhas da versao, ${r.porAno.length} anos (${r.versoes.length} versoes)`)
  }

  const outPath = resolve(__dirname, '../data/fipe-prices.json')
  writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n')

  console.log(`\nDone! ${Object.keys(results).length} modelos, ${failed} versoes falharam. Referencia ${ref.month}/${ref.year}.`)
  console.log(`Saved to ${outPath}`)
}

main()
