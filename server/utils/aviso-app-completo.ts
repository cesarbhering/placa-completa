// Report complete e-mail of app purchases (Cesar, 24/11/2026: "em compras pelo
// app sempre vamos mandar email depois do relatório pronto").
//
// The app buyer reads the report inside the app and often closes it before the
// slow sources (DETRAN, vehicle history) arrive. The queue's closing e-mail
// (verificarFechamento in premium-jobs.ts) goes only when the queue brought NEW
// data; when the sources arrived by the normal path, or there was no queue job,
// nothing told the buyer. Here: an app order, delivered, with an e-mail and no
// queue job pending or running gets ONE e-mail with the report link (approved
// text in premium-email.ts, enviarRelatorioCompleto).
//
// - One e-mail per order: it reuses pedidos_premium.aviso_completo_em, the stamp
//   of the queue's "report updated" e-mail. Whoever wins the update made on
//   "still null" sends; when the "report updated" e-mail already went, nothing
//   goes from here. Site orders never enter.
// - Trigger: a sweep on every pass of the queue timer (pc-premium-jobs.timer ->
//   POST /api/premium/jobs/run), loose and registered in flight. It covers the
//   report that was already complete at delivery (no job), the one the queue
//   closed with no new data, and the retry after a failed send (the stamp is
//   undone and the next pass tries again, with the same idempotency key).
// - Waits: with no job, ESPERA_FONTES_MS after the report (the jobs are created
//   up to about a minute after the delivery). With jobs, FOLGA_FECHAMENTO_MS
//   after the last one closed, so the queue's own closing check speaks first.
// - Window: only what became complete in the last JANELA_AVISO_MS. A deploy does
//   not e-mail old orders, and a send that keeps failing stops trying.
// - The Basica stays out: the approved text names DETRAN and the vehicle
//   history, which the Basica does not have.
import { enviarRelatorioCompleto } from './premium-email'
import { estaEncerrando } from './tarefas-em-voo'
import { ESPERA_FONTES_MS } from '../../shared/fontes-relatorio'

export interface PedidoAvisoApp {
  id: string
  placa: string
  token_entrega: string
  plano?: string | null
  status?: string | null
  email?: string | null
  canal?: string | null
  forma_pagamento?: string | null
  pix_provider?: string | null
  aviso_completo_em?: string | null
  entregue_em?: string | null
  snapshot_em?: string | null
}

export interface JobAvisoApp { pedido_id?: string; status: string; concluido_em?: string | null }

/** After the last queue job closed, the queue's own closing check decides first. */
export const FOLGA_FECHAMENTO_MS = 2 * 60 * 1000
/** Completed longer ago than this: no e-mail (old orders at a deploy, a send that keeps failing). */
export const JANELA_AVISO_MS = 2 * 60 * 60 * 1000
/** Oldest delivery the sweep reads: a queue that took hours to close still counts. */
const JANELA_CANDIDATOS_MS = 24 * 60 * 60 * 1000
const MAX_CANDIDATOS = 100
/** Send attempts per pass, so one pass stays short; the rest go on the next. */
const MAX_TENTATIVAS_POR_PASSADA = 20

const CAMPOS = 'id,placa,token_entrega,plano,status,email,canal,forma_pagamento,pix_provider,aviso_completo_em,entregue_em,snapshot_em'
const FILTRO_APP = 'canal.eq.app,forma_pagamento.eq.google_play,pix_provider.eq.google_play'

/**
 * Bought in the app: the app marker in the user agent (canal 'app'), or paid
 * through Google Play. An order born from the store notification has no
 * request, so no canal, and is still an app purchase.
 */
export function compraDoApp(p: { canal?: string | null; forma_pagamento?: string | null; pix_provider?: string | null }): boolean {
  return p.canal === 'app' || p.forma_pagamento === 'google_play' || p.pix_provider === 'google_play'
}

export type SituacaoAvisoApp =
  | 'pronto' | 'nao_e_app' | 'fora_do_plano' | 'nao_entregue' | 'ja_avisado' | 'sem_email'
  | 'sem_relatorio' | 'fila_aberta' | 'aguardando' | 'fora_da_janela'

const instante = (iso?: string | null): number | null => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : null
}

/** Pure: may this order get the report complete e-mail now? */
export function situacaoAvisoApp(p: PedidoAvisoApp, jobs: JobAvisoApp[], agora: number): SituacaoAvisoApp {
  if (!compraDoApp(p)) return 'nao_e_app'
  if ((p.plano || 'completa') !== 'completa') return 'fora_do_plano'
  if (p.status !== 'entregue') return 'nao_entregue'
  if (p.aviso_completo_em) return 'ja_avisado'
  if (!String(p.email || '').includes('@')) return 'sem_email'
  const relatorio = instante(p.snapshot_em)
  if (relatorio == null) return 'sem_relatorio'
  if (jobs.some((j) => j.status === 'pendente' || j.status === 'rodando')) return 'fila_aberta'
  const fechados = jobs.map((j) => instante(j.concluido_em)).filter((t): t is number => t != null)
  const completoEm = Math.max(relatorio, instante(p.entregue_em) ?? relatorio, ...fechados)
  if (agora - completoEm < (jobs.length ? FOLGA_FECHAMENTO_MS : ESPERA_FONTES_MS)) return 'aguardando'
  if (agora - completoEm > JANELA_AVISO_MS) return 'fora_da_janela'
  return 'pronto'
}

type Enviar = (a: { email: string; token: string; placa: string; pedidoId: string }) => Promise<boolean>

/**
 * Stamps aviso_completo_em on "still null" and sends. A failed send undoes the
 * stamp, so the next timer pass tries again: while this stamp holds nobody else
 * can stamp, so the undo needs no other filter (as in verificarFechamento).
 * Never throws.
 */
async function enviarUmaVez(supabase: any, p: PedidoAvisoApp, agora: number, enviar: Enviar): Promise<'enviado' | 'ja_avisado' | 'falhou'> {
  const marca = new Date(agora).toISOString()
  try {
    const { data: marcado, error } = await supabase.from('pedidos_premium')
      .update({ aviso_completo_em: marca })
      .eq('id', p.id).eq('status', 'entregue').is('aviso_completo_em', null)
      .select('id')
    if (error || !marcado?.length) return 'ja_avisado'
  } catch (e: any) {
    console.warn('[aviso-app-completo] stamp failed:', e?.message || e)
    return 'falhou'
  }
  const ok = await Promise.resolve()
    .then(() => enviar({ email: String(p.email), token: p.token_entrega, placa: p.placa, pedidoId: p.id }))
    .catch(() => false)
  if (ok) return 'enviado'
  try {
    await supabase.from('pedidos_premium').update({ aviso_completo_em: null }).eq('id', p.id)
  } catch (e: any) {
    console.warn('[aviso-app-completo] undoing the stamp failed:', e?.message || e)
  }
  console.warn(`[aviso-app-completo] send failed pedido=${String(p.id).slice(0, 8)}; the next timer pass tries again`)
  return 'falhou'
}

let varrendoDesde: number | null = null

/**
 * One pass: app orders delivered in the last day, with an e-mail and no
 * aviso_completo_em, whose report is complete. One pass at a time per
 * container; between containers the stamp decides. Never throws.
 */
export async function varrerAppCompletos(
  supabase: any,
  deps: { enviar?: Enviar; agora?: number } = {},
): Promise<{ vistos: number; enviados: number }> {
  const saida = { vistos: 0, enviados: 0 }
  if (varrendoDesde) return saida
  varrendoDesde = Date.now()
  try {
    const agora = deps.agora ?? Date.now()
    const { data, error } = await supabase.from('pedidos_premium')
      .select(CAMPOS)
      .eq('status', 'entregue')
      .is('aviso_completo_em', null)
      .not('email', 'is', null)
      .not('snapshot_em', 'is', null)
      .or(FILTRO_APP)
      .gte('entregue_em', new Date(agora - JANELA_CANDIDATOS_MS).toISOString())
      .lte('entregue_em', new Date(agora - ESPERA_FONTES_MS).toISOString())
      .order('entregue_em', { ascending: false })
      .limit(MAX_CANDIDATOS)
    if (error) { console.warn('[aviso-app-completo] reading the orders failed:', error.message); return saida }
    const pedidos: PedidoAvisoApp[] = Array.isArray(data) ? data : []
    saida.vistos = pedidos.length
    if (!pedidos.length) return saida
    const { data: jobs, error: erroJobs } = await supabase.from('premium_jobs')
      .select('pedido_id,status,concluido_em')
      .in('pedido_id', pedidos.map((p) => p.id))
    if (erroJobs) { console.warn('[aviso-app-completo] reading the queue failed:', erroJobs.message); return saida }
    const jobsDo = new Map<string, JobAvisoApp[]>()
    for (const j of (Array.isArray(jobs) ? jobs : []) as JobAvisoApp[]) {
      const id = String(j.pedido_id)
      jobsDo.set(id, [...(jobsDo.get(id) ?? []), j])
    }
    const enviar = deps.enviar ?? enviarRelatorioCompleto
    let tentativas = 0
    for (const p of pedidos) {
      // SIGTERM: stamp nothing new. The shutdown waits a bounded time, and a
      // stamp whose send never finished would lose the e-mail; the new
      // container sends the rest.
      if (tentativas >= MAX_TENTATIVAS_POR_PASSADA || estaEncerrando()) break
      if (situacaoAvisoApp(p, jobsDo.get(p.id) ?? [], agora) !== 'pronto') continue
      tentativas++
      if (await enviarUmaVez(supabase, p, agora, enviar) === 'enviado') saida.enviados++
    }
    return saida
  } catch (e: any) {
    console.warn('[aviso-app-completo] pass failed:', e?.message || e)
    return saida
  } finally {
    varrendoDesde = null
  }
}
