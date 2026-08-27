import { filtrarPorPlano, camposRestantes } from '../../../shared/planos'
import { getValorCusto } from '../../utils/valor-custo'

// Local do VEICULO, nao de quem abre o relatorio: e o que os calculos de IPVA
// e seguro precisam, e quem abre o link pode nao ser quem consultou. O preview
// guarda os dois desde o checkout.
function localDoVeiculo(pedido: any): { uf: string | null; municipio: string | null } {
  const p = pedido?.preview
  if (!p || typeof p !== 'object') return { uf: null, municipio: null }
  return {
    uf: typeof p.uf === 'string' ? p.uf : null,
    municipio: typeof p.municipio === 'string' ? p.municipio : null,
  }
}

// Dados do relatorio premium pelo token (superficie PAGA, token e a credencial).
// O corte por plano acontece AQUI, no servidor: o que a basica nao comprou nunca
// chega ao cliente. Borrar no CSS deixaria o dado no DOM.
// Cache do valor/custo por amostra: cada getValorCusto gasta um credito da
// fonte de FIPE, e a pagina de amostra recarrega o tempo todo em dev.
const amostraValorCusto: Record<string, Awaited<ReturnType<typeof getValorCusto>>> = {}

export default defineEventHandler(async (event) => {
  const { token } = getQuery(event)
  if (!token) throw createError({ statusCode: 400, message: 'token obrigatorio' })

  // /premium/_amostra*: relatorios de desenvolvimento com payloads reais (o
  // catalogo vive em server/dev/amostra-relatorio.ts). So em dev: em producao
  // cai no fluxo normal e vira 404.
  if (import.meta.dev && String(token).startsWith('_amostra')) {
    const { AMOSTRAS } = await import('../../dev/amostra-relatorio')
    const amostra = AMOSTRAS[String(token)]
    if (!amostra) throw createError({ statusCode: 404, message: 'Amostra desconhecida' })
    if (!(String(token) in amostraValorCusto)) {
      amostraValorCusto[String(token)] =
        await getValorCusto(amostra.placa, amostra.uf, amostra.municipio).catch(() => null)
    }
    return {
      status: 'entregue',
      placa: amostra.placa,
      plano: 'completa',
      valorCentavos: 4490,
      camposRestantes: 0,
      preview: null,
      entregue_em: new Date().toISOString(),
      consulta: { placa: amostra.placa, response: filtrarPorPlano(amostra.payload, 'completa') },
      valorCusto: amostraValorCusto[String(token)],
      brCode: null,
      expiraEm: null,
      expirado: false,
    }
  }
  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('status,placa,plano,valor_centavos,preview,consulta_id,entregue_em,criado_em,br_code,expira_em')
    .eq('token_entrega', String(token))
    .single()
  if (!pedido) throw createError({ statusCode: 404, message: 'Relatorio nao encontrado' })

  // pedido ainda nao pago: devolve o copia-e-cola pra retomar o pagamento
  // (o "Concluir" do historico local cai aqui). Nao roda consulta nenhuma.
  const pendente = pedido.status === 'aguardando_pagamento'
  const expirado = pendente && pedido.expira_em ? new Date(pedido.expira_em).getTime() < Date.now() : false

  const plano = pedido.plano || 'completa'

  // Seguro estimado e custo em 5 anos sao conteudo pago (o valor FIPE atual
  // voltou pra gratis; so a evolucao/historico de depreciacao segue pago). Quem
  // comprou precisa receber isto. So pra pedido ja entregue, e nunca na tela de
  // retomada do Pix (ali ninguem pagou ainda).
  let valorCusto: Awaited<ReturnType<typeof getValorCusto>> = null
  if (!pendente && pedido.status === 'entregue') {
    const local = localDoVeiculo(pedido)
    valorCusto = await getValorCusto(pedido.placa, local.uf, local.municipio)
  }

  let consulta: any = null
  let restantes = 0
  if (pedido.consulta_id) {
    const { data } = await supabase
      .from('senatran_consultas')
      .select('response,placa,created_at')
      .eq('id', pedido.consulta_id)
      .single()
    if (data) {
      restantes = camposRestantes(data.response, plano)
      consulta = { ...data, response: filtrarPorPlano(data.response, plano) }
    }
  }
  return {
    status: pedido.status,
    placa: pedido.placa,
    plano,
    // usado na tela de retomada do Pix, pra pessoa reconferir o que esta pagando
    valorCentavos: pedido.valor_centavos,
    // quantos campos a completa ainda entregaria alem deste plano (upsell)
    camposRestantes: restantes,
    valorCusto,
    preview: pedido.preview,
    entregue_em: pedido.entregue_em,
    consulta,
    brCode: pendente && !expirado ? pedido.br_code : null,
    expiraEm: pendente ? pedido.expira_em : null,
    expirado,
  }
})
