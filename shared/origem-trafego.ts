// Origem de trafego (marcas de anuncio) que viaja do client pro servidor.
//
// O plugin track-origin grava isto em sessionStorage assim que a pessoa cai no
// site; a consulta gratis e o checkout pago leem daqui. Ficar em shared/ evita
// a terceira copia do mesmo saneamento: a lista de campos e os limites de
// tamanho passam a existir num lugar so.

export interface OrigemTrafego {
  gclid: string | null
  msclkid: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
}

/** Campos lidos da URL, na ordem em que aparecem na tabela. */
export const CAMPOS_ORIGEM = ['gclid', 'msclkid', 'utm_source', 'utm_medium', 'utm_campaign'] as const

const LIMITES: Record<(typeof CAMPOS_ORIGEM)[number], number> = {
  gclid: 200,
  msclkid: 200,
  utm_source: 100,
  utm_medium: 100,
  utm_campaign: 150,
}

/**
 * Normaliza o que veio do client num objeto pronto pro insert: so os campos
 * conhecidos, so string, cada um no seu limite. Qualquer outra coisa vira null,
 * entao um payload adulterado nao entra no banco.
 */
export function sanearOrigem(bruto: unknown): OrigemTrafego {
  const o = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  const saida = {} as OrigemTrafego
  for (const campo of CAMPOS_ORIGEM) {
    const v = o[campo]
    saida[campo] = typeof v === 'string' && v.trim() ? v.slice(0, LIMITES[campo]) : null
  }
  return saida
}

/** Le a origem guardada pelo plugin track-origin. Client-side. */
export function origemDaSessao(): Record<string, string> | undefined {
  try {
    const raw = sessionStorage.getItem('pc_origin')
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}
