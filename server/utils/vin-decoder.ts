// Chama o servico interno vin-decoder (services/vin-decoder), rede docker,
// sem porta publica. FAIL-OPEN de proposito: timeout curto e qualquer erro
// devolvem null — o relatorio sai sem o bloco "Origem do chassi" em vez de
// quebrar a entrega. Nunca deixa o decode ser o motivo de um pedido falhar.
export interface ChassiOrigem {
  checksumOk: boolean
  fabricante: string | null
  pais: string | null
  regiao: string | null
  anoModelo: number | null
  planta: string | null
}

export async function decodificarChassi(chassi: string | null | undefined): Promise<ChassiOrigem | null> {
  const vin = String(chassi || '').trim().toUpperCase()
  if (vin.length !== 17) return null

  const config = useRuntimeConfig()
  try {
    const res = await $fetch<any>(`${config.vinDecoderUrl}/decode/${vin}`, {
      method: 'GET',
      timeout: 500,
    })
    if (!res?.valido) return null
    return {
      checksumOk: !!res.checksumOk,
      fabricante: res.fabricante ?? null,
      pais: res.pais ?? null,
      regiao: res.regiao ?? null,
      anoModelo: res.anoModelo ?? null,
      planta: res.planta ?? null,
    }
  } catch (e: any) {
    // Fora do ar, timeout, chassi 422: tudo cai aqui. So um log, sem propagar.
    console.warn('[vin-decoder] decode falhou (fail-open):', e?.message)
    return null
  }
}
