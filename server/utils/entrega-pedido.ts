// Gravacao da entrega do pedido pago e recuperacao de pedido preso em
// 'consultando' (incidente de 04/nov/2026).
//
// O caso: a consulta paga rodou, o snapshot completo foi gravado e os jobs da
// entrega rodaram, mas o pedido ficou em 'consultando' com consulta_id,
// placa_consultada e debug_trace nulos. Sao exatamente os campos do update de
// entrega em premium-processar.ts, que NAO conferia o `error` do supabase-js
// (que devolve o erro em vez de lancar). Um erro nesse update (rede, timeout
// do PostgREST, ou um debug_trace que o jsonb recusa: \u0000 ou surrogate
// solto vindo do .slice(0, 1200) de uma resposta crua) passava calado, e o
// resto do fluxo seguia como se a entrega estivesse gravada.

import { emVoo } from './tarefas-em-voo'
import { enfileirarNfse } from './nfse'

/** jsonb recusa \u0000 e surrogate UTF-16 solto: troca por U+FFFD. */
export function sanearParaJsonb<T>(v: T): T {
  try {
    return JSON.parse(JSON.stringify(v ?? null, (_k, x) => (typeof x === 'string'
      ? x.replace(/\u0000/g, '').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�')
      : x)))
  } catch {
    return null as T
  }
}

export interface CamposEntrega {
  entregue_em: string
  consulta_id: string | null
  debug_trace?: any
  placa_consultada?: string | null
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Marca o pedido como entregue CONFERINDO o erro. Tenta 3 vezes com o
 * payload completo (trace saneado) e, se ainda falhar, uma vez sem o
 * debug_trace: o trace e diagnostico, a entrega e o que o cliente pagou.
 * Devolve o erro final (ou null quando gravou).
 */
export async function gravarEntrega(
  supabase: any,
  pedidoId: string,
  campos: CamposEntrega,
  opts: { esperas?: number[] } = {},
): Promise<string | null> {
  const esperas = opts.esperas ?? [0, 500, 2000]
  const completo = { status: 'entregue', ...campos, debug_trace: sanearParaJsonb(campos.debug_trace ?? null) }
  let ultimo = ''
  for (const ms of esperas) {
    if (ms) await esperar(ms)
    try {
      const { error } = await supabase.from('pedidos_premium').update(completo).eq('id', pedidoId)
      if (!error) return null
      ultimo = String(error.message || error.code || error)
    } catch (e: any) {
      ultimo = String(e?.message || e)
    }
    console.warn(`[premium] gravar entrega falhou (${ultimo}); tentando de novo`)
  }
  try {
    const { debug_trace: _t, ...semTrace } = completo
    const { error } = await supabase.from('pedidos_premium').update(semTrace).eq('id', pedidoId)
    if (!error) {
      console.warn('[premium] entrega gravada SEM debug_trace depois de falhas com ele')
      return null
    }
    ultimo = String(error.message || error.code || error)
  } catch (e: any) {
    ultimo = String(e?.message || e)
  }
  return ultimo || 'erro desconhecido'
}

/** Consulta paga deste pedido (gcc_consentimentos.pedido_id -> senatran_consultas). So leitura. */
export async function consultaIdDoPedido(supabase: any, pedidoId: string): Promise<string | null> {
  try {
    const { data: consents } = await supabase.from('gcc_consentimentos').select('id').eq('pedido_id', pedidoId)
    const ids = (Array.isArray(consents) ? consents : []).map((c: any) => c.id).filter(Boolean)
    if (!ids.length) return null
    const { data } = await supabase
      .from('senatran_consultas')
      .select('id, created_at')
      .in('consentimento_id', ids)
      .order('created_at', { ascending: false })
      .limit(1)
    return Array.isArray(data) && data[0]?.id ? String(data[0].id) : null
  } catch {
    return null
  }
}

/** Snapshot montado ha mais que isto e pedido ainda 'consultando' = entrega perdida. */
export const FOLGA_SNAPSHOT_MS = 30 * 1000

/** Pura: o pedido esta preso em 'consultando' com o relatorio ja pronto? */
export function presoComSnapshot(p: { status?: string | null; relatorio_snapshot?: any; snapshot_em?: string | null }, agora = Date.now()): boolean {
  if (p.status !== 'consultando' || !p.relatorio_snapshot || typeof p.relatorio_snapshot !== 'object') return false
  const em = p.snapshot_em ? new Date(p.snapshot_em).getTime() : 0
  return !em || agora - em >= FOLGA_SNAPSHOT_MS
}

/**
 * Promove pra 'entregue' o pedido que ja tem o snapshot completo mas ficou em
 * 'consultando'. Nao chama nada pago: so le a consulta que ja existe. O update
 * e condicional ao status, entao duas abas ao mesmo tempo nao brigam.
 * Devolve o consulta_id achado quando promoveu (null se nao achou a consulta),
 * ou false quando nao promoveu.
 */
export async function promoverSeSnapshotPronto(
  supabase: any,
  p: { id: string; status?: string | null; relatorio_snapshot?: any; snapshot_em?: string | null },
  agora = Date.now(),
): Promise<false | { consultaId: string | null }> {
  if (!presoComSnapshot(p, agora)) return false
  try {
    const consultaId = await consultaIdDoPedido(supabase, p.id)
    const { data, error } = await supabase
      .from('pedidos_premium')
      .update({ status: 'entregue', entregue_em: p.snapshot_em || new Date(agora).toISOString(), ...(consultaId ? { consulta_id: consultaId } : {}) })
      .eq('id', p.id)
      .eq('status', 'consultando')
      .select('id')
    if (error || !Array.isArray(data) || !data.length) return false
    console.warn(`[premium] pedido preso em consultando com snapshot pronto promovido a entregue pedido=${String(p.id).slice(0, 8)}`)
    void emVoo('nfse-enfileirar', () => enfileirarNfse(supabase, p.id))
    return { consultaId }
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Rede de seguranca do boot pra pedido preso em 'consultando'.
//
// A rede antiga (rede-seguranca-boot.ts) so olhava pedido ENTREGUE sem bloco
// de multas. Pedido que morreu em 'consultando' (deploy no meio da consulta,
// ou a gravacao da entrega que falhou) ficava preso pra sempre. No boot do
// container novo (ATRASO_MS depois de subir: o antigo ja saiu), pedido em
// 'consultando' pago ha mais de PRESO_MS e menos de 24 h:
//   1. com snapshot: promove a 'entregue' (nada pago);
//   2. sem snapshot, mas com a consulta paga gravada: promove com o
//      consulta_id (o report.get monta o snapshot na 1a visita) e alerta, porque
//      o e-mail de entrega pode nao ter saido;
//   3. sem consulta nenhuma: devolve pra 'pago' (condicional) e roda a
//      entrega de novo, que tem o claim atomico de sempre.
// Todo caso recuperado vai num alerta por e-mail pro time.

export const PRESO_MS = 10 * 60 * 1000
const JANELA_PRESO_MS = 24 * 60 * 60 * 1000

export type DesfechoPreso = 'promovido_snapshot' | 'promovido_consulta' | 'reprocessado' | 'ignorado'

export async function recuperarConsultandoPresos(
  supabase: any,
  deps: { agora?: number; processar: (sb: any, pedido: any) => Promise<any>; alertar?: (msg: string) => Promise<any> | void },
): Promise<{ id: string; desfecho: DesfechoPreso }[]> {
  const agora = deps.agora ?? Date.now()
  const saida: { id: string; desfecho: DesfechoPreso }[] = []
  try {
    const { data, error } = await supabase
      .from('pedidos_premium')
      .select('*')
      .eq('status', 'consultando')
      .eq('ambiente', 'producao')
      .lt('pago_em', new Date(agora - PRESO_MS).toISOString())
      .gte('pago_em', new Date(agora - JANELA_PRESO_MS).toISOString())
    if (error) { console.warn('[boot] presos em consultando: leitura falhou:', error.message); return saida }
    for (const p of (Array.isArray(data) ? data : [])) {
      let desfecho: DesfechoPreso = 'ignorado'
      if (p.relatorio_snapshot) {
        if (await promoverSeSnapshotPronto(supabase, p, agora)) desfecho = 'promovido_snapshot'
      } else {
        const consultaId = await consultaIdDoPedido(supabase, p.id)
        if (consultaId) {
          const { data: up } = await supabase.from('pedidos_premium')
            .update({ status: 'entregue', entregue_em: new Date(agora).toISOString(), consulta_id: consultaId })
            .eq('id', p.id).eq('status', 'consultando').is('relatorio_snapshot', null).select('id')
          if (Array.isArray(up) && up.length) desfecho = 'promovido_consulta'
        } else {
          const { data: up } = await supabase.from('pedidos_premium')
            .update({ status: 'pago' })
            .eq('id', p.id).eq('status', 'consultando').is('relatorio_snapshot', null).select('id')
          if (Array.isArray(up) && up.length) {
            desfecho = 'reprocessado'
            void deps.processar(supabase, { ...p, status: 'pago' })
          }
        }
      }
      if (desfecho === 'ignorado') continue
      saida.push({ id: p.id, desfecho })
      console.warn(`[boot] pedido preso em consultando: ${desfecho} pedido=${String(p.id).slice(0, 8)}`)
    }
    if (saida.length && deps.alertar) {
      await deps.alertar(`Boot: ${saida.length} pedido(s) preso(s) em 'consultando' recuperado(s): `
        + saida.map((s) => `${s.id} (${s.desfecho})`).join(', ')
        + '. Em "promovido_consulta" o e-mail de entrega pode nao ter saido: conferir.')
    }
  } catch (e: any) {
    console.warn('[boot] presos em consultando falhou:', e?.message || e)
  }
  return saida
}
