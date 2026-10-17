// Checklist reativo (Cesar, 16/out/2026): estado marcado por (pedido, item_id)
// em public.premium_checklist. Mesma muralha das rotas premium: token de
// pedido entregue; teto por token pra nao virar porta de escrita aberta.
import { idChecklistValido } from '../../shared/checklist-compra'

export const RE_TOKEN = /^[A-Za-z0-9_-]{8,64}$/
const JANELA_MS = 60 * 60 * 1000
export const TETO_ESCRITA_POR_TOKEN = 300
export const TETO_LEITURA_POR_TOKEN = 240
const usos = new Map<string, { desde: number; n: number }>()

export function dentroDoTetoChecklist(chave: string, teto: number, agora = Date.now()): boolean {
  const atual = usos.get(chave)
  if (!atual || agora - atual.desde >= JANELA_MS) { usos.set(chave, { desde: agora, n: 1 }); return true }
  atual.n += 1
  if (usos.size > 20000) usos.clear()
  return atual.n <= teto
}
export function _limparTetoChecklist() { usos.clear() }

type Sb = { from: (t: string) => any }

/** Pedido do token, so se o relatorio foi entregue. null = 404 pra quem chama. */
export async function pedidoDoChecklist(sb: Sb, token: string): Promise<{ id: string } | null> {
  if (!RE_TOKEN.test(token)) return null
  const { data } = await sb.from('pedidos_premium').select('id,status').eq('token_entrega', token).maybeSingle()
  return data && data.status === 'entregue' ? { id: data.id } : null
}

/** { item_id: true } dos itens marcados (so ids validos). */
export async function lerChecklist(sb: Sb, pedidoId: string): Promise<Record<string, boolean>> {
  const { data } = await sb.from('premium_checklist').select('item_id,marcado').eq('pedido_id', pedidoId)
  const out: Record<string, boolean> = {}
  for (const r of (Array.isArray(data) ? data : [])) if (r?.marcado && idChecklistValido(r.item_id)) out[r.item_id] = true
  return out
}

export async function gravarChecklist(sb: Sb, pedidoId: string, itemId: string, marcado: boolean, agora = new Date()): Promise<boolean> {
  const { error } = await sb.from('premium_checklist').upsert({
    pedido_id: pedidoId, item_id: itemId, marcado,
    marcado_em: marcado ? agora.toISOString() : null,
    atualizado_em: agora.toISOString(),
  }, { onConflict: 'pedido_id,item_id' })
  if (error) console.warn('[checklist] upsert falhou:', error.message)
  return !error
}
