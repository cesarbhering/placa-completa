// Alerta que sai de homolog/staging tem que se identificar (pedido do Cesar,
// 05/out): um teste com GFN9891 chegou igual a um alerta de prod e pareceu
// cliente pagando 2x. Fora de prod = ambiente protegido (gated, o mesmo
// criterio das tags de analytics) OU banco de staging.

const REF_STAGING = 'nqhlxsvggrumgcceamwg'
export const TAG_HOMOLOG = '[HOMOLOG]'

export function ambienteForaDeProd(cfg: any = useRuntimeConfig()): boolean {
  if (cfg?.public?.gated || cfg?.public?.homolog || cfg?.public?.staging) return true
  const urls = [cfg?.supabaseUrl, cfg?.premiumSupabaseUrl, cfg?.public?.supabaseUrl].map((u) => String(u || ''))
  return urls.some((u) => u.includes(REF_STAGING))
}

/** Prefixa "[HOMOLOG] " fora de prod (assunto, 1a linha de WhatsApp...). */
export function comTagAmbiente(texto: string, cfg?: any): string {
  let fora = false
  try { fora = ambienteForaDeProd(cfg ?? useRuntimeConfig()) } catch { fora = false }
  return fora && !texto.startsWith(TAG_HOMOLOG) ? `${TAG_HOMOLOG} ${texto}` : texto
}
