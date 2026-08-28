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

// O digito 10 do VIN codifica o ano num ciclo de 30 anos: 'S' e 1995 e
// tambem 2025. O vin-decoder, que nao conhece o registro do veiculo, sempre
// escolhe o candidato mais recente. Na montagem do relatorio a gente TEM o
// ano do registro, entao escolhe o candidato do ciclo que bate com ele.
//
// Regra: candidatos = ano do decoder menos multiplos de 30; vence o mais
// proximo do ano de referencia, e so se ficar a no maximo 1 ano de distancia
// (fabricacao em dezembro vira ano-modelo seguinte). Sem referencia utilizavel
// ou sem candidato proximo, devolve null: melhor omitir o ano do chassi do que
// contradizer o registro do veiculo.
export function anoChassiCoerente(
  anoDecoder: number | null | undefined,
  anoReferencia: number | null | undefined,
): number | null {
  const ano = Number(anoDecoder)
  const ref = Number(anoReferencia)
  if (!Number.isFinite(ano) || ano <= 0) return null
  if (!Number.isFinite(ref) || ref < 1900 || ref > 2100) return ano
  let melhor: number | null = null
  let melhorDist = Infinity
  for (let candidato = ano; candidato >= 1950; candidato -= 30) {
    const dist = Math.abs(candidato - ref)
    if (dist < melhorDist) { melhor = candidato; melhorDist = dist }
  }
  return melhorDist <= 1 ? melhor : null
}

/** Aplica anoChassiCoerente sobre o resultado do decode, sem mutar o original. */
export function corrigirAnoChassi<T extends { anoModelo: number | null }>(
  origem: T | null,
  anoReferencia: number | null | undefined,
): T | null {
  if (!origem) return null
  const ano = anoChassiCoerente(origem.anoModelo, anoReferencia)
  if (ano === origem.anoModelo) return origem
  return { ...origem, anoModelo: ano }
}
