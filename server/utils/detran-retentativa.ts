import { DETRAN_UFS, ufDetranSuportada, passaNoGateDetran, completarDetranDepois } from './infosimples-detran'
import { ufDaResposta } from './detran-multas'

// Retentativa do bloco DETRAN (Infosimples) ao SERVIR um relatorio entregue.
//
// Caso EWX4852 (07/out): a Infosimples SP respondeu 609 ("tentativas de
// consultar a origem excedidas") nas duas chamadas da entrega e o bloco ficou
// 'indisponivel' pra sempre. 609 e passageiro. Antes, quem tentava de novo era
// o self-heal do worker gov.br (browser-use), que nao loga desde 06/out e so
// gerava erro e custo. Agora a retentativa e na propria Infosimples, com
// freios de custo: espera a chamada da entrega terminar, intervalo minimo
// entre tentativas e teto de chamadas por pedido.

export const ESPERA_ENTREGA_MS = 15 * 60 * 1000   // chamada da entrega (ate 2 x 330 s + 20 s)
export const INTERVALO_MS = 20 * 60 * 1000         // entre retentativas
export const MAX_CHAMADAS = 6                      // por pedido, contando as da entrega

export function deveRetentarDetran(a: {
  multas: any
  entregueEm: string | null | undefined
  chamadas: number
  ultimaChamadaEm: string | null | undefined
  agora?: number
}): boolean {
  const agora = a.agora ?? Date.now()
  const m = a.multas
  if (m && typeof m === 'object') {
    // Bloco pronto, sem debito ou protegido pelo proprietario: final.
    if (['ok', 'sem_debito', 'protegido'].includes(String(m.status))) return false
    if (m.fonte && m.status !== 'indisponivel') return false
  }
  if (a.chamadas >= MAX_CHAMADAS) return false
  if (a.ultimaChamadaEm && agora - new Date(a.ultimaChamadaEm).getTime() < INTERVALO_MS) return false
  if (!m && a.entregueEm && agora - new Date(a.entregueEm).getTime() < ESPERA_ENTREGA_MS) return false
  return true
}

/**
 * Chamado pelo report.get (fire-and-forget, depois do debounce). Le quantas
 * chamadas o pedido ja fez nesta UF (premium_custos) e, se vale, dispara o
 * completarDetran em background. Nunca lanca.
 */
export async function retentarDetranSeValer(
  supabase: any,
  pedido: { id: string; placa: string; entregue_em?: string | null; consulta_id?: string | null },
  multas: any,
  response: any,
): Promise<boolean> {
  try {
    const uf = ufDetranSuportada(ufDaResposta(response))
    if (!uf) return false
    const cfgUf = DETRAN_UFS[uf]
    if (!passaNoGateDetran(cfgUf.gate, response)) return false
    const { data } = await supabase
      .from('premium_custos')
      .select('criado_em')
      .eq('pedido_id', pedido.id)
      .eq('fonte', cfgUf.fonteCusto)
      .order('criado_em', { ascending: false })
    const linhas = Array.isArray(data) ? data : []
    if (!deveRetentarDetran({ multas, entregueEm: pedido.entregue_em, chamadas: linhas.length, ultimaChamadaEm: linhas[0]?.criado_em })) return false
    console.warn(`[detran] retentativa uf=${uf} chamadas=${linhas.length} pedido=${String(pedido.id).slice(0, 8)}`)
    completarDetranDepois(supabase, { id: pedido.id, placa: pedido.placa }, { consultaId: pedido.consulta_id ?? null, response })
    return true
  } catch (e: any) {
    console.warn('[detran] retentativa falhou:', e?.message || e)
    return false
  }
}
