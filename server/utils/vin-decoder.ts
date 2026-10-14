import { comFonteCache } from './fonte-cache'
import { registrarChamada } from './api-chamadas'
// Chama o servico interno vin-decoder (services/vin-decoder), rede docker,
// sem porta publica. FAIL-OPEN de proposito: timeout curto e qualquer erro
// devolvem null — o relatorio sai sem o bloco "Origem do chassi" em vez de
// quebrar a entrega. Nunca deixa o decode ser o motivo de um pedido falhar.
export interface ChassiOrigem {
  /**
   * Digito verificador (posicao 9). So existe de fato na America do Norte:
   * fora disso vem null ("nao se aplica"), nunca false. O card NAO mostra
   * este campo; ele nao pode virar alerta de "chassi invalido".
   */
  checksumOk: boolean | null
  fabricante: string | null
  pais: string | null
  regiao: string | null
  anoModelo: number | null
  planta: string | null
  /**
   * Cidade da fabrica, so quando confirmada (ver services/vin-decoder,
   * scripts/plants-br.mjs: cada codigo passou por fonte publica MAIS a nossa
   * base de leiloes). null quando o codigo nao foi confirmado: o relatorio
   * mostra montadora e pais, que continuam verdadeiros, e nao inventa cidade.
   */
  plantaDetalhe: { cidade: string | null; uf: string | null; pais: string | null } | null
  /** Quando o decode foi feito (cache de 30 d; Relatorio 2.0). */
  consultadoEm?: string | null
}

/**
 * `registro` e opcional: com o modelo e o ano do registro (SENATRAN), o
 * decoder aplica a regra de fabrica por MODELO onde a posicao 11 do chassi
 * nao separa a fabrica (Toyota 9BR: Corolla em Indaiatuba, Yaris em Sorocaba)
 * e usa o ano real nas janelas de ano, em vez do ano do VIN (ambiguo no ciclo
 * de 30 anos).
 */
export async function decodificarChassi(
  chassi: string | null | undefined,
  registro?: { modelo?: string | null; ano?: number | string | null },
): Promise<ChassiOrigem | null> {
  const vin = String(chassi || '').trim().toUpperCase()
  if (vin.length !== 17) return null

  const query: Record<string, string> = {}
  const modelo = String(registro?.modelo || '').trim()
  if (modelo) query.modelo = modelo.slice(0, 120)
  const ano = Number(registro?.ano)
  if (Number.isInteger(ano) && ano > 1900 && ano < 2100) query.ano = String(ano)

  const config = useRuntimeConfig()
  const sb = (() => { try { return useSupabaseServer() } catch { return null } })()
  const decodificar = async (): Promise<ChassiOrigem | null> => {
    const t0 = Date.now()
    let res: any
    try {
      res = await $fetch<any>(`${config.vinDecoderUrl}/decode/${vin}`, {
        method: 'GET',
        query,
        // 3s, nao 500ms: a chamada e interna na rede docker e responde em menos
        // de 10ms com a maquina calma, mas sob load alto ja levou 4,5s e o
        // relatorio saiu sem a secao, congelado assim no snapshot. O custo de
        // esperar e zero (nao ha cobranca por chamada) e o relatorio ja tolera
        // 15s do servico de leilao.
        timeout: 3000,
      })
      registrarChamada(sb, { fonte: 'vin_decoder', caminho: '/decode/' + vin, code: 200, ms: Date.now() - t0 })
    } catch (e: any) {
      registrarChamada(sb, { fonte: 'vin_decoder', caminho: '/decode/' + vin, code: e?.statusCode ?? null, ms: Date.now() - t0 })
      throw e
    }
    if (!res?.valido) return null
    return {
      checksumOk: typeof res.checksumOk === 'boolean' ? res.checksumOk : null,
      fabricante: res.fabricante ?? null,
      pais: res.pais ?? null,
      regiao: res.regiao ?? null,
      anoModelo: res.anoModelo ?? null,
      planta: res.planta ?? null,
      plantaDetalhe: res.plantaDetalhe ?? null,
    }
  }
  try {
    // Relatorio 2.0: cache 30 d (o decode depende do VIN e do modelo/ano do registro, nao muda)
    if (sb) {
      const r = await comFonteCache(sb, 'chassi', [vin, query.modelo || '', query.ano || ''].join('|'), async () => {
        const o = await decodificar()
        return { status: o ? 'ok' : 'sem_dado', payload: o }
      })
      return r.status === 'ok' && r.payload ? { ...r.payload, consultadoEm: r.consultadoEm } : null
    }
    return await decodificar()
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
