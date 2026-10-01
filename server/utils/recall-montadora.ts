// Recall AUTORITATIVO da montadora no relatorio PAGO, por chassi: o status de
// cada campanha vem da propria montadora (aberto/realizado) e os atendimentos
// trazem data, concessionaria e, quando a fonte tem, km. Decisao do Cesar
// (01/out): roda pra TODO veiculo da marca com chassi cheio, sem depender da
// flag de recall do SENATRAN (e gratis e enriquece).
//
// - Nissan: GET oficial por chassi (cloudfunctions nissanRecall), sem captcha e
//   sem dado pessoal. Uma linha por campanha x item de reparo -> agrupado.
// - Mitsubishi: POST /v1/recall {autoritativo:true} da leiloes-api (a fonte
//   da Mitsubishi vaza nome/CPF/OS; a leiloes-api ja devolve so o necessario).
//   Sem o campo `autoritativo` na resposta, vale o match local (null aqui).
//
// Fail-open: erro/timeout/formato estranho -> null, o relatorio segue sem o
// bloco. 1 chamada por pedido; cache por chassi (24h) so de resposta valida.
// Whitelist: codigo, titulo, status, data, km e concessionaria. Nada de chassi,
// nome, CPF, OS, texto longo nem codigo de peca.

export type FonteMontadora = 'nissan' | 'mitsubishi'

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

const URL_NISSAN = 'https://us-central1-integracao-nissan-x-sem-parar.cloudfunctions.net/nissanRecall/recall/'
const TTL_MS = 24 * 60 * 60 * 1000
/** GET direto da Nissan (ate a Nissan entrar na leiloes-api). */
const TIMEOUT_NISSAN_MS = 8000
/**
 * Chamada autoritativa na leiloes-api: a API espera ate 30s pela montadora
 * (ordem do Cesar, 01/out); o site espera 40s, MAIS que a API, pra receber o
 * fail-open dela em vez de cortar antes. Roda pos-entrega: nao segura o
 * loading nem nenhuma resposta ao cliente.
 */
const TIMEOUT_AUTORITATIVO_MS = 40000
/** Retry so se a 1a chamada voltou RAPIDO sem o campo (a API nao esperou a montadora). */
const RETRY_SE_ANTES_DE_MS = 10000
const RETRY_ESPERA_MS = 2000
const cache = new Map<string, { em: number; bloco: RecallMontadora }>()

export function marcaMontadora(desc: string | null | undefined): FonteMontadora | null {
  const d = String(desc || '')
  if (/\bnissan\b/i.test(d)) return 'nissan'
  if (/\b(mmc|mitsubishi)\b/i.test(d)) return 'mitsubishi'
  return null
}

const sim = (v: any) => v === true || /^(true|sim|s)$/i.test(String(v ?? '').trim())
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
 * Nissan: lista crua (campanha x item de reparo) -> formato unico. Aberta se
 * QUALQUER item ativo nao foi reparado (conservador); excluida se todos os
 * itens foram excluidos; senao realizada, com UM atendimento (data mais
 * recente + concessionaria). Nissan nao traz km. Nao-lista -> null.
 */
export function parsearRecallNissan(bruto: unknown): RecallMontadora | null {
  if (!Array.isArray(bruto)) return null
  const grupos = new Map<string, any[]>()
  for (const x of bruto) {
    if (!x || typeof x !== 'object') continue
    const codigo = texto((x as any).numero_da_campanha, 40)
    if (!codigo) continue
    if (!grupos.has(codigo)) grupos.set(codigo, [])
    grupos.get(codigo)!.push(x)
  }
  const campanhas: CampanhaMontadora[] = []
  const atendimentos: AtendimentoMontadora[] = []
  for (const [codigo, linhas] of grupos) {
    const titulo = linhas.map((l) => texto(l.nome_da_campanha)).find(Boolean) ?? null
    const ativas = linhas.filter((l) => !sim(l.excluido_do_recall))
    if (!ativas.length) { campanhas.push({ codigo, titulo, status: 'excluido' }); continue }
    if (ativas.some((l) => !sim(l.efetuou_o_reparo))) { campanhas.push({ codigo, titulo, status: 'aberto' }); continue }
    campanhas.push({ codigo, titulo, status: 'realizado' })
    const ultima = [...ativas].sort((a, b) => String(isoData(b.data_do_reparo) || '').localeCompare(String(isoData(a.data_do_reparo) || '')))[0]
    atendimentos.push({ codigo, titulo, data: isoData(ultima?.data_do_reparo), km: null, concessionaria: texto(ultima?.concessionaria, 80) })
  }
  return ordenar({ fonte: 'nissan', consultado: true, campanhas, atendimentos })
}

/**
 * Mitsubishi (resp.autoritativo da leiloes-api): {fonte, consultado,
 * campanhas[{codigo,titulo,status}], atendimentos[{codigo,titulo,data,km,
 * concessionaria}]}. So aceita fonte mitsubishi + consultado true. Copia campo
 * a campo (whitelist): qualquer coisa a mais que a API mande nao passa.
 */
export function sanearRecallMitsubishi(bruto: unknown): RecallMontadora | null {
  const b = bruto as any
  if (!b || typeof b !== 'object' || b.consultado !== true || String(b.fonte || '').toLowerCase() !== 'mitsubishi') return null
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
  return ordenar({ fonte: 'mitsubishi', consultado: true, campanhas, atendimentos })
}

async function consultarNissan(vin: string, timeoutMs: number): Promise<RecallMontadora | null> {
  const res = await fetch(URL_NISSAN + vin, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) return null
  return parsearRecallNissan(await res.json().catch(() => null))
}

async function consultarMitsubishi(vin: string, perfil: { modelo?: string | null; ano_fab?: any; ano_mod?: any; placa?: string | null }, timeoutMs: number): Promise<RecallMontadora | null> {
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
      marca: 'MMC',
      modelo: String(perfil.modelo || '').trim() || null,
      // GOTCHA do contrato: anos sao STRING no /v1/recall.
      ano_fab: perfil.ano_fab != null ? String(perfil.ano_fab) : null,
      ano_mod: perfil.ano_mod != null ? String(perfil.ano_mod) : null,
      autoritativo: true,
    },
    timeout: timeoutMs,
  })
  return sanearRecallMitsubishi(res?.autoritativo)
}

/**
 * 1 chamada; sem o campo (ou erro), 1 retry depois de ~2s SO se a primeira
 * voltou em menos de 10s. Se ela ja esperou a montadora (perto dos 30s da
 * API), repetir so dobraria a espera pra provavelmente o mesmo timeout.
 */
async function comRetry(
  chamar: () => Promise<RecallMontadora | null>,
  opts?: { retryMs?: number; agora?: () => number },
): Promise<RecallMontadora | null> {
  const relogio = opts?.agora || Date.now
  const tentar = async () => { try { return await chamar() } catch (e: any) { console.warn('[recall-montadora] tentativa falhou:', e?.message || e); return null } }
  const t0 = relogio()
  const primeira = await tentar()
  if (primeira) return primeira
  if (relogio() - t0 >= RETRY_SE_ANTES_DE_MS) return null
  await new Promise((r) => setTimeout(r, opts?.retryMs ?? RETRY_ESPERA_MS))
  return tentar()
}

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
  try {
    let bloco: RecallMontadora | null
    if (fonte === 'nissan') {
      bloco = await consultarNissan(vin, opts?.timeoutMs || TIMEOUT_NISSAN_MS)
    } else {
      bloco = await comRetry(() => consultarMitsubishi(vin, perfil, opts?.timeoutMs || TIMEOUT_AUTORITATIVO_MS), opts)
    }
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
