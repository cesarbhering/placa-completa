export default defineEventHandler(async (event) => {
  const { fipeCode } = getQuery(event)

  if (!fipeCode) {
    throw createError({ statusCode: 400, message: 'fipeCode is required' })
  }

  const { fipeApiToken, fipeApiUrl } = useRuntimeConfig()

  try {
    const response = await $fetch<{
      success: boolean
      data: {
        model: { id: number; name: string; brand: string; fipe_code: string }
        price_history: Array<{
          year: number
          fuel: string
          prices: Array<{ month: number; year: number; price: number; reference_code: number }>
        }>
      }
    }>(`${fipeApiUrl}/models/fipe/${fipeCode}/price-history`, {
      headers: {
        Authorization: `Bearer ${fipeApiToken}`,
      },
    })

    if (!response.success || !response.data) {
      return { success: false, data: null }
    }

    const { model, price_history } = response.data

    // Build price table: latest price per year/fuel combo
    const priceTable = price_history.map((entry) => {
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

    // Build history chart data: price evolution for the most recent year/fuel
    const mostRecent = price_history[0]
    const historyChart = mostRecent
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
      success: true,
      data: {
        modelName: model.name,
        brandName: model.brand,
        fipeCode: model.fipe_code,
        priceTable,
        historyChart,
        referenceLabel: mostRecent?.fuel || '',
      },
    }
  } catch {
    return { success: false, data: null }
  }
})
