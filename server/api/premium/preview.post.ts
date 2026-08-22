// Preview GRATIS pra confirmar o veiculo antes de pagar (marca/modelo/ano).
// Fonte free atual (wdapi2). NAO expoe nada de SENATRAN. Gated.
export default defineEventHandler(async (event) => {
  assertPremiumGate(event)
  const { placa } = await readBody(event)
  const placaClean = String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  if (placaClean.length < 7) throw createError({ statusCode: 400, message: 'Placa invalida' })
  // Fonte free via cache (placa_cache) pra nao pagar a wdapi de novo se a placa
  // ja foi consultada. Ver server/utils/placa-lookup.ts.
  const r = await consultarPlacaWdapi(placaClean)
  if (r) {
    return {
      placa: placaClean,
      encontrado: true,
      marca: r.MARCA || r.marca || null,
      modelo: r.MODELO || r.modelo || null,
      ano: r.anoModelo || r.ano || r.ANO || null,
      cor: r.cor || r.COR || null,
      // municipio/uf entram pra confirmacao pos-pagamento: sem a cidade, duas
      // placas parecidas do mesmo modelo e cor ficam indistinguiveis.
      municipio: r.municipio || null,
      uf: r.uf || null,
      raw: {
        marca: r.MARCA || r.marca, modelo: r.MODELO || r.modelo,
        ano: r.anoModelo || r.ano, cor: r.cor,
        municipio: r.municipio || null, uf: r.uf || null,
      },
    }
  }
  return { placa: placaClean, encontrado: false }
})
