import { DETRAN_UFS, ufDetranSuportada, completarDetran } from './infosimples-detran'
import { fonteNoPlano } from '../../shared/planos'
import { ufDaResposta } from './detran-multas'
import { temRecallPendente } from './recall-detalhe'
import { marcaMontadora, completarRecallMontadora } from './recall-montadora'
import { RENAJUD_UFS, temRenajud, completarRenajud } from './renajud-detalhe'
import { completarRecall } from './premium-processar'
import { enviarAtualizacaoRelatorio } from './premium-email'
import { itensDoBloco } from './detran-retentativa-tardia'
import { emVoo } from './tarefas-em-voo'
import { fonteConcluida, ESPERA_FONTES_MS, type FonteRelatorio } from '../../shared/fontes-relatorio'

// Fila duravel das fontes lentas (Relatorio 2.0, item 7; contrato com o
// infra, migration 20261014200000_premium_jobs). Na ENTREGA, cada fonte lenta
// que se aplica ao pedido vira um job com proxima_em = entrega + 5 min (a tela
// espera ate la). Se a fonte chegou no caminho normal (pos-entrega solto), o
// executor ve o bloco pronto e fecha o job sem chamar nada. Se nao chegou, o
// executor chama de novo. Backoff e teto ficam no banco
// (premium_jobs_resultado: 1 min, 5 min, 30 min, 6 h, 'esgotado' na 4a falha).
// Quando o pedido nao tem mais job aberto e algum trouxe dado NOVO pela fila,
// vai UM e-mail ao cliente (texto aprovado do remendo) e marca
// pedidos_premium.aviso_completo_em.
// Quem dispara: timer do host (pc-premium-jobs.timer) -> POST /api/premium/jobs/run.

export interface FonteAplicavel { fonte: FonteRelatorio; rotulo: string }

/** Fontes lentas que se aplicam a este pedido, pela resposta paga do SENATRAN. */
export function fontesAplicaveis(response: any): FonteAplicavel[] {
  const out: FonteAplicavel[] = []
  const bruto = Array.isArray(response) ? response[0] : response
  const uf = ufDetranSuportada(ufDaResposta(response))
  if (uf) out.push({ fonte: 'detran', rotulo: `DETRAN-${uf}` })
  if (temRecallPendente(response)) out.push({ fonte: 'recall', rotulo: 'Recall' })
  const marca = marcaMontadora(bruto?.descricaoMarcaModelo)
  if (marca && String(bruto?.chassi || '').trim().length === 17) out.push({ fonte: 'recall_montadora', rotulo: 'Recall na montadora' })
  const ufR = String(ufDaResposta(response) || '').toUpperCase() as any
  if ((RENAJUD_UFS as any)[ufR] && temRenajud(response)) out.push({ fonte: 'renajud', rotulo: 'Restrição judicial' })
  return out
}

/** Na entrega: um job por fonte aplicavel, a partir de entrega + 5 min. Nunca lanca. */
export async function criarJobsDaEntrega(supabase: any, pedidoId: string, response: any, agora = Date.now(), plano?: string | null): Promise<number> {
  try {
    const fontes = fontesAplicaveis(response).filter((f) => fonteNoPlano(f.fonte, plano))
    if (!fontes.length) return 0
    const proxima = new Date(agora + ESPERA_FONTES_MS).toISOString()
    const { error } = await supabase.from('premium_jobs')
      .upsert(fontes.map((f) => ({ pedido_id: pedidoId, fonte: f.fonte, proxima_em: proxima })), { onConflict: 'pedido_id,fonte', ignoreDuplicates: true })
    if (error) { console.warn('[premium-jobs] criar falhou:', error.message); return 0 }
    return fontes.length
  } catch (e: any) {
    console.warn('[premium-jobs] criar falhou:', e?.message || e)
    return 0
  }
}

export type ResultadoJob = { status: 'ok' | 'sem_dado' | 'falha'; code: number | null; erro?: string | null }

async function lerPedido(supabase: any, id: string) {
  const { data } = await supabase.from('pedidos_premium')
    .select('id,placa,plano,preview,consulta_id,token_entrega,email,relatorio_snapshot')
    .eq('id', id).maybeSingle()
  return data
}

/**
 * Executa um job. Idempotente: fonte ja concluida = 'ok' com code 0 (nada
 * novo, sem chamada). code 200 = a fila trouxe dado novo (conta pro e-mail).
 */
export async function executarJob(supabase: any, job: { id: string; pedido_id: string; fonte: string }, deps: {
  detran?: typeof completarDetran; recall?: typeof completarRecall; montadora?: typeof completarRecallMontadora; renajud?: typeof completarRenajud
} = {}): Promise<ResultadoJob> {
  try {
    const p = await lerPedido(supabase, job.pedido_id)
    if (!p?.relatorio_snapshot) return { status: 'falha', code: null, erro: 'pedido sem snapshot' }
    const fonte = job.fonte as FonteRelatorio
    if (!['detran', 'recall', 'recall_montadora', 'renajud'].includes(fonte)) return { status: 'falha', code: null, erro: 'fonte sem executor' }
    if (!fonteNoPlano(fonte, p.plano)) return { status: 'sem_dado', code: null, erro: 'fonte fora do plano' }
    if (fonteConcluida(fonte, p.relatorio_snapshot)) return { status: 'ok', code: 0 }
    const response = p.relatorio_snapshot?.consulta?.response
    const pedido = { id: p.id, placa: p.placa }
    const aposConferir = async (code: number | null, erro: string): Promise<ResultadoJob> => {
      const depois = await lerPedido(supabase, job.pedido_id)
      return fonteConcluida(fonte, depois?.relatorio_snapshot) ? { status: 'ok', code: 200 } : { status: 'falha', code, erro }
    }
    if (fonte === 'detran') {
      const r: any = await (deps.detran ?? completarDetran)(supabase, pedido, { response, semRetry: true })
      if (/protegido/.test(String(r?.motivo || ''))) return { status: 'sem_dado', code: r?.code ?? 620 }
      if (r?.pulado && /^uf |so com RENAINF/.test(String(r.pulado))) return { status: 'sem_dado', code: null, erro: String(r.pulado).slice(0, 300) }
      return aposConferir(r?.code ?? null, String(r?.motivo || r?.pulado || 'sem bloco').slice(0, 300))
    }
    if (fonte === 'recall') {
      await (deps.recall ?? completarRecall)(supabase, { ...pedido, plano: p.plano, preview: p.preview, token_entrega: p.token_entrega }, p.consulta_id ?? null)
      return aposConferir(null, 'recall sem resposta')
    }
    if (fonte === 'recall_montadora') {
      const r: any = await (deps.montadora ?? completarRecallMontadora)(supabase, pedido, response)
      if (r?.pulado && /marca sem|sem chassi/.test(String(r.pulado))) return { status: 'sem_dado', code: null, erro: String(r.pulado) }
      return aposConferir(null, String(r?.pulado || 'montadora sem resposta').slice(0, 300))
    }
    const r: any = await (deps.renajud ?? completarRenajud)(supabase, pedido, { response })
    if (r?.pulado && /sem RENAJUD|sem fonte|sem renavam/.test(String(r.pulado))) return { status: 'sem_dado', code: null, erro: String(r.pulado) }
    return aposConferir(r?.code ?? null, String(r?.pulado || 'renajud sem resposta').slice(0, 300))
  } catch (e: any) {
    return { status: 'falha', code: 0, erro: String(e?.message || e).slice(0, 300) }
  }
}

const ROTULO_EMAIL: Record<string, (uf: string | null) => string> = {
  detran: (uf) => `DETRAN${uf ? '-' + uf : ''}`,
  recall: () => 'recall',
  recall_montadora: () => 'recall da montadora',
  renajud: () => 'detalhe da restrição judicial',
}

/**
 * Pedido sem job aberto e com dado novo trazido pela fila: UM e-mail ao
 * cliente e aviso_completo_em. Sem dado novo (tudo ja tinha chegado ou
 * esgotou sem resultado): nao manda. Nunca lanca.
 */
export async function verificarFechamento(supabase: any, pedidoId: string, deps: { enviarEmail?: typeof enviarAtualizacaoRelatorio } = {}): Promise<boolean> {
  try {
    const { data: jobs } = await supabase.from('premium_jobs').select('fonte,status,ultimo_code').eq('pedido_id', pedidoId)
    const lista = Array.isArray(jobs) ? jobs : []
    if (!lista.length || lista.some((j: any) => ['pendente', 'rodando'].includes(j.status))) return false
    const novos = lista.filter((j: any) => j.status === 'ok' && Number(j.ultimo_code) === 200)
    if (!novos.length) return false
    const p = await lerPedido(supabase, pedidoId)
    if (!p) return false
    const { data: aviso } = await supabase.from('pedidos_premium').select('aviso_completo_em').eq('id', pedidoId).maybeSingle()
    if (aviso?.aviso_completo_em) return false
    const uf = ufDaResposta(p.relatorio_snapshot?.consulta?.response)
    const nomes = novos.map((j: any) => (ROTULO_EMAIL[j.fonte] || (() => j.fonte))(uf))
    const fonte = nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e do ${nomes[nomes.length - 1]}` : nomes[0]
    const itens = novos.some((j: any) => j.fonte === 'detran') && p.relatorio_snapshot?.multas ? itensDoBloco(p.relatorio_snapshot.multas) : []
    // Marca ANTES de enviar: dois lotes simultaneos nao mandam 2 e-mails.
    const { data: marcado, error } = await supabase.from('pedidos_premium')
      .update({ aviso_completo_em: new Date().toISOString() }).eq('id', pedidoId).is('aviso_completo_em', null).select('id')
    if (error || !marcado?.length) return false
    const ok = await (deps.enviarEmail ?? enviarAtualizacaoRelatorio)({ email: p.email, token: p.token_entrega, placa: p.placa, fonte, itens })
    if (!ok) await supabase.from('pedidos_premium').update({ aviso_completo_em: null }).eq('id', pedidoId)
    return ok
  } catch (e: any) {
    console.warn('[premium-jobs] fechamento falhou:', e?.message || e)
    return false
  }
}

let loteDesde: number | null = null

export function loteRodandoDesde(): number | null { return loteDesde }

/**
 * Reivindica ate `limite` jobs (lease no banco) e processa em background,
 * registrado em voo. Devolve os ids reivindicados. Um lote por container.
 */
export async function rodarLote(supabase: any, limite = 5, deps: Parameters<typeof executarJob>[2] & { enviarEmail?: typeof enviarAtualizacaoRelatorio } = {}): Promise<string[]> {
  if (loteDesde) return []
  loteDesde = Date.now()
  try {
    const { data, error } = await supabase.rpc('premium_jobs_reivindicar', { p_limite: Math.max(1, Math.min(5, limite)) })
    if (error) { console.warn('[premium-jobs] reivindicar falhou:', error.message); loteDesde = null; return [] }
    const jobs: any[] = Array.isArray(data) ? data : []
    if (!jobs.length) { loteDesde = null; return [] }
    void emVoo('premium-jobs', async () => {
      try {
        for (const job of jobs) {
          const r = await executarJob(supabase, job, deps)
          await supabase.rpc('premium_jobs_resultado', { p_id: job.id, p_status: r.status, p_code: r.code, p_erro: r.erro ?? null })
          await verificarFechamento(supabase, job.pedido_id, deps)
        }
      } finally { loteDesde = null }
    })
    return jobs.map((j) => j.id)
  } catch (e: any) {
    loteDesde = null
    console.warn('[premium-jobs] lote falhou:', e?.message || e)
    return []
  }
}

/** So pra testes. */
export function _resetarLote(): void { loteDesde = null }
