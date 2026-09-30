import crypto from 'node:crypto'

// Backfill (e teste) do bloco DETRAN (SP, SC, MG) (multas, hodometro, IPVA,
// licenciamento, restricoes) via Infosimples nos relatorios ja entregues.
//
// Rotina interna, disparada na mao: sem pagina, sem painel, so um POST com o
// segredo no header. Sem a env configurada a rota responde 404, e nao 401:
// rota administrativa nao precisa confirmar que existe.
//
// Dois modos:
//   - { testar: { placa, renavam, uf?, chassi? } } (uf SP|SC|MG, padrao SP; MG exige chassi): UMA chamada direta ao Infosimples, sem
//     pedido, e devolve o bloco parseado. Custa (~R$0,28) e o custo e gravado
//     em premium_custos com pedido_id nulo.
//   - { tokens: [...] } ou { limite: N }: completa o campo `multas` do snapshot
//     dos pedidos entregues de veiculo SP/SC/MG que ainda nao tem o bloco do
//     Infosimples (o bloco antigo do gov.br e sobrescrito).
//
// O que ela NAO faz: reconstruir o snapshot. So o campo das multas e escrito,
// porque o snapshot e o que a pessoa comprou.

import {
  blocoDetranDaUf,
  completarDetran,
  consultarDetranInfosimples,
  DETRAN_UFS,
  infosimplesConfigurado,
  registrarCusto,
  ufDetranSuportada,
} from '../../../utils/infosimples-detran'

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

  // Token/chave basicos; o cert de cada UF (e-CNPJ/e-CPF) e checado na chamada.
  if (!infosimplesConfigurado('ecnpj') && !infosimplesConfigurado('ecpf')) {
    throw createError({ statusCode: 503, message: 'Infosimples nao configurado neste ambiente.' })
  }

  // ---- modo teste: uma chamada direta, sem pedido ----
  if (body?.testar && typeof body.testar === 'object') {
    const placa = String(body.testar.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const renavam = String(body.testar.renavam || '').replace(/[^0-9]/g, '')
    const uf = ufDetranSuportada(body.testar.uf || 'SP')
    if (!placa || !renavam) {
      throw createError({ statusCode: 400, message: 'testar exige placa e renavam.' })
    }
    if (!uf) throw createError({ statusCode: 400, message: `uf sem DETRAN: use ${Object.keys(DETRAN_UFS).join(' ou ')}.` })
    const t0 = Date.now()
    const chassi = String(body.testar.chassi || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || null
    if ((DETRAN_UFS[uf] as any).exigeChassi && !chassi) throw createError({ statusCode: 400, message: `testar ${uf} exige chassi.` })
    const res = await consultarDetranInfosimples({ uf, placa, renavam, chassi })
    await registrarCusto(supabase, { pedidoId: null, fonte: DETRAN_UFS[uf].fonteCusto, preco: res.preco, code: res.code })
    // So o bloco parseado (whitelist) sai daqui: a resposta crua do SC tem nome de pessoa.
    const bloco = res.code === 200 && res.data ? blocoDetranDaUf(uf, res.data) : null
    return {
      modo: 'testar',
      uf,
      placa,
      segundos: Math.round((Date.now() - t0) / 1000),
      code: res.code,
      codeMessage: res.codeMessage,
      preco: res.preco,
      bloco,
    }
  }

  // ---- modo backfill: pedidos entregues de veiculo SP sem o bloco ----
  const tokens: string[] = Array.isArray(body?.tokens) ? body.tokens.map((t: any) => String(t)) : []
  const limite = Number(body?.limite) > 0 ? Math.min(Number(body.limite), 50) : null
  if (!tokens.length && !limite) {
    throw createError({ statusCode: 400, message: 'Informe tokens, limite ou testar.' })
  }

  let q = supabase
    .from('pedidos_premium')
    .select('id,placa,token_entrega,relatorio_snapshot')
    .eq('status', 'entregue')
    .not('relatorio_snapshot', 'is', null)
  if (tokens.length) q = q.in('token_entrega', tokens)
  const { data: pedidos, error } = await q
  if (error) throw createError({ statusCode: 502, message: 'Leitura falhou: ' + error.message })

  const resultados: any[] = []
  let feitos = 0
  let chamadas = 0

  // Em serie de proposito: em paralelo isto so furaria o teto de gasto mais
  // rapido. `limite` conta CHAMADAS pagas, nao so sucessos.
  for (const p of pedidos || []) {
    if (limite && chamadas >= limite) break
    const snap: any = p.relatorio_snapshot
    const t0 = Date.now()
    const r = await completarDetran(supabase, { id: p.id, placa: p.placa }, { response: snap?.consulta?.response })
      .catch((e: any) => ({ ok: false as const, motivo: e?.message || 'erro' }))
    const segundos = Math.round((Date.now() - t0) / 1000)
    if (!r.ok && 'pulado' in r && r.pulado) {
      resultados.push({ token: p.token_entrega, pulado: r.pulado })
      continue
    }
    chamadas++
    if (r.ok) feitos++
    resultados.push({ token: p.token_entrega, segundos, ...r })
  }

  return { atualizados: feitos, chamadas, total: (pedidos || []).length, resultados }
})
