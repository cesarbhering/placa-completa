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
  // Detalhe da campanha (leiloes-api, 15/out): todos opcionais.
  risco?: string | null
  o_que_fazer?: string | null
  fabricacao_de?: string | null
  fabricacao_ate?: string | null
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

/** Texto livre da campanha: so string, sem espaco sobrando, com teto. */
function textoCampo(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, ' ').trim().slice(0, 600)
  return s || null
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
      ...(textoCampo((m as any).risco) ? { risco: textoCampo((m as any).risco) } : {}),
      ...(textoCampo((m as any).o_que_fazer) ? { o_que_fazer: textoCampo((m as any).o_que_fazer) } : {}),
      ...((m as any).fabricacao_de ? { fabricacao_de: String((m as any).fabricacao_de) } : {}),
      ...((m as any).fabricacao_ate ? { fabricacao_ate: String((m as any).fabricacao_ate) } : {}),
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

// ---------------------------------------------------------------------------
// MODO AUTORITATIVO (só Chevrolet/GM + chassi cheio): o /v1/recall com
// `autoritativo:true` devolve, além dos matches, um bloco vindo da fonte da GM
// que diz SE o recall está aberto pra ESTE chassi e QUAIS campanhas. É isso que
// vai no card de recall do relatório PAGO. Fail-open: se o bloco não vier (GM
// caiu), devolve null e o pago mantém o que já tem (SENATRAN/local).
// ---------------------------------------------------------------------------
export interface CampanhaAutoritativa {
  numero: string
  titulo: string
  descricao: string
  risco: string
  reparo: string
  data: string
}

export interface RecallAutoritativo {
  consultado: boolean
  tem_recall_aberto: boolean
  n_campanhas: number
  campanhas: CampanhaAutoritativa[]
}

function sanearAutoritativo(bruto: unknown): RecallAutoritativo | null {
  if (!bruto || typeof bruto !== 'object') return null
  const b = bruto as any
  // consultado FALSE (GM não respondeu) conta como "não veio" -> null (fail-open).
  if (b.consultado !== true) return null
  const lista = Array.isArray(b.campanhas) ? b.campanhas : []
  return {
    consultado: true,
    tem_recall_aberto: b.tem_recall_aberto === true,
    n_campanhas: Number(b.n_campanhas) || lista.length,
    campanhas: lista.map((c: any) => ({
      numero: texto(c?.numero),
      titulo: texto(c?.titulo),
      descricao: texto(c?.descricao),
      risco: texto(c?.risco),
      reparo: texto(c?.reparo),
      data: texto(c?.data),
    })).filter((c: CampanhaAutoritativa) => Object.values(c).some((v) => v !== '')),
  }
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v)
}

/**
 * Consulta autoritativa GM (Chevrolet + chassi cheio). Devolve o bloco
 * autoritativo ou null (fail-open). Só chamar quando marca é Chevrolet/GM e o
 * chassi está completo — a decisão de gatear fica no chamador.
 */
export async function consultarRecallAutoritativo(
  perfil: PerfilRecall,
  opts?: { timeoutMs?: number },
): Promise<RecallAutoritativo | null> {
  const config = useRuntimeConfig()
  const base = String(config.leiloesApiUrl || '').replace(/\/+$/, '')
  const key = String(config.leiloesApiKey || '')
  if (!base || !key) return null
  const chassi = String(perfil.chassi || '').trim()
  if (!chassi) return null // autoritativo exige chassi cheio

  try {
    const res = await $fetch<any>(`${base}/v1/recall`, {
      method: 'POST',
      headers: {
        'X-API-Key': key,
        'X-Origem': config.public.gated ? 'homolog-premium' : 'prod-premium',
      },
      body: {
        placa: perfil.placa || null,
        chassi,
        marca: String(perfil.marca || '').trim() || null,
        modelo: String(perfil.modelo || '').trim() || null,
        ano: perfil.ano != null ? String(perfil.ano) : null,
        ano_fab: perfil.ano_fab != null ? String(perfil.ano_fab) : null,
        ano_mod: perfil.ano_mod != null ? String(perfil.ano_mod) : null,
        autoritativo: true,
      },
      timeout: opts?.timeoutMs || Number(config.leiloesApiTimeoutMs) || 15000,
    })
    return sanearAutoritativo(res?.autoritativo)
  } catch (e: any) {
    console.warn('[leiloes-api] recall autoritativo falhou (fail-open):', e?.message)
    return null
  }
}
