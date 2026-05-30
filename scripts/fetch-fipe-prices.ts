/**
 * Pre-build script: fetches FIPE prices for all models with fipeCode
 * and saves them to data/fipe-prices.json for static prerender.
 *
 * Usage: npx tsx scripts/fetch-fipe-prices.ts
 */

import { fipeBrands } from '../data/fipe-brands'
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
}

async function fetchPrices(fipeCode: string): Promise<FipePriceData | null> {
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

    const priceTable: PriceEntry[] = price_history.map((entry: any) => {
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

    const mostRecent = price_history[0]
    const historyChart: ChartPoint[] = mostRecent
      ? mostRecent.prices
          .slice(0, 12)
          .reverse()
          .map((p: any) => ({
            month: p.month,
            year: p.year,
            price: p.price,
            label: `${String(p.month).padStart(2, '0')}/${p.year}`,
          }))
      : []

    return {
      modelName: model.name,
      brandName: model.brand,
      fipeCode: model.fipe_code,
      priceTable,
      historyChart,
      referenceLabel: mostRecent?.fuel || '',
    }
  } catch (error) {
    console.error(`  [FAIL] fipeCode=${fipeCode}:`, error)
    return null
  }
}

async function main() {
  console.log('Fetching FIPE prices...')
  console.log(`API: ${API_URL}`)

  const results: Record<string, FipePriceData> = {}
  let success = 0
  let failed = 0

  for (const brand of Object.values(fipeBrands)) {
    for (const model of brand.models) {
      if (!model.fipeCode) continue

      const key = `${brand.slug}-${model.slug}`
      console.log(`  Fetching ${brand.name} ${model.name} (fipeCode=${model.fipeCode})...`)

      const data = await fetchPrices(model.fipeCode)
      if (data) {
        results[key] = data
        success++
        console.log(`  [OK] ${data.modelName}: ${data.priceTable.length} prices`)
      } else {
        failed++
      }
    }
  }

  const outPath = resolve(__dirname, '../data/fipe-prices.json')
  writeFileSync(outPath, JSON.stringify(results, null, 2))

  console.log(`\nDone! ${success} models fetched, ${failed} failed.`)
  console.log(`Saved to ${outPath}`)
}

main()
