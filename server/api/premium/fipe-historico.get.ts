import { alvoDoSnapshot, historicoDaVersao } from '../../utils/fipe-historico-versao'

// GET /api/premium/fipe-historico?token=<token do relatorio>&codigo=<codigo FIPE>
// Historico de preco de uma versao da shortlist ambigua do relatorio. Ver
// server/utils/fipe-historico-versao.ts. 404 pra tudo que nao for versao da
// shortlist de um relatorio entregue.
export default defineEventHandler(async (event) => {
  const { token, codigo } = getQuery(event)
  const tok = String(token || '')
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(tok)) throw createError({ statusCode: 404 })
  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('status,relatorio_snapshot')
    .eq('token_entrega', tok)
    .maybeSingle()
  if (!pedido || pedido.status !== 'entregue') throw createError({ statusCode: 404 })
  const alvo = alvoDoSnapshot(pedido.relatorio_snapshot, String(codigo || ''))
  if (!alvo) throw createError({ statusCode: 404 })
  const config = useRuntimeConfig()
  const historico = await historicoDaVersao(alvo, String(codigo), config.fipeApiUrl, config.fipeApiToken)
  setHeader(event, 'Cache-Control', 'private, max-age=3600')
  return { historico: historico || [] }
})
