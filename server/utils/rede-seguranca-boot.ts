import { DETRAN_UFS, ufDetranSuportada, passaNoGateDetran, completarDetranDepois } from './infosimples-detran'
import { ufDaResposta, renavamDaResposta } from './detran-multas'
import { MAX_CHAMADAS } from './detran-retentativa'

// Rede de seguranca do boot (regra do Cesar, 13/out: deploy espera buscas em
// andamento). Se um deploy matou a busca de multas antes de gravar (caso
// SFC8G01) ou a tarefa foi recusada no encerramento, o container novo procura
// pedidos entregues na ultima hora SEM bloco de multas e reenfileira a busca.
//
// - Idempotente: so quem esta com snapshot.multas vazio (null/ausente). Quem
//   ja tem bloco (ok, sem_debito, protegido, indisponivel...) nao e tocado.
// - Gate e freios: so UF com DETRAN, so se o gate da UF passa (hoje todas
//   'sempre': nao depende do RENAINF), com renavam, e abaixo do teto de chamadas por pedido
//   (MAX_CHAMADAS em premium_custos). completarDetran repete os proprios freios.
// - Roda ATRASO_MS depois do boot: o container antigo tem ate 150 s pra
//   terminar e gravar o que estava em voo; antes disso a busca dele ainda
//   pode chegar e nao vale pagar duas vezes.

export const JANELA_MS = 60 * 60 * 1000
export const ATRASO_MS = 160 * 1000

export interface CandidatoBoot { id: string; placa: string; consulta_id?: string | null; response: any }

/** Filtro puro: pedido entregue sem bloco de multas, com renavam, UF com DETRAN e gate ok. */
export function precisaReenfileirar(p: { relatorio_snapshot: any }): boolean {
  const snap = p.relatorio_snapshot
  if (!snap || typeof snap !== 'object') return false
  if (snap.multas != null) return false
  const response = snap?.consulta?.response
  if (!renavamDaResposta(response)) return false
  const uf = ufDetranSuportada(ufDaResposta(response))
  if (!uf) return false
  return passaNoGateDetran(DETRAN_UFS[uf].gate, response)
}

/**
 * Procura e reenfileira. Devolve os ids reenfileirados. Nunca lanca.
 * `disparar` existe pra teste; o padrao e completarDetranDepois (em voo).
 */
export async function redeSegurancaBoot(
  supabase: any,
  opts: { agora?: number; disparar?: (sb: any, p: { id: string; placa: string }, ctx: { consultaId: string | null; response: any }) => void } = {},
): Promise<string[]> {
  const agora = opts.agora ?? Date.now()
  const disparar = opts.disparar ?? completarDetranDepois
  const feitos: string[] = []
  try {
    const desde = new Date(agora - JANELA_MS).toISOString()
    const { data, error } = await supabase
      .from('pedidos_premium')
      .select('id,placa,consulta_id,entregue_em,relatorio_snapshot')
      .eq('status', 'entregue')
      .eq('ambiente', 'producao')
      .gte('entregue_em', desde)
    if (error) { console.warn('[boot] rede de seguranca: leitura falhou:', error.message); return feitos }
    for (const p of (Array.isArray(data) ? data : [])) {
      if (!precisaReenfileirar(p)) continue
      const response = p.relatorio_snapshot.consulta.response
      const uf = ufDetranSuportada(ufDaResposta(response))!
      const { data: custos } = await supabase
        .from('premium_custos')
        .select('criado_em')
        .eq('pedido_id', p.id)
        .eq('fonte', DETRAN_UFS[uf].fonteCusto)
      if ((Array.isArray(custos) ? custos.length : 0) >= MAX_CHAMADAS) continue
      console.warn(`[boot] rede de seguranca: reenfileirando DETRAN-${uf} pedido=${String(p.id).slice(0, 8)} (sem bloco de multas)`)
      disparar(supabase, { id: p.id, placa: p.placa }, { consultaId: p.consulta_id ?? null, response })
      feitos.push(p.id)
    }
  } catch (e: any) {
    console.warn('[boot] rede de seguranca falhou:', e?.message || e)
  }
  return feitos
}
