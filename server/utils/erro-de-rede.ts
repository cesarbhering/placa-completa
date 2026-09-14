// Distingue falha de TRANSPORTE de falha de NEGOCIO.
//
// Nasceu de um incidente: numa oscilacao de rede da VPS, o POST do
// consentimento morreu com "fetch failed", o pedido virou falha e o cliente
// que tinha acabado de pagar levou estorno em vez do relatorio. Tentar de novo
// teria resolvido em dois segundos.
//
// A separacao importa porque repetir a chamada errada custa caro nos dois
// sentidos: repetir um 401 gasta tempo e nao muda nada; NAO repetir um
// "fetch failed" joga fora uma venda ja paga.

const SINAIS_DE_TRANSPORTE = [
  'fetch failed',
  'econnreset',
  'etimedout',
  'econnrefused',
  'eai_again',
  'enotfound',
  'socket hang up',
  'network',
  'timeout',
  'aborted',
]

/** HTTP que a gente trata como transporte: o pedido nem chegou a ser atendido. */
const HTTP_DE_TRANSPORTE = [502, 503, 504]

export function ehErroDeRede(e: any): boolean {
  if (!e) return false
  const status = Number(e?.statusCode || e?.status || e?.response?.status || 0)
  // 4xx e resposta de negocio: a outra ponta entendeu e disse nao. Repetir
  // nunca ajuda e pode piorar (401 repetido vira bloqueio).
  if (status >= 400 && status < 500) return false
  if (HTTP_DE_TRANSPORTE.includes(status)) return true
  const texto = `${e?.message || ''} ${e?.cause?.message || ''} ${e?.code || ''} ${e?.cause?.code || ''}`.toLowerCase()
  return SINAIS_DE_TRANSPORTE.some((sinal) => texto.includes(sinal))
}

export function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Repete `fn` so quando a falha foi de transporte. As pausas crescem (2s, 5s,
 * 10s) porque oscilacao de rede costuma durar segundos: insistir na mesma hora
 * so repete o erro.
 */
export async function comRetryDeRede<T>(
  fn: () => Promise<T>,
  opts: { tentativas?: number; pausas?: number[]; onRetry?: (tentativa: number, erro: any) => void } = {},
): Promise<T> {
  const tentativas = opts.tentativas ?? 3
  const pausas = opts.pausas ?? [2000, 5000, 10000]
  let ultimo: any
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn()
    } catch (e: any) {
      ultimo = e
      if (!ehErroDeRede(e) || i === tentativas - 1) throw e
      opts.onRetry?.(i + 1, e)
      await esperar(pausas[Math.min(i, pausas.length - 1)])
    }
  }
  throw ultimo
}
