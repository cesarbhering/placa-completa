// Recall AUTORITATIVO da montadora no relatorio PAGO, por chassi: o status de
// cada campanha vem da propria montadora (aberto/realizado) e os atendimentos
// trazem data, concessionaria e, quando a fonte tem, km. Decisao do Cesar
// (01/out): roda pra TODO veiculo da marca com chassi cheio, sem depender da
// flag de recall do SENATRAN (e gratis e enriquece).
//
// Nissan, Mitsubishi e Mercedes-Benz vem CENTRALIZADOS na leiloes-api: POST /v1/recall
// {chassi, marca, modelo, ano_fab, ano_mod, autoritativo:true} devolve
// resp.autoritativo = {fonte, consultado, campanhas[{codigo,titulo,status}],
// atendimentos[{codigo,titulo,data,km,concessionaria}]}. Sem o campo, vale o
// match local (null aqui). `situacao` ("consta_em_campanha" | "nada_consta")
// e IGNORADA de proposito: quem decide sao as listas (sem campanha = o card
// do SENATRAN segue). Mercedes manda codigo null e as vezes km null.
// (Ate 01/out a Nissan era um GET direto no
// cloudfunctions da Nissan; a leiloes-api passou a cobrir no mesmo formato.)
//
// Fail-open: erro/timeout/formato estranho -> null, o relatorio segue sem o
// bloco. A fonte da montadora dentro da leiloes-api oscila: sem o campo, 1
// retry depois de ~2s, SO se a primeira voltou em menos de 10s. Timeout do site
// (40s) MAIOR que o da leiloes-api (30s). Roda pos-entrega, nao segura o
// loading. Cache por chassi (24h) so de resposta valida.
// Whitelist: codigo, titulo, status, data, km e concessionaria. Nada de chassi,
// nome, CPF, OS, texto longo nem codigo de peca.

export type FonteMontadora = 'nissan' | 'mitsubishi' | 'mercedes-benz'

export interface CampanhaMontadora {
  codigo: string
  titulo: string | null
  /** aberto = pendente na montadora; excluido = montadora tirou o veiculo da campanha. */
  status: 'aberto' | 'realizado' | 'excluido'
}

export interface AtendimentoMontadora {
  codigo: string | null
  titulo: string | null
  /** ISO (AAAA-MM-DD). */
  data: string | null
  km: number | null
  concessionaria: string | null
}

export interface RecallMontadora {
  fonte: FonteMontadora
  consultado: true
  tem_recall_aberto: boolean
  /** So as ABERTAS. */
  n_campanhas: number
  campanhas: CampanhaMontadora[]
  atendimentos: AtendimentoMontadora[]
}

const TTL_MS = 24 * 60 * 60 * 1000
/**
 * A leiloes-api espera ate 30s pela montadora (ordem do Cesar, 01/out); o site
 * espera 40s, MAIS que a API, pra receber o fail-open dela em vez de cortar
 * antes. Roda pos-entrega: nao segura o loading nem resposta ao cliente.
 */
const TIMEOUT_MS = 40000
/** Retry so se a 1a chamada voltou RAPIDO sem o campo (a API nao esperou a montadora). */
const RETRY_SE_ANTES_DE_MS = 10000
const RETRY_MS = 2000
const cache = new Map<string, { em: number; bloco: RecallMontadora }>()

export function marcaMontadora(desc: string | null | undefined): FonteMontadora | null {
  const d = String(desc || '')
  if (/\bnissan\b/i.test(d)) return 'nissan'
  if (/\b(mmc|mitsubishi)\b/i.test(d)) return 'mitsubishi'
  // Mercedes-Benz: o SENATRAN manda "M.BENZ/...", "MBENZ", "MERCEDES-BENZ".
  if (/\b(m\.?\s*benz|mercedes)\b/i.test(d)) return 'mercedes-benz'
  return null
}

const texto = (v: any, max = 160) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t && t !== 'None' && t !== 'null' ? t.slice(0, max) : null }
function isoData(v: any): string | null {
  const s = String(v ?? '')
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const b = s.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return b ? `${b[3]}-${b[2]}-${b[1]}` : null
}
function kmNum(v: any): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v) : null
  const d = String(v ?? '').replace(/\D/g, '')
  return d ? Number(d) : null
}
function ordenar(b: Omit<RecallMontadora, 'n_campanhas' | 'tem_recall_aberto'>): RecallMontadora {
  const ordem = { aberto: 0, realizado: 1, excluido: 2 } as const
  b.campanhas.sort((x, y) => ordem[x.status] - ordem[y.status])
  b.atendimentos.sort((x, y) => String(y.data || '').localeCompare(String(x.data || '')))
  const abertas = b.campanhas.filter((c) => c.status === 'aberto').length
  return { ...b, tem_recall_aberto: abertas > 0, n_campanhas: abertas }
}

/**
 * resp.autoritativo da leiloes-api -> formato unico. So aceita a fonte
 * esperada + consultado true. Copia campo a campo (whitelist): qualquer coisa
 * a mais que a API mande (nome, CPF, OS, placa, chassi) nao passa.
 */
export function sanearRecallAutoritativo(bruto: unknown, fonte: FonteMontadora): RecallMontadora | null {
  const b = bruto as any
  if (!b || typeof b !== 'object' || b.consultado !== true || String(b.fonte || '').toLowerCase() !== fonte) return null
  const campanhas: CampanhaMontadora[] = (Array.isArray(b.campanhas) ? b.campanhas : [])
    .map((c: any) => ({
      codigo: texto(c?.codigo, 40) || '',
      titulo: texto(c?.titulo),
      status: /realiz/i.test(String(c?.status)) ? 'realizado' as const : /exclu/i.test(String(c?.status)) ? 'excluido' as const : 'aberto' as const,
    }))
    .filter((c: CampanhaMontadora) => c.codigo || c.titulo)
  const atendimentos: AtendimentoMontadora[] = (Array.isArray(b.atendimentos) ? b.atendimentos : [])
    .map((a: any) => ({ codigo: texto(a?.codigo, 40), titulo: texto(a?.titulo), data: isoData(a?.data), km: kmNum(a?.km), concessionaria: texto(a?.concessionaria, 80) }))
    .filter((a: AtendimentoMontadora) => a.data || a.km != null)
  return ordenar({ fonte, consultado: true, campanhas, atendimentos })
}

/** Marca que vai no corpo do /v1/recall por fonte. */
const MARCA_API: Record<FonteMontadora, string> = { nissan: 'NISSAN', mitsubishi: 'MMC', 'mercedes-benz': 'M.BENZ' }

async function consultarLeiloesApi(fonte: FonteMontadora, vin: string, perfil: { modelo?: string | null; ano_fab?: any; ano_mod?: any; placa?: string | null }, timeoutMs: number): Promise<RecallMontadora | null> {
  const config = useRuntimeConfig() as any
  const base = String(config.leiloesApiUrl || '').replace(/\/+$/, '')
  const key = String(config.leiloesApiKey || '')
  if (!base || !key) return null
  const res = await $fetch<any>(`${base}/v1/recall`, {
    method: 'POST',
    headers: { 'X-API-Key': key, 'X-Origem': config.public?.gated ? 'homolog-premium' : 'prod-premium' },
    body: {
      placa: perfil.placa || null,
      chassi: vin,
      marca: MARCA_API[fonte],
      modelo: String(perfil.modelo || '').trim() || null,
      // GOTCHA do contrato: anos sao STRING no /v1/recall.
      ano_fab: perfil.ano_fab != null ? String(perfil.ano_fab) : null,
      ano_mod: perfil.ano_mod != null ? String(perfil.ano_mod) : null,
      autoritativo: true,
    },
    timeout: timeoutMs,
  })
  return sanearRecallAutoritativo(res?.autoritativo, fonte)
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Consulta a montadora do chassi. null = nao deu (fail-open). */
export async function consultarRecallMontadora(
  fonte: FonteMontadora,
  chassi: string,
  perfil: { modelo?: string | null; ano_fab?: any; ano_mod?: any; placa?: string | null } = {},
  opts?: { timeoutMs?: number; retryMs?: number; agora?: () => number },
): Promise<RecallMontadora | null> {
  const vin = String(chassi || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (vin.length !== 17) return null
  const chave = `${fonte}|${vin}`
  const agora = Date.now()
  const c = cache.get(chave)
  if (c && agora - c.em < TTL_MS) return c.bloco
  const t = opts?.timeoutMs || TIMEOUT_MS
  const tentar = async () => {
    try { return await consultarLeiloesApi(fonte, vin, perfil, t) } catch (e: any) {
      console.warn(`[recall-${fonte}] consulta falhou (fail-open):`, e?.message || e)
      return null
    }
  }
  try {
    // 1 retry quando o campo nao vem, SO se a 1a voltou rapido (se ja esperou a
    // montadora, repetir so dobraria a espera pro mesmo timeout).
    const relogio = opts?.agora || Date.now
    const t0 = relogio()
    let bloco = await tentar()
    if (!bloco && relogio() - t0 < RETRY_SE_ANTES_DE_MS) { await esperar(opts?.retryMs ?? RETRY_MS); bloco = await tentar() }
    if (bloco) {
      cache.set(chave, { em: agora, bloco })
      if (cache.size > 5000) for (const [k, v] of cache) if (agora - v.em >= TTL_MS) cache.delete(k)
    }
    return bloco
  } catch (e: any) {
    console.warn(`[recall-${fonte}] consulta falhou (fail-open):`, e?.message || e)
    return null
  }
}

/** So pra teste. */
export function _limparCacheMontadora(): void { cache.clear() }

/**
 * Pos-entrega: todo Nissan/Mitsubishi com chassi cheio (descricaoMarcaModelo
 * do SENATRAN). Grava `recallMontadora` no snapshot relendo-o antes de
 * escrever (recall e DETRAN tambem escrevem nele). Nunca vira erro pra quem comprou.
 */
export async function completarRecallMontadora(
  supabase: any,
  pedido: { id: string; placa?: string | null },
  response: any,
): Promise<{ ok: boolean; pulado?: string; abertas?: number }> {
  const bruto = Array.isArray(response) ? response[0] : response
  const fonte = marcaMontadora(bruto?.descricaoMarcaModelo)
  if (!fonte) return { ok: false, pulado: 'marca sem consulta da montadora' }
  const chassi = String(bruto?.chassi || '').trim()
  if (chassi.length !== 17) return { ok: false, pulado: 'sem chassi cheio' }
  const bloco = await consultarRecallMontadora(fonte, chassi, {
    placa: pedido.placa ?? null,
    modelo: bruto?.descricaoMarcaModelo ?? null,
    ano_fab: bruto?.anoFabricacao ?? null,
    ano_mod: bruto?.anoModelo ?? null,
  })
  if (!bloco) return { ok: false, pulado: `${fonte} nao respondeu` }
  const { data } = await supabase.from('pedidos_premium').select('relatorio_snapshot').eq('id', pedido.id).maybeSingle()
  const snap = data?.relatorio_snapshot
  if (!snap || typeof snap !== 'object') return { ok: false, pulado: 'sem snapshot' }
  const { error } = await supabase.from('pedidos_premium').update({ relatorio_snapshot: { ...snap, recallMontadora: bloco } }).eq('id', pedido.id)
  if (error) return { ok: false, pulado: 'update: ' + error.message }
  return { ok: true, abertas: bloco.n_campanhas }
}

export function completarRecallMontadoraDepois(supabase: any, pedido: { id: string; placa?: string | null }, response: any): void {
  void completarRecallMontadora(supabase, pedido, response).catch((e: any) => {
    console.warn('[recall-montadora] completar falhou:', e?.message || e)
  })
}
