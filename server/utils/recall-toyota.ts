// Chamada ao endpoint de recall da leiloes-api (mesma base+key do historico de
// leilao: e o mesmo servico, que tem acesso ao leiloes-poc-db onde vive o
// recall_toyota_match). O container Nuxt NAO fala com o DB direto.
//
// So Toyota/Lexus por ora (a base de match e so dessas marcas). O gate de marca
// fica no endpoint; aqui a chamada e generica.

export interface RecallMatch {
  recall_id: string | number
  code: string | null
  name: string | null
  model: string | null
  /** Vem como string ("2015/2016") do /v1/recall; guardado cru. */
  model_year: number | string | null
  start_date: string | null
  /** firme = chassi bate (VIN cheio). suave = so modelo/ano. */
  nivel: 'firme' | 'suave'
  /** sempre 'consta_em_campanha' (a base nao sabe se ja foi atendido). */
  situacao: string
  pdf_r2: string | null
}

export interface RecallResposta {
  matches: RecallMatch[]
}

export interface PerfilRecall {
  placa?: string | null
  /** VIN CHEIO quando a consulta tiver (extra.chassi) -> pega o firme. */
  chassi?: string | null
  marca?: string | null
  modelo?: string | null
  ano?: number | null
  ano_fab?: number | null
  ano_mod?: number | null
}

function sanearMatches(bruto: unknown): RecallMatch[] {
  const arr = Array.isArray((bruto as any)?.matches) ? (bruto as any).matches : []
  const out: RecallMatch[] = []
  for (const m of arr) {
    if (!m || typeof m !== 'object') continue
    const nivel = (m as any).nivel === 'firme' ? 'firme' : 'suave'
    out.push({
      recall_id: (m as any).recall_id ?? '',
      code: (m as any).code ?? null,
      name: (m as any).name ?? null,
      model: (m as any).model ?? null,
      model_year: (m as any).model_year ?? null,
      start_date: (m as any).start_date ?? null,
      nivel,
      situacao: String((m as any).situacao || 'consta_em_campanha'),
      pdf_r2: (m as any).pdf_r2 ?? null,
    })
  }
  return out
}

export async function consultarRecallToyota(
  perfil: PerfilRecall,
  opts?: { timeoutMs?: number },
): Promise<RecallResposta | null> {
  const config = useRuntimeConfig()
  const base = String(config.leiloesApiUrl || '').replace(/\/+$/, '')
  const key = String(config.leiloesApiKey || '')
  if (!base || !key) return null

  // Precisa de ao menos marca (suave) ou chassi (firme); sem nada nao vale.
  const marca = String(perfil.marca || '').trim()
  const chassi = String(perfil.chassi || '').trim()
  if (!marca && !chassi) return null

  try {
    const res = await $fetch<any>(`${base}/v1/recall`, {
      method: 'POST',
      headers: {
        'X-API-Key': key,
        // Mesma marcacao de origem do historico, pra analise de uso nao virar ficcao.
        'X-Origem': config.public.gated ? 'homolog-premium' : 'prod-premium',
      },
      body: {
        placa: perfil.placa || null,
        chassi: chassi || null,
        marca: marca || null,
        modelo: String(perfil.modelo || '').trim() || null,
        // GOTCHA do contrato: ano/ano_fab/ano_mod sao STRING no /v1/recall
        // (mandar "2015"; int da 422). Ver reports/plano.
        ano: perfil.ano != null ? String(perfil.ano) : null,
        ano_fab: perfil.ano_fab != null ? String(perfil.ano_fab) : null,
        ano_mod: perfil.ano_mod != null ? String(perfil.ano_mod) : null,
      },
      timeout: opts?.timeoutMs || Number(config.leiloesApiTimeoutMs) || 15000,
    })
    return { matches: sanearMatches(res) }
  } catch (e: any) {
    // Fora do ar, timeout, key errada, 5xx: fail-open (a flag some, sem frase).
    console.warn('[leiloes-api] recall falhou (fail-open):', e?.message)
    return null
  }
}
