import crypto from 'node:crypto'
import { agruparCampanhasRecall } from '../../../utils/recall-agrupar'
import { agrupamentoValido } from '../../../../shared/recall-agrupamento'

// Backfill do agrupamento de recalls (20/out/2026) nos relatorios ja entregues
// com mais de 1 campanha em recallBase e sem `agrupado` valido.
// Rotina interna: POST com x-admin-secret; sem a env, 404.
//   {}                          -> dry-run: lista quem seria agrupado (nada e chamado nem gravado)
//   { aplicar: true, limite? }  -> chama o agente (em serie) e grava SO recallBase.agrupado
//   { tokens: [...] }           -> restringe a esses pedidos (com ou sem aplicar)
// Nao manda e-mail a ninguem. Backup: quem roda guarda antes o recallBase dos
// pedidos listados no dry-run (desfazer = tirar a chave `agrupado`).

export default defineEventHandler(async (event) => {
  const segredo = String(useRuntimeConfig().adminSecret || '')
  if (!segredo) throw createError({ statusCode: 404, message: 'Not Found' })
  const enviado = String(getRequestHeader(event, 'x-admin-secret') || '')
  const ok = enviado.length === segredo.length && crypto.timingSafeEqual(Buffer.from(enviado), Buffer.from(segredo))
  if (!ok) throw createError({ statusCode: 404, message: 'Not Found' })

  const body: any = await readBody(event).catch(() => ({}))
  const aplicar = body?.aplicar === true
  const limite = Math.min(Math.max(Number(body?.limite) || 50, 1), 200)
  const tokens: string[] = Array.isArray(body?.tokens) ? body.tokens.map((t: any) => String(t)) : []
  const supabase = usePremiumSupabase()

  let q = supabase.from('pedidos_premium')
    .select('id,token_entrega,placa,recallBase:relatorio_snapshot->recallBase')
    .eq('status', 'entregue')
    .not('relatorio_snapshot->recallBase', 'is', null)
  if (tokens.length) q = q.in('token_entrega', tokens)
  const { data, error } = await q
  if (error) throw createError({ statusCode: 502, message: 'Leitura falhou: ' + error.message })

  const alvos = (data || []).filter((p: any) => {
    const camps = Array.isArray(p.recallBase?.campanhas) ? p.recallBase.campanhas : []
    return camps.length > 1 && !agrupamentoValido(p.recallBase?.agrupado, camps.length)
  })
  if (!aplicar) {
    return {
      dryRun: true,
      total: alvos.length,
      pedidos: alvos.map((p: any) => ({ id: p.id, token: p.token_entrega, placa: p.placa, campanhas: p.recallBase.campanhas.length })),
    }
  }

  const chaveApi = String(useRuntimeConfig().anthropicApiKey || '') || null
  const resultados: any[] = []
  for (const p of alvos.slice(0, limite)) {
    const agrupado = await agruparCampanhasRecall(p.recallBase.campanhas, { sb: supabase, chaveApi, pedidoId: p.id })
    if (!agrupado) { resultados.push({ token: p.token_entrega, placa: p.placa, ok: false }); continue }
    // Rele o snapshot na hora de gravar (outro bloco pode ter escrito) e muda so recallBase.agrupado.
    const { data: atual } = await supabase.from('pedidos_premium').select('relatorio_snapshot').eq('id', p.id).maybeSingle()
    const snap = atual?.relatorio_snapshot
    if (!snap?.recallBase) { resultados.push({ token: p.token_entrega, ok: false, motivo: 'sem recallBase' }); continue }
    const { error: e2 } = await supabase.from('pedidos_premium')
      .update({ relatorio_snapshot: { ...snap, recallBase: { ...snap.recallBase, agrupado } } }).eq('id', p.id)
    resultados.push({ token: p.token_entrega, placa: p.placa, ok: !e2, grupos: agrupado.grupos.length, campanhas: agrupado.total })
    console.log('[recall-agrupar-backfill]', JSON.stringify(resultados.at(-1)))
  }
  return { aplicado: true, total: alvos.length, feitos: resultados.filter((r) => r.ok).length, resultados }
})
