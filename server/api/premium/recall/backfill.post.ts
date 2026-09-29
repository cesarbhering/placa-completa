import crypto from 'node:crypto'

// Backfill do detalhe de recall nos relatorios ja entregues.
//
// Os relatorios vendidos antes da busca existir tem o indicador de recall e
// nada mais. Esta rota completa o campo `recall` do snapshot deles, um por um.
//
// Rotina interna, disparada na mao: sem pagina, sem painel, so um POST com o
// segredo no header. Sem a env configurada a rota responde 404, e nao 401:
// rota administrativa nao precisa confirmar que existe.
//
// O que ela NAO faz: reconstruir o snapshot. So o campo do recall e escrito,
// porque o snapshot e o que a pessoa comprou.

import { buscarRecallDetalhe, temRecallPendente } from '../../../utils/recall-detalhe'

/** Teto de disparos por hora, contado em memoria do processo. */
const TETO_POR_HORA = 5
const disparos: number[] = []

function dentroDoTeto(): boolean {
  const agora = Date.now()
  while (disparos.length && agora - disparos[0]! > 3600000) disparos.shift()
  if (disparos.length >= TETO_POR_HORA) return false
  disparos.push(agora)
  return true
}

/** Resumo da FIPE pra devolver no resultado: deixa o Cesar ver como ficou o
 * desempate (decididoPor, versao e valor) sem despejar o valorCusto inteiro. */
function fipeResumo(vc: any) {
  if (!vc || typeof vc !== 'object') return null
  return {
    decididoPor: vc?.fipeCandidato?.decididoPor ?? null,
    confianca: vc?.fipeCandidato?.confianca ?? null,
    fipeModelo: vc?.fipeModelo ?? null,
    fipe: vc?.fipe ?? null,
  }
}

export default defineEventHandler(async (event) => {
  const segredo = String(useRuntimeConfig().adminSecret || '')
  if (!segredo) throw createError({ statusCode: 404, message: 'Not Found' })

  const enviado = String(getRequestHeader(event, 'x-admin-secret') || '')
  // Comparacao de tamanho primeiro e depois byte a byte: timingSafeEqual
  // estoura com tamanhos diferentes.
  const ok = enviado.length === segredo.length
    && crypto.timingSafeEqual(Buffer.from(enviado), Buffer.from(segredo))
  if (!ok) throw createError({ statusCode: 404, message: 'Not Found' })

  if (!dentroDoTeto()) {
    throw createError({ statusCode: 429, message: 'Limite de disparos por hora atingido.' })
  }

  const body = await readBody(event).catch(() => ({}))
  const supabase = usePremiumSupabase()

  // ---- modo restaurar (rebuildFipe): reconstroi o valorCusto do zero (montar)
  // e reaplica o refino guardado por recall. Conserta pedido com valorCusto
  // corrompido (ex.: um refino que degradou pro fallback da FIPE-api e cravou a
  // versao ERRADA com cara de certa). So escreve se o montar trouxe resultado
  // REAL (fipeCandidato presente = nao-fallback): se a FIPE-api estiver
  // instavel, NAO re-corrompe -- pede pra tentar de novo. Idempotente/guardado.
  const rebuild: string[] = Array.isArray(body?.rebuildFipe) ? body.rebuildFipe.map((t: any) => String(t)) : []
  if (rebuild.length) {
    const { data: peds, error: eR } = await supabase
      .from('pedidos_premium')
      .select('id,placa,token_entrega,consulta_id,relatorio_snapshot,plano,preview')
      .eq('status', 'entregue')
      .not('relatorio_snapshot', 'is', null)
      .in('token_entrega', rebuild)
    if (eR) throw createError({ statusCode: 502, message: 'Leitura falhou: ' + eR.message })
    const out: any[] = []
    for (const p of peds || []) {
      const snap: any = p.relatorio_snapshot
      if (!snap || typeof snap !== 'object') { out.push({ token: p.token_entrega, pulado: 'sem snapshot' }); continue }
      const alvo = { placa: p.placa, plano: p.plano, consulta_id: p.consulta_id, preview: p.preview }
      const base = await montarRelatorioSnapshot(supabase, alvo, ['valorCusto']).catch(() => null)
      const baseVc: any = base?.valorCusto ?? null
      if (!baseVc?.fipeCandidato) {
        out.push({ token: p.token_entrega, pulado: 'fipe-api instavel (montar caiu no fallback); tente de novo' })
        continue
      }
      let novoVc = baseVc
      if (snap.recall) {
        const ref = await refinarValorCustoPeloRecall(supabase, { ...snap, valorCusto: novoVc }, alvo, snap.recall)
        if (ref) novoVc = ref
      }
      const { error: upErr } = await supabase
        .from('pedidos_premium')
        .update({ relatorio_snapshot: { ...snap, valorCusto: novoVc } })
        .eq('id', p.id)
      if (upErr) { out.push({ token: p.token_entrega, ok: false, motivo: upErr.message }); continue }
      out.push({ token: p.token_entrega, ok: true, rebuild: true, fipe: fipeResumo(novoVc) })
    }
    return { rebuild: out.length, resultados: out }
  }

  // ---- modo AUTORITATIVO GM: re-dispara o caminho do autoritativo (Chevrolet +
  // chassi cheio) num pedido JA entregue e grava snap.recallAutoritativo. So
  // escreve o campo recallAutoritativo (aditivo/idempotente). Devolve o
  // diagnostico (marca/chassi/indicador) pra achar o pedido certo entre varios.
  const autoTokens: string[] = Array.isArray(body?.autoritativo) ? body.autoritativo.map((t: any) => String(t)) : []
  if (autoTokens.length) {
    const { data: peds, error: eA } = await supabase
      .from('pedidos_premium')
      .select('id,placa,token_entrega,relatorio_snapshot')
      .eq('status', 'entregue')
      .not('relatorio_snapshot', 'is', null)
      .in('token_entrega', autoTokens)
    if (eA) throw createError({ statusCode: 502, message: 'Leitura falhou: ' + eA.message })
    const out: any[] = []
    for (const p of peds || []) {
      const snap: any = p.relatorio_snapshot
      if (!snap || typeof snap !== 'object') { out.push({ token: p.token_entrega, pulado: 'sem snapshot' }); continue }
      const resp = snap?.consulta?.response
      const bruto = Array.isArray(resp) ? resp[0] : resp
      const desc = String(bruto?.descricaoMarcaModelo || '')
      const chassi = String(bruto?.chassi || '').trim()
      const ehMarcaAutoritativa = /\b(chevrolet|gm|general\s*motors|volkswagen|vw|fiat)\b/i.test(desc)
      const indicador = temRecallPendente(resp)
      const diag: any = { token: p.token_entrega, desc, chassiLen: chassi.length, ehMarcaAutoritativa, indicadorRecall: indicador }
      if (!ehMarcaAutoritativa) { out.push({ ...diag, pulado: 'marca sem modo autoritativo (nem Chevrolet/GM nem VW)' }); continue }
      if (chassi.length !== 17) { out.push({ ...diag, pulado: 'chassi nao cheio' }); continue }
      if (!indicador) { out.push({ ...diag, pulado: 'SENATRAN nao flaggou indicadorRecall (gate fechado, decisao do Cesar)' }); continue }
      const aut = await consultarRecallAutoritativo({
        placa: p.placa, chassi, marca: desc.split('/')[0], modelo: desc,
        ano: bruto?.anoModelo ?? bruto?.anoFabricacao ?? null,
        ano_fab: bruto?.anoFabricacao ?? null, ano_mod: bruto?.anoModelo ?? null,
      })
      if (!aut?.consultado) { out.push({ ...diag, ok: false, motivo: 'autoritativo nao consultado (GM caiu?) — fail-open, snapshot intacto' }); continue }
      const { error: upErr } = await supabase
        .from('pedidos_premium')
        .update({ relatorio_snapshot: { ...snap, recallAutoritativo: aut } })
        .eq('id', p.id)
      if (upErr) { out.push({ ...diag, ok: false, motivo: upErr.message }); continue }
      out.push({ ...diag, ok: true, gravou: true, tem_recall_aberto: aut.tem_recall_aberto, n_campanhas: aut.n_campanhas, campanhas: aut.campanhas.map((c: any) => ({ numero: c.numero, titulo: c.titulo })) })
    }
    return { autoritativo: out.length, resultados: out }
  }

  const tokens: string[] = Array.isArray(body?.tokens) ? body.tokens.map((t: any) => String(t)) : []
  const limite = Number(body?.limite) > 0 ? Math.min(Number(body.limite), 50) : null
  if (!tokens.length && !limite) {
    throw createError({ statusCode: 400, message: 'Informe tokens, limite ou rebuildFipe.' })
  }
  let q = supabase
    .from('pedidos_premium')
    .select('id,placa,token_entrega,consulta_id,relatorio_snapshot,plano,preview')
    .eq('status', 'entregue')
    .not('relatorio_snapshot', 'is', null)
  if (tokens.length) q = q.in('token_entrega', tokens)
  const { data: pedidos, error } = await q
  if (error) throw createError({ statusCode: 502, message: 'Leitura falhou: ' + error.message })

  const resultados: any[] = []
  let feitos = 0

  // Em serie de proposito: em paralelo isto so furaria o teto de gasto do
  // recall-detalhe mais rapido.
  for (const p of pedidos || []) {
    if (limite && feitos >= limite) break
    const snap: any = p.relatorio_snapshot
    if (!snap || typeof snap !== 'object') { resultados.push({ token: p.token_entrega, pulado: 'sem snapshot' }); continue }
    // Pedido que JA tem recall: nao rebusca o recall (custaria caro e sem
    // motivo), mas ainda tenta o refino da Camada 2 usando o texto de recall
    // que ja esta no snapshot. Reports antigos, entregues antes de o desempate
    // por recall existir, ficaram com a FIPE ambigua mesmo tendo recall que diz
    // o cambio; isto conserta so eles. Fail-open e idempotente: se a FIPE nao
    // esta ambigua (ou nao ha hint de cambio no recall), refinar retorna null e
    // o pedido e pulado sem escrever nada. Nao gasta consulta paga nem
    // navegador: montarRelatorioSnapshot le a consulta do cache por consulta_id.
    if (snap.recall) {
      const refeito = await refinarValorCustoPeloRecall(
        supabase,
        snap,
        { placa: p.placa, plano: p.plano, consulta_id: p.consulta_id, preview: p.preview },
        snap.recall,
      )
      if (!refeito) { resultados.push({ token: p.token_entrega, pulado: 'ja tem recall (fipe nao ambigua ou sem hint)' }); continue }
      const { error: upErr } = await supabase
        .from('pedidos_premium')
        .update({ relatorio_snapshot: { ...snap, valorCusto: refeito } })
        .eq('id', p.id)
      if (upErr) { resultados.push({ token: p.token_entrega, ok: false, motivo: upErr.message }); continue }
      feitos++
      resultados.push({ token: p.token_entrega, ok: true, reRefino: true, fipe: fipeResumo(refeito) })
      continue
    }
    if (!temRecallPendente(snap?.consulta?.response)) { resultados.push({ token: p.token_entrega, pulado: 'sem recall pendente' }); continue }

    const t0 = Date.now()
    const detalhe = await buscarRecallDetalhe(supabase, { placa: p.placa, consultaId: p.consulta_id }).catch(() => null)
    const segundos = Math.round((Date.now() - t0) / 1000)
    if (!detalhe) { resultados.push({ token: p.token_entrega, ok: false, segundos, motivo: 'sem resposta util' }); continue }

    const patch: any = { ...snap, recall: detalhe }
    // Camada 2: se a FIPE ficou ambigua e o recall diz o cambio, refina a versao
    // (mesmo comportamento da entrega). Fail-open: mantem a FIPE de antes.
    const refinado = await refinarValorCustoPeloRecall(
      supabase,
      snap,
      { placa: p.placa, plano: p.plano, consulta_id: p.consulta_id, preview: p.preview },
      detalhe,
    )
    if (refinado) patch.valorCusto = refinado

    const { error: upErr } = await supabase
      .from('pedidos_premium')
      .update({ relatorio_snapshot: patch })
      .eq('id', p.id)
    if (upErr) { resultados.push({ token: p.token_entrega, ok: false, segundos, motivo: upErr.message }); continue }

    feitos++
    resultados.push({ token: p.token_entrega, ok: true, segundos, status: detalhe.status, campanhas: detalhe.campanhas.length, fipeRefinada: !!refinado, fipe: refinado ? fipeResumo(refinado) : null })
  }

  return { atualizados: feitos, total: (pedidos || []).length, resultados }
})
