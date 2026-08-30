import { filtrarPorPlano, camposRestantes, PLANOS } from '../../../shared/planos'
import { getValorCusto } from '../../utils/valor-custo'

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
      valorCentavos: PLANOS.completa.valorCentavos,
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
    .select('status,placa,plano,valor_centavos,preview,consulta_id,entregue_em,criado_em,br_code,expira_em,relatorio_snapshot,snapshot_em')
    .eq('token_entrega', String(token))
    .single()
  if (!pedido) throw createError({ statusCode: 404, message: 'Relatorio nao encontrado' })

  // pedido ainda nao pago: devolve o copia-e-cola pra retomar o pagamento
  // (o "Concluir" do historico local cai aqui). Nao roda consulta nenhuma.
  const pendente = pedido.status === 'aguardando_pagamento'
  const expirado = pendente && pedido.expira_em ? new Date(pedido.expira_em).getTime() < Date.now() : false

  const plano = pedido.plano || 'completa'

  // Snapshot imutavel: pedido entregue ja tem o relatorio congelado (gravado
  // na entrega, ver premium-processar.ts) — serve ELE, sem nenhuma chamada
  // externa (nem vin-decoder nem FIPE). So monta na hora (e tenta gravar,
  // fail-open) quando o pedido e velho e nunca ganhou snapshot. NUNCA
  // remonta por cima de um snapshot ja existente: e a fonte da verdade fixa
  // do que a pessoa comprou, mesmo que uma nova consulta atualize os dados
  // (isso vira um pedido novo, nao reescreve este).
  let valorCusto: Awaited<ReturnType<typeof getValorCusto>> = null
  let consulta: any = null
  let restantes = 0
  let chassiOrigem: Awaited<ReturnType<typeof decodificarChassi>> = null

  if (!pendente && pedido.status === 'entregue') {
    if (pedido.relatorio_snapshot) {
      const snap = pedido.relatorio_snapshot as any
      consulta = snap.consulta ?? null
      restantes = snap.camposRestantes ?? 0
      valorCusto = snap.valorCusto ?? null
      chassiOrigem = snap.chassiOrigem ?? null
      // Correcao de EXIBICAO no snapshot antigo (gravado antes do ajuste de
      // ciclo de 30 anos): o snapshot no banco fica intacto, so o ano do
      // chassi e reconciliado com o ano do registro antes de ir pra tela.
      const brutoSnap = Array.isArray(consulta?.response) ? consulta?.response?.[0] : consulta?.response
      chassiOrigem = corrigirAnoChassi(
        chassiOrigem,
        brutoSnap?.anoModelo ?? brutoSnap?.anoFabricacao ?? null,
      )
    } else {
      const snapshot = await montarRelatorioSnapshot(supabase, {
        placa: pedido.placa, plano, consulta_id: pedido.consulta_id, preview: pedido.preview,
      })
      consulta = snapshot.consulta
      restantes = snapshot.camposRestantes
      valorCusto = snapshot.valorCusto
      chassiOrigem = snapshot.chassiOrigem
      // Backfill lazy: grava pra proxima visita ja vir do snapshot. Fail-open
      // — se der erro (corrida com outra leitura, rede etc), so tenta de novo
      // na proxima visualizacao, o relatorio desta ja saiu montado do jeito certo.
      await supabase
        .from('pedidos_premium')
        .update({ relatorio_snapshot: snapshot, snapshot_em: new Date().toISOString() })
        .eq('token_entrega', String(token))
        .is('relatorio_snapshot', null)
        .then(() => {}, () => {})
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
    chassiOrigem,
    preview: pedido.preview,
    entregue_em: pedido.entregue_em,
    consulta,
    brCode: pendente && !expirado ? pedido.br_code : null,
    expiraEm: pendente ? pedido.expira_em : null,
    expirado,
  }
})
