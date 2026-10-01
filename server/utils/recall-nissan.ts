// Recall AUTORITATIVO Nissan no relatorio PAGO: consulta oficial da Nissan por
// chassi (GET sem captcha e sem dado pessoal). Diz, por campanha, se o reparo
// foi feito, quando e em qual concessionaria. Decisao do Cesar (01/out, mesmo
// criterio da Mitsubishi): roda pra TODO Nissan com chassi cheio no pago, sem
// depender da flag de recall do SENATRAN (e gratis e enriquece).
//
// Fail-open: timeout/erro/resposta estranha -> null, o relatorio segue sem o
// bloco. 1 chamada por pedido; cache por chassi (24h) so de resposta valida.
// Whitelist: so numero, nome da campanha, status, data e concessionaria. O
// chassi (chassis_elegiveis_a_recall), o texto longo e os codigos de peca nao
// saem daqui.

const URL_NISSAN = 'https://us-central1-integracao-nissan-x-sem-parar.cloudfunctions.net/nissanRecall/recall/'
const TTL_MS = 24 * 60 * 60 * 1000
const TIMEOUT_MS = 8000

export interface CampanhaNissan {
  numero: string
  titulo: string | null
  /** 'realizado' | 'pendente' | 'excluido' (veiculo excluido da campanha pela Nissan) */
  status: 'realizado' | 'pendente' | 'excluido'
  /** ISO (YYYY-MM-DD) do reparo, quando realizado. */
  data: string | null
  concessionaria: string | null
}

export interface RecallNissan {
  fonte: 'nissan'
  consultado: true
  pendentes: number
  campanhas: CampanhaNissan[]
}

const cache = new Map<string, { em: number; bloco: RecallNissan }>()

export function ehNissan(desc: string | null | undefined): boolean {
  return /\bnissan\b/i.test(String(desc || ''))
}

const sim = (v: any) => v === true || /^(true|sim|s)$/i.test(String(v ?? '').trim())
const texto = (v: any) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t && t !== 'None' && t !== 'null' ? t : null }
function isoData(v: any): string | null {
  const s = String(v ?? '')
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const b = s.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return b ? `${b[3]}-${b[2]}-${b[1]}` : null
}

/**
 * Lista crua (uma linha por campanha x item de reparo) -> uma campanha por
 * numero. Pendente se QUALQUER linha nao foi reparada (conservador); excluido
 * se todas as linhas foram excluidas; senao realizado, com a data mais recente
 * e a concessionaria dessa data. Resposta que nao e lista -> null.
 */
export function parsearRecallNissan(bruto: unknown): RecallNissan | null {
  if (!Array.isArray(bruto)) return null
  const grupos = new Map<string, any[]>()
  for (const x of bruto) {
    if (!x || typeof x !== 'object') continue
    const numero = texto((x as any).numero_da_campanha)
    if (!numero) continue
    if (!grupos.has(numero)) grupos.set(numero, [])
    grupos.get(numero)!.push(x)
  }
  const campanhas: CampanhaNissan[] = []
  for (const [numero, linhas] of grupos) {
    const titulo = linhas.map((l) => texto(l.nome_da_campanha)).find(Boolean) ?? null
    const ativas = linhas.filter((l) => !sim(l.excluido_do_recall))
    if (!ativas.length) { campanhas.push({ numero, titulo, status: 'excluido', data: null, concessionaria: null }); continue }
    if (ativas.some((l) => !sim(l.efetuou_o_reparo))) { campanhas.push({ numero, titulo, status: 'pendente', data: null, concessionaria: null }); continue }
    const ultima = [...ativas].sort((a, b) => String(isoData(b.data_do_reparo) || '').localeCompare(String(isoData(a.data_do_reparo) || '')))[0]
    campanhas.push({ numero, titulo, status: 'realizado', data: isoData(ultima?.data_do_reparo), concessionaria: texto(ultima?.concessionaria) })
  }
  // Pendentes primeiro; depois as mais recentes.
  campanhas.sort((a, b) => (a.status === 'pendente' ? 0 : 1) - (b.status === 'pendente' ? 0 : 1) || String(b.data || '').localeCompare(String(a.data || '')))
  return { fonte: 'nissan', consultado: true, pendentes: campanhas.filter((c) => c.status === 'pendente').length, campanhas }
}

/** GET oficial Nissan por chassi. null = nao deu pra consultar (fail-open). */
export async function consultarRecallNissan(chassi: string, opts?: { timeoutMs?: number }): Promise<RecallNissan | null> {
  const vin = String(chassi || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (vin.length !== 17) return null
  const agora = Date.now()
  const c = cache.get(vin)
  if (c && agora - c.em < TTL_MS) return c.bloco
  try {
    const res = await fetch(URL_NISSAN + vin, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(opts?.timeoutMs || TIMEOUT_MS),
    })
    if (!res.ok) return null
    const bloco = parsearRecallNissan(await res.json().catch(() => null))
    if (bloco) {
      cache.set(vin, { em: agora, bloco })
      if (cache.size > 5000) for (const [k, v] of cache) if (agora - v.em >= TTL_MS) cache.delete(k)
    }
    return bloco
  } catch (e: any) {
    console.warn('[recall-nissan] consulta falhou (fail-open):', e?.message || e)
    return null
  }
}

/** So pra teste. */
export function _limparCacheNissan(): void { cache.clear() }

/**
 * Pos-entrega: todo Nissan com chassi cheio (descricaoMarcaModelo do SENATRAN).
 * Grava `recallNissan` no snapshot relendo-o antes de escrever (o recall e o
 * DETRAN tambem escrevem nele). Nunca vira erro pra quem comprou.
 */
export async function completarRecallNissan(
  supabase: any,
  pedido: { id: string },
  response: any,
): Promise<{ ok: boolean; pulado?: string; pendentes?: number }> {
  const bruto = Array.isArray(response) ? response[0] : response
  if (!ehNissan(bruto?.descricaoMarcaModelo)) return { ok: false, pulado: 'nao e Nissan' }
  const chassi = String(bruto?.chassi || '').trim()
  if (chassi.length !== 17) return { ok: false, pulado: 'sem chassi cheio' }
  const bloco = await consultarRecallNissan(chassi)
  if (!bloco) return { ok: false, pulado: 'nissan nao respondeu' }
  const { data } = await supabase.from('pedidos_premium').select('relatorio_snapshot').eq('id', pedido.id).maybeSingle()
  const snap = data?.relatorio_snapshot
  if (!snap || typeof snap !== 'object') return { ok: false, pulado: 'sem snapshot' }
  const { error } = await supabase.from('pedidos_premium').update({ relatorio_snapshot: { ...snap, recallNissan: bloco } }).eq('id', pedido.id)
  if (error) return { ok: false, pulado: 'update: ' + error.message }
  return { ok: true, pendentes: bloco.pendentes }
}

export function completarRecallNissanDepois(supabase: any, pedido: { id: string }, response: any): void {
  void completarRecallNissan(supabase, pedido, response).catch((e: any) => {
    console.warn('[recall-nissan] completar falhou:', e?.message || e)
  })
}
