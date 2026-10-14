import { DETRAN_UFS, ufDetranSuportada, completarDetran } from './infosimples-detran'
import { ufDaResposta } from './detran-multas'
import { emVoo } from './tarefas-em-voo'
import { enviarAtualizacaoRelatorio } from './premium-email'

// Retentativa TARDIA do DETRAN (caso ORK8004, AL, 14/out): o Infosimples deu
// 609 ("tentativas excedidas") na entrega e no retry imediato, 3 min depois.
// 605/609 e passageiro, mas so passa em dezenas de minutos. Uma varredura
// (server/plugins/detran-tardia.ts, a cada 5 min, so prod) tenta de novo:
// - so pedido com o bloco 'indisponivel' cuja ULTIMA chamada foi 605/609;
// - 30 min e 2 h depois da primeira falha (sem o retry imediato);
// - teto de 3 chamadas tardias por pedido (contando as que a pagina dispara
//   ao ser aberta, detran-retentativa.ts), todas em premium_custos;
// - quando o bloco entra (ok/sem_debito): e-mail ao cliente com o texto
//   aprovado do "remendo" (premium-email.ts), uma vez so.
// Persistente por construcao: le tudo do banco, sobrevive a deploy.

export const CODIGOS_TARDIOS = new Set([605, 609])
export const SLOTS_TARDIOS_MS = [30 * 60 * 1000, 2 * 60 * 60 * 1000]
export const TETO_TARDIAS = 3
/** Chamadas ate 10 min da primeira falha = as da entrega (1a + retry imediato). */
export const JANELA_ENTREGA_MS = 10 * 60 * 1000
/** So pedidos entregues nas ultimas 6 h entram na varredura. */
export const JANELA_VARREDURA_MS = 6 * 60 * 60 * 1000

const ts = (s: any) => new Date(String(s || '')).getTime()

export function deveRetentarTardio(a: { multas: any; custos: { criado_em: string; code: number | null }[]; agora: number }): boolean {
  const m = a.multas
  if (!m || m.status !== 'indisponivel' || m.fonte) return false
  const custos = [...a.custos].sort((x, y) => ts(x.criado_em) - ts(y.criado_em))
  if (!custos.length) return false
  if (!CODIGOS_TARDIOS.has(Number(custos[custos.length - 1].code))) return false
  const primeira = custos.find((c) => CODIGOS_TARDIOS.has(Number(c.code)))
  if (!primeira) return false
  const t0 = ts(primeira.criado_em)
  const tardias = custos.filter((c) => ts(c.criado_em) > t0 + JANELA_ENTREGA_MS).length
  if (tardias >= TETO_TARDIAS || tardias >= SLOTS_TARDIOS_MS.length) return false
  const slot = SLOTS_TARDIOS_MS[tardias]
  // Nao tenta duas vezes no mesmo slot: a ultima chamada tem que ser anterior ao slot.
  const ultima = ts(custos[custos.length - 1].criado_em)
  return a.agora >= t0 + slot && ultima < t0 + slot
}

const reais = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ')

/** Itens de resumo do e-mail, so com o que o bloco tem. */
export function itensDoBloco(m: any): string[] {
  const it: string[] = []
  const pos = (v: any) => Number(v) > 0
  it.push(pos(m?.multas_total_centavos) ? `Multas em aberto: ${reais(Number(m.multas_total_centavos))}` : 'Multas em aberto: nada consta')
  if (pos(m?.ipva_total_centavos)) it.push(`IPVA em aberto: ${reais(Number(m.ipva_total_centavos))}`)
  if (m?.licenciamento_atrasado_ano) it.push(`Licenciamento atrasado desde ${m.licenciamento_atrasado_ano}`)
  else if (pos(m?.licenciamento_centavos)) it.push(`Licenciamento em aberto: ${reais(Number(m.licenciamento_centavos))}`)
  return it
}

const emCurso = new Set<string>()

export async function varrerRetentativasTardias(
  supabase: any,
  deps: { agora?: number; completar?: typeof completarDetran; enviarEmail?: typeof enviarAtualizacaoRelatorio } = {},
): Promise<string[]> {
  const agora = deps.agora ?? Date.now()
  const completar = deps.completar ?? completarDetran
  const enviarEmail = deps.enviarEmail ?? enviarAtualizacaoRelatorio
  const disparados: string[] = []
  try {
    const { data, error } = await supabase.from('pedidos_premium')
      .select('id,placa,token_entrega,email,relatorio_snapshot')
      .eq('status', 'entregue').eq('ambiente', 'producao')
      .gte('entregue_em', new Date(agora - JANELA_VARREDURA_MS).toISOString())
      .eq('relatorio_snapshot->multas->>status', 'indisponivel')
    if (error) { console.warn('[detran-tardia] leitura falhou:', error.message); return disparados }
    for (const p of (Array.isArray(data) ? data : [])) {
      if (emCurso.has(p.id)) continue
      const response = p.relatorio_snapshot?.consulta?.response
      const uf = ufDetranSuportada(ufDaResposta(response))
      if (!uf) continue
      const { data: custos } = await supabase.from('premium_custos').select('criado_em,code')
        .eq('pedido_id', p.id).eq('fonte', DETRAN_UFS[uf].fonteCusto)
      if (!deveRetentarTardio({ multas: p.relatorio_snapshot?.multas, custos: Array.isArray(custos) ? custos : [], agora })) continue
      emCurso.add(p.id)
      disparados.push(p.id)
      console.warn(`[detran-tardia] retentando DETRAN-${uf} pedido=${String(p.id).slice(0, 8)}`)
      void emVoo('detran-tardia', async () => {
        try {
          const r: any = await completar(supabase, { id: p.id, placa: p.placa }, { response, semRetry: true })
          if (!r?.ok) return
          const { data: atual } = await supabase.from('pedidos_premium').select('relatorio_snapshot').eq('id', p.id).maybeSingle()
          const snap = atual?.relatorio_snapshot
          const m = snap?.multas
          if (!m || !['ok', 'sem_debito'].includes(String(m.status)) || m.cliente_avisado_em) return
          const enviado = await enviarEmail({ email: p.email, token: p.token_entrega, placa: p.placa, fonte: `DETRAN-${uf}`, itens: itensDoBloco(m) })
          if (enviado) {
            await supabase.from('pedidos_premium')
              .update({ relatorio_snapshot: { ...snap, multas: { ...m, cliente_avisado_em: new Date().toISOString() } } })
              .eq('id', p.id)
          }
        } finally { emCurso.delete(p.id) }
      })
    }
  } catch (e: any) {
    console.warn('[detran-tardia] varredura falhou:', e?.message || e)
  }
  return disparados
}
