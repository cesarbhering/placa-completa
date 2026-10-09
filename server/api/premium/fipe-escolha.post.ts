import { validarEscolha, aplicarEscolha } from '../../utils/fipe-escolha'
import { getValorCusto } from '../../utils/valor-custo'
import { localDoVeiculo } from '../../utils/relatorio-snapshot'
import { detectarSegmento } from '../../utils/segmento'

// POST /api/premium/fipe-escolha { token, codigo }
// O cliente indica a versao do carro dele (manual ou automatico) quando a FIPE
// ficou em duvida. Recalcula valor, historico, queda e seguro pra essa versao
// e grava no snapshot. So versao da shortlist do proprio relatorio entregue.
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const tok = String(body?.token || '')
  const codigo = String(body?.codigo || '')
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(tok)) throw createError({ statusCode: 404 })
  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('id,status,placa,preview,relatorio_snapshot')
    .eq('token_entrega', tok)
    .maybeSingle()
  if (!pedido || pedido.status !== 'entregue' || !pedido.relatorio_snapshot) throw createError({ statusCode: 404 })
  const snap: any = pedido.relatorio_snapshot
  const v = validarEscolha(snap, codigo)
  if (!v.ok) throw createError({ statusCode: v.motivo === 'limite de trocas' ? 429 : 409, message: v.motivo })

  const resp = snap?.consulta?.response
  const reg = Array.isArray(resp) ? resp[0] : resp
  const local = localDoVeiculo(pedido.preview)
  const segmento = snap.segmento || detectarSegmento({ wdapi: pedido.preview, senatran: reg, chassi: reg?.chassi })
  const novo = await getValorCusto(pedido.placa, local.uf, local.municipio, {
    ativo: true,
    segmento,
    senatran: {
      cilindrada: reg?.cilindrada ?? null, potencia: reg?.potencia ?? null,
      descricaoMarcaModelo: reg?.descricaoMarcaModelo ?? null, anoModelo: reg?.anoModelo ?? null,
      codigoCombustivel: reg?.codigoCombustivel ?? null, descricaoTipoVeiculo: reg?.descricaoTipoVeiculo ?? null,
      descricaoEspecie: reg?.descricaoEspecie ?? null,
    },
    forcar: v.candidato,
  }).catch(() => null)
  if (!novo?.fipe) throw createError({ statusCode: 502, message: 'nao foi possivel calcular agora' })

  const valorCusto = aplicarEscolha(snap.valorCusto, novo, v.candidato)
  // Rele antes de gravar (recall/multas podem ter gravado no meio).
  const { data: atual } = await supabase.from('pedidos_premium').select('relatorio_snapshot').eq('id', pedido.id).maybeSingle()
  const base = atual?.relatorio_snapshot && typeof atual.relatorio_snapshot === 'object' ? atual.relatorio_snapshot : snap
  const { error } = await supabase.from('pedidos_premium').update({ relatorio_snapshot: { ...base, valorCusto } }).eq('id', pedido.id)
  if (error) throw createError({ statusCode: 500, message: 'falha ao gravar' })
  return { valorCusto }
})
