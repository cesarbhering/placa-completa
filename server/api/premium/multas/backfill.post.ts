import crypto from 'node:crypto'

// Backfill (e teste) do bloco de multas/restricoes nos relatorios ja entregues.
//
// Rotina interna, disparada na mao: sem pagina, sem painel, so um POST com o
// segredo no header. Sem a env configurada a rota responde 404, e nao 401:
// rota administrativa nao precisa confirmar que existe.
//
// Dois modos:
//   - { testar: { placa, renavam, uf? } }: roda a busca UMA vez e devolve o
//     detalhe. Serve pra validar em staging que o navegador BR sobe, a sessao
//     gov.br salva loga no DETRAN-SP e a pagina e lida — sem depender de um
//     pedido pago existir.
//   - { tokens: [...] } ou { limite: N }: completa o campo `multas` do snapshot
//     dos pedidos entregues que tem multa de SP e ainda nao tem o bloco.
//
// O que ela NAO faz: reconstruir o snapshot. So o campo das multas e escrito,
// porque o snapshot e o que a pessoa comprou.

import {
  buscarMultasDetalhe,
  temMultaSP,
  renavamDaResposta,
  ufDaResposta,
} from '../../../utils/detran-multas'

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

export default defineEventHandler(async (event) => {
  const segredo = String(useRuntimeConfig().adminSecret || '')
  if (!segredo) throw createError({ statusCode: 404, message: 'Not Found' })

  const enviado = String(getRequestHeader(event, 'x-admin-secret') || '')
  const ok =
    enviado.length === segredo.length &&
    crypto.timingSafeEqual(Buffer.from(enviado), Buffer.from(segredo))
  if (!ok) throw createError({ statusCode: 404, message: 'Not Found' })

  if (!dentroDoTeto()) {
    throw createError({ statusCode: 429, message: 'Limite de disparos por hora atingido.' })
  }

  const body = await readBody(event).catch(() => ({}))
  const supabase = usePremiumSupabase()

  // ---- modo teste: uma busca direta, sem pedido ----
  if (body?.testar && typeof body.testar === 'object') {
    const placa = String(body.testar.placa || '')
    const renavam = String(body.testar.renavam || '')
    const uf = String(body.testar.uf || 'SP').toUpperCase()
    if (!placa || !renavam) {
      throw createError({ statusCode: 400, message: 'testar exige placa e renavam.' })
    }
    const t0 = Date.now()
    const detalhe = await buscarMultasDetalhe(supabase, { placa, renavam, uf }).catch((e: any) => ({
      erro: e?.message || 'erro',
    }))
    return { modo: 'testar', placa, segundos: Math.round((Date.now() - t0) / 1000), detalhe }
  }

  // ---- modo backfill: pedidos entregues com multa SP e sem o bloco ----
  const tokens: string[] = Array.isArray(body?.tokens) ? body.tokens.map((t: any) => String(t)) : []
  const limite = Number(body?.limite) > 0 ? Math.min(Number(body.limite), 50) : null
  if (!tokens.length && !limite) {
    throw createError({ statusCode: 400, message: 'Informe tokens, limite ou testar.' })
  }

  let q = supabase
    .from('pedidos_premium')
    .select('id,placa,token_entrega,consulta_id,relatorio_snapshot')
    .eq('status', 'entregue')
    .not('relatorio_snapshot', 'is', null)
  if (tokens.length) q = q.in('token_entrega', tokens)
  const { data: pedidos, error } = await q
  if (error) throw createError({ statusCode: 502, message: 'Leitura falhou: ' + error.message })

  const resultados: any[] = []
  let feitos = 0

  // Em serie de proposito: em paralelo isto so furaria o teto de gasto mais
  // rapido.
  for (const p of pedidos || []) {
    if (limite && feitos >= limite) break
    const snap: any = p.relatorio_snapshot
    if (!snap || typeof snap !== 'object') {
      resultados.push({ token: p.token_entrega, pulado: 'sem snapshot' })
      continue
    }
    if (snap.multas) {
      resultados.push({ token: p.token_entrega, pulado: 'ja tem multas' })
      continue
    }
    const response = snap?.consulta?.response
    if (!temMultaSP(response)) {
      resultados.push({ token: p.token_entrega, pulado: 'sem multa SP' })
      continue
    }
    const renavam = renavamDaResposta(response)
    if (!renavam) {
      resultados.push({ token: p.token_entrega, pulado: 'sem renavam' })
      continue
    }

    const t0 = Date.now()
    const detalhe = await buscarMultasDetalhe(supabase, {
      placa: p.placa,
      renavam,
      uf: ufDaResposta(response),
      consultaId: p.consulta_id,
    }).catch(() => null)
    const segundos = Math.round((Date.now() - t0) / 1000)
    if (!detalhe) {
      resultados.push({ token: p.token_entrega, ok: false, segundos, motivo: 'sem resposta util' })
      continue
    }

    const { error: upErr } = await supabase
      .from('pedidos_premium')
      .update({ relatorio_snapshot: { ...snap, multas: detalhe } })
      .eq('id', p.id)
    if (upErr) {
      resultados.push({ token: p.token_entrega, ok: false, segundos, motivo: upErr.message })
      continue
    }

    feitos++
    resultados.push({
      token: p.token_entrega,
      ok: true,
      segundos,
      status: detalhe.status,
      multas_centavos: detalhe.multas_total_centavos,
    })
  }

  return { atualizados: feitos, total: (pedidos || []).length, resultados }
})
