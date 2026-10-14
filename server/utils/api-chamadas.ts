// Log leve de chamadas a APIs externas (Relatorio 2.0, item c). Tabela public.api_chamadas.
// Uma linha por chamada: fonte, endpoint SEM placa/chassi/token, HTTP code, ms, cache_hit. Nunca payload.
// Fire-and-forget: o log nunca atrasa nem derruba a consulta.

type Sb = { from: (t: string) => any }

/** Troca identificadores do caminho por marcadores: placa, chassi, codigo FIPE, numeros, tokens. */
export function endpointSemDado(caminho: string): string {
  const semQuery = String(caminho || '').split('?')[0]
  return semQuery
    .split('/')
    .map((p) => {
      if (!p) return p
      if (/^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/i.test(p)) return ':placa'
      if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(p)) return ':vin'
      if (/^\d{6}-\d$/.test(p)) return ':cod'               // codigo FIPE 001234-5
      if (/^\d+$/.test(p)) return ':id'
      if (p.length >= 20) return ':token'
      return p
    })
    .join('/')
    .slice(0, 120)
}

export function registrarChamada(sb: Sb | null, c: {
  fonte: string; caminho: string; code: number | null; ms: number; cacheHit?: boolean; pedidoId?: string | null
}): void {
  if (!sb) return
  try {
    sb.from('api_chamadas').insert({
      fonte: c.fonte, endpoint: endpointSemDado(c.caminho), code: c.code, ms: Math.round(c.ms),
      cache_hit: !!c.cacheHit, pedido_id: c.pedidoId ?? null,
    }).then(({ error }: any) => { if (error) console.warn('[api_chamadas] insert falhou:', error.message) },
      () => {})
  } catch { /* nunca propaga */ }
}
