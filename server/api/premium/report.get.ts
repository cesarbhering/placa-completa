import { filtrarPorPlano, camposRestantes, PLANOS } from '../../../shared/planos'
import { getValorCusto } from '../../utils/valor-custo'
import { sanearBlocoMultas } from '../../utils/infosimples-detran'

// Dados do relatorio premium pelo token (superficie PAGA, token e a credencial).
// O corte por plano acontece AQUI, no servidor: o que a basica nao comprou nunca
// chega ao cliente. Borrar no CSS deixaria o dado no DOM.
// Cache do valor/custo por amostra: cada getValorCusto gasta um credito da
// fonte de FIPE, e a pagina de amostra recarrega o tempo todo em dev.
const amostraValorCusto: Record<string, Awaited<ReturnType<typeof getValorCusto>>> = {}

// Estado "versao FIPE nao identificada": os numeros aqui sao os do caso real
// que originou o cuidado (uma scooter 150 que apareceu valendo R$58 mil por
// ter sido casada com uma CB 1000R). Serve pra conferir que a tela NAO exibe
// valor, seguro nem custo de cinco anos quando a identificacao falhou.
const VALOR_CUSTO_FIPE_INCERTA: any = {
  fipe: 'R$ 58.380,00',
  fipeModelo: 'CB 1000R/ABS',
  historico: null,
  quedaAno: null,
  seguroAnual: 4200,
  percentualFipe: 7.2,
  custo5anos: 23000,
  fipeCandidato: {
    decididoPor: 'ambiguo',
    confianca: 'baixa',
    candidatos: [
      { codigo_fipe: '811100-6', modelo: 'CB 1000R/ABS', valor: 58380 },
      { codigo_fipe: '811101-4', modelo: 'NC 750X ABS', valor: 42100 },
      { codigo_fipe: '811116-2', modelo: 'PCX 150/DLX', valor: 15328 },
    ],
  },
}

// Perfil do veiculo da amostra pra consulta de leilao. O payload as vezes vem
// como array de um elemento (mesmo formato cru da consulta), entao normaliza
// antes de ler os campos.
function perfilDaAmostra(amostra: { placa: string; uf: string; payload: any }) {
  const bruto = Array.isArray(amostra.payload) ? amostra.payload[0] : amostra.payload
  const desc = String(bruto?.descricaoMarcaModelo || '')
  return {
    placa: amostra.placa,
    chassi: bruto?.chassi ?? null,
    renavam: bruto?.renavam ?? null,
    marca: desc ? desc.split('/')[0] : null,
    modelo: desc || null,
    ano: bruto?.anoModelo ?? bruto?.anoFabricacao ?? null,
    cor: bruto?.descricaoCor ?? null,
    uf: bruto?.ufJurisdicao ?? amostra.uf,
  }
}

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
      segmento: detectarSegmento({
        senatran: Array.isArray(amostra.payload) ? amostra.payload[0] : amostra.payload,
      }),
      // A amostra "_amostra-fipe-incerta" existe pra revisar a tela de quando a
      // versao FIPE NAO foi identificada com seguranca, sem depender de topar
      // com um pedido real nesse estado. Dev-only, como todo este ramo.
      valorCusto: String(token) === '_amostra-fipe-incerta'
        ? VALOR_CUSTO_FIPE_INCERTA
        : amostraValorCusto[String(token)],
      // A amostra tambem consulta o historico de leilao quando o servico esta
      // configurado: e por aqui que da pra ver a secao renderizada sem gerar
      // pedido pago. Sem env, volta null e a secao nao aparece.
      historicoLeilao: await consultarHistoricoLeilao(perfilDaAmostra(amostra)).catch(() => null),
      // A amostra finge um pedido SEM e-mail, pra dar pra revisar a faixa de
      // entrega por e-mail sem precisar de um pedido real nesse estado.
      temEmail: false,
      brCode: null,
      expiraEm: null,
      expirado: false,
    }
  }
  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('id,status,placa,plano,valor_centavos,preview,consulta_id,entregue_em,criado_em,br_code,expira_em,relatorio_snapshot,snapshot_em,email,erro,forma_pagamento')
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
  let historicoLeilao: Awaited<ReturnType<typeof consultarHistoricoLeilao>> = null
  let segmento: Segmento = 'outro'
  // Detalhe do recall: vem do snapshot, igual ao resto. Snapshot antigo nao
  // tem o campo, e ai a tela mostra so o indicador, como sempre mostrou.
  let recall: any = null
  // Modo autoritativo GM (Chevrolet + chassi cheio): vem do snapshot, igual ao recall.
  let recallAutoritativo: any = null
  // Recall da montadora por chassi (Nissan/Mitsubishi, status por campanha): vem do snapshot.
  let recallMontadora: any = null
  // Debitos e restricoes do orgao estadual: vem do snapshot, igual ao recall.
  // Snapshot antigo (ou sem multa) nao tem o campo e a secao some.
  let multas: any = null

  if (!pendente && pedido.status === 'entregue') {
    if (pedido.relatorio_snapshot) {
      const snap = pedido.relatorio_snapshot as any
      consulta = snap.consulta ?? null
      restantes = snap.camposRestantes ?? 0
      valorCusto = snap.valorCusto ?? null
      chassiOrigem = snap.chassiOrigem ?? null
      // Snapshot gravado antes da feature existir simplesmente nao tem o
      // campo: a secao some, e nao ha remontagem por cima do que a pessoa
      // comprou (a regra do snapshot imutavel vale aqui tambem).
      historicoLeilao = snap.historicoLeilao ?? null
      recall = snap.recall ?? null
      recallAutoritativo = snap.recallAutoritativo ?? null
      recallMontadora = snap.recallMontadora ?? null
      multas = snap.multas ? sanearBlocoMultas(snap.multas) : null
      // Self-heal: a entrega busca recall/multas UMA vez e, se a raspagem deu
      // timeout, o campo ficou null "pra sempre". Ao SERVIR um pedido entregue,
      // se o INDICADOR diz que ha recall/multa mas o bloco esta null, redispara
      // a busca em BACKGROUND (fire-and-forget: o relatorio sai como esta agora,
      // o proximo acesso pega o bloco preenchido). Debounce por tipo+placa (90s)
      // mata o storm de poll/reabertura; os freios de custo
      // (podeGastar/TETO/MAX_TENTATIVAS dentro de buscar*) valem por cima,
      // checados ANTES do run caro -- placa esgotada/acima do teto nao gasta.
      const respostaSnap = (consulta as any)?.response
      if (recall == null && temRecallPendente(respostaSnap) && podeReprocessar(`recall:${pedido.placa}`)) {
        completarRecallDepois(
          supabase,
          { id: pedido.id, placa: pedido.placa, plano: pedido.plano, preview: pedido.preview },
          pedido.consulta_id,
        )
      }
      if (multas == null && temMultaSP(respostaSnap) && podeReprocessar(`multas:${pedido.placa}`)) {
        completarMultasDepois(
          supabase,
          { id: pedido.id, placa: pedido.placa },
          { consultaId: pedido.consulta_id, response: respostaSnap },
        )
      }
      // Snapshot antigo nao tem segmento gravado: recalcula na leitura a partir
      // da propria consulta, pra copy e checagens valerem no que ja foi vendido.
      segmento = snap.segmento ?? 'outro'
      // Correcao de EXIBICAO no snapshot antigo (gravado antes do ajuste de
      // ciclo de 30 anos): o snapshot no banco fica intacto, so o ano do
      // chassi e reconciliado com o ano do registro antes de ir pra tela.
      const brutoSnap = Array.isArray(consulta?.response) ? consulta?.response?.[0] : consulta?.response

      // Campo vazio por falha de servico auxiliar na hora da entrega nao e o
      // que a pessoa comprou: e o que a nossa infra deixou de entregar. Tenta
      // preencher agora, uma vez por campo, e grava so aquele campo no
      // snapshot. Fail-open: se nao der, o relatorio sai como esta hoje.
      const pendentes = camposLazyPendentes(snap, plano)
      if (pendentes.length) {
        const preenchido = await preencherCamposLazy(supabase, {
          token: String(token),
          snap,
          plano,
          placa: pedido.placa,
          consulta_id: pedido.consulta_id,
          preview: pedido.preview,
          campos: pendentes,
        })
        if (preenchido.chassiOrigem !== undefined) chassiOrigem = preenchido.chassiOrigem
        if (preenchido.valorCusto !== undefined) valorCusto = preenchido.valorCusto
        if (preenchido.historicoLeilao !== undefined) historicoLeilao = preenchido.historicoLeilao
      }

      // Relatorio vendido antes da tabela de fabricas existir: o decode e
      // refeito uma vez, so pra ganhar a planta. Mesmo veiculo, mesma fonte.
      if (faltaPlanta(snap) && String(brutoSnap?.chassi || '').trim().length === 17) {
        const enriquecido = await enriquecerPlanta(supabase, {
          token: String(token),
          chassi: String(brutoSnap.chassi).trim(),
          anoReferencia: brutoSnap?.anoModelo ?? brutoSnap?.anoFabricacao ?? null,
          modelo: brutoSnap?.descricaoMarcaModelo ?? null,
        })
        if (enriquecido !== undefined) chassiOrigem = enriquecido
      }

      chassiOrigem = corrigirAnoChassi(
        chassiOrigem,
        brutoSnap?.anoModelo ?? brutoSnap?.anoFabricacao ?? null,
      )
    } else {
      // Relê o pedido antes de montar. Sem isso, quando a pessoa abre o
      // relatorio no mesmo instante em que a entrega esta gravando o snapshot,
      // as duas montagens acontecem em paralelo e o relatorio consulta os
      // servicos auxiliares duas vezes (visto em producao: duas chamadas a
      // leiloes-api com 0,1s de diferenca pro mesmo pedido). A consulta paga
      // nunca duplica, porque ela tem claim atomico; o desperdicio e so de
      // chamada interna, mas nao custa nada evita-lo.
      const { data: recente } = await supabase
        .from('pedidos_premium')
        .select('relatorio_snapshot')
        .eq('token_entrega', String(token))
        .maybeSingle()
      if (recente?.relatorio_snapshot) {
        const snap = recente.relatorio_snapshot as any
        consulta = snap.consulta ?? null
        restantes = snap.camposRestantes ?? 0
        valorCusto = snap.valorCusto ?? null
        chassiOrigem = snap.chassiOrigem ?? null
        historicoLeilao = snap.historicoLeilao ?? null
        recall = snap.recall ?? null
        recallAutoritativo = snap.recallAutoritativo ?? null
        recallMontadora = snap.recallMontadora ?? null
        multas = snap.multas ? sanearBlocoMultas(snap.multas) : null
        segmento = snap.segmento ?? 'outro'
      } else {
        const snapshot = await montarRelatorioSnapshot(supabase, {
          placa: pedido.placa, plano, consulta_id: pedido.consulta_id, preview: pedido.preview,
        })
        consulta = snapshot.consulta
        restantes = snapshot.camposRestantes
        valorCusto = snapshot.valorCusto
        chassiOrigem = snapshot.chassiOrigem
        historicoLeilao = snapshot.historicoLeilao
        recall = snapshot.recall ?? null
        recallAutoritativo = snapshot.recallAutoritativo ?? null
        multas = snapshot.multas ? sanearBlocoMultas(snapshot.multas) : null
        segmento = snapshot.segmento
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
    historicoLeilao,
    recall,
    recallAutoritativo,
    recallMontadora,
    multas,
    segmento: segmento === 'outro' ? detectarSegmento({
      wdapi: pedido.preview,
      senatran: Array.isArray(consulta?.response) ? consulta?.response?.[0] : consulta?.response,
      chassi: (Array.isArray(consulta?.response) ? consulta?.response?.[0] : consulta?.response)?.chassi,
    }) : segmento,
    preview: pedido.preview,
    // So o FLAG, nunca o e-mail: quem tem o token da pagina nao precisa
    // descobrir o e-mail de quem comprou, e um token que vaze nao pode virar
    // vazamento de contato.
    temEmail: !!pedido.email,
    // Por que o pedido nao foi adiante, em uma palavra. O texto do erro
    // (mensagem interna, trace) NUNCA vai pra tela: aqui sai so o codigo que a
    // pagina sabe transformar em explicacao. Sem isto, quem comprou um veiculo
    // que o registro nacional nao conhece lia "nao foi possivel concluir" e
    // ficava achando que o site quebrou.
    motivoFalha: /HTTP 404/.test(String(pedido.erro || '')) ? 'veiculo_nao_encontrado' : null,
    entregue_em: pedido.entregue_em,
    consulta,
    brCode: pendente && !expirado ? pedido.br_code : null,
    expiraEm: pendente ? pedido.expira_em : null,
    expirado,
    // Meio de pagamento: a tela usa pra NUNCA mostrar QR de Pix num pedido de
    // cartao (mostra "confirmando o cartao" ate o status virar) e pra nao tentar
    // renovar Pix nele.
    formaPagamento: (pedido as any).forma_pagamento || 'pix',
  }
})
