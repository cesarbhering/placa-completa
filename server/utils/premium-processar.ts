import { completarRenajudDepois } from './renajud-detalhe'
import { avisarVenda } from './aviso-venda'
import { ambienteDaConsultaPaga } from './gcc-reserva'
import { gerarCupomRecompra } from './cupom-recompra'
import { marcaTemAutoritativo, normalizarMarcaRecall } from '../../shared/marcas-recall'
import { emVoo } from './tarefas-em-voo'
// Processa um pedido PAGO: dispara a consulta SENATRAN uma vez, entrega ou
// reembolsa. Usado pelo WEBHOOK e pelo POLLING de status (o que chegar primeiro).
// Trava atomica via update condicional (status aguardando/pago -> consultando):
// so um processo "reivindica" o pedido; os outros saem.
// O Cesar quer ver todo estorno automatico na hora. A caixa de erros do time
// continua recebendo; este e o endereco extra.
const AVISO_ESTORNO = 'cesarcbhering@gmail.com'

/**
 * Busca do detalhe do recall, depois que a pessoa ja recebeu o relatorio. Roda solta e
 * atualiza SO o campo do recall dentro do snapshot ja gravado, para nao
 * reconstruir o resto (que custa chamadas externas) nem sobrescrever o que
 * outro processo tenha gravado no meio tempo. Silenciosa por natureza: a
 * entrega ja aconteceu, e falhar aqui nao pode virar erro pra quem comprou.
 */
export function completarRecallDepois(
  supabase: any,
  pedido: { id: string; placa: string; plano?: string | null; preview?: any; token_entrega?: string | null },
  consultaId: string | null,
): void {
  void emVoo('recall', async () => {
    try {
      // Le o snapshot PRIMEIRO: o modo autoritativo (GM) precisa de marca+chassi.
      const { data } = await supabase
        .from('pedidos_premium')
        .select('relatorio_snapshot')
        .eq('id', pedido.id)
        .maybeSingle()
      const snap = data?.relatorio_snapshot
      if (!snap || typeof snap !== 'object') return

      const resp = (snap as any)?.consulta?.response
      const bruto = Array.isArray(resp) ? resp[0] : resp
      const desc = String(bruto?.descricaoMarcaModelo || '')
      const chassi = String(bruto?.chassi || '').trim()

      // MODO AUTORITATIVO: marcas com fonte autoritativa (Chevrolet/GM; VW quando
      // o proxy VW estiver ligado na leiloes-api) + chassi cheio (17). Diz QUAL
      // recall esta aberto pra ESTE chassi. Pra VW sem proxy, a leiloes-api nao
      // devolve o bloco autoritativo -> consultarRecallAutoritativo volta null ->
      // fail-open pro scrape SENATRAN. So deixa o plug marca-aware.
      let autoritativo: Awaited<ReturnType<typeof consultarRecallAutoritativo>> = null
      if (marcaTemAutoritativo(desc) && chassi.length === 17) {
        autoritativo = await consultarRecallAutoritativo({
          placa: pedido.placa, chassi, marca: normalizarMarcaRecall(desc.split('/')[0]), modelo: normalizarMarcaRecall(desc),
          ano: bruto?.anoModelo ?? bruto?.anoFabricacao ?? null,
          ano_fab: bruto?.anoFabricacao ?? null, ano_mod: bruto?.anoModelo ?? null,
        })
      }

      // O scrape SENATRAN/local (browser) so e PULADO quando a GM CONFIRMOU
      // recall aberto (ai temos as campanhas dela, nao precisa do scrape). Nos
      // outros casos (nao-Chevrolet, GM nao respondeu, ou GM consultou e disse
      // que NAO ha aberto mas o SENATRAN marcou pendente) faz o scrape de sempre,
      // pra o card ter o detalhe SENATRAN e nao ficar "buscando" pra sempre.
      let detalhe: Awaited<ReturnType<typeof buscarRecallDetalhe>> = null
      if (!autoritativo?.tem_recall_aberto) {
        detalhe = await buscarRecallDetalhe(supabase, { placa: pedido.placa, consultaId })
      }
      if (!detalhe && !autoritativo?.consultado) return

      const patch: any = { ...snap }
      if (detalhe) patch.recall = detalhe
      if (autoritativo?.consultado) patch.recallAutoritativo = autoritativo

      // Camada 2: se a FIPE ficou AMBIGUA (empate de cambio) e o recall (scrape)
      // diz o cambio, re-roda SO a FIPE com esse contexto no mesmo write. So com
      // o scrape (o autoritativo nao traz texto de cambio). Fail-open.
      if (detalhe) {
        const refinado = await refinarValorCustoPeloRecall(
          supabase,
          snap,
          { placa: pedido.placa, plano: pedido.plano, consulta_id: consultaId, preview: pedido.preview, token: pedido.token_entrega ?? null },
          detalhe,
        )
        if (refinado) patch.valorCusto = refinado
      }

      // Rele o snapshot ANTES de gravar e aplica so os campos do recall: o
      // scrape leva minutos e o bloco do DETRAN (multas) pode ter chegado no
      // meio. Espalhar o snapshot lido no inicio apagaria as multas.
      const { data: fresco } = await supabase
        .from('pedidos_premium')
        .select('relatorio_snapshot')
        .eq('id', pedido.id)
        .maybeSingle()
      const base = fresco?.relatorio_snapshot && typeof fresco.relatorio_snapshot === 'object' ? fresco.relatorio_snapshot : snap
      const final: any = { ...base }
      for (const k of ['recall', 'recallAutoritativo', 'valorCusto'] as const) if (k in patch && patch[k] !== (snap as any)[k]) final[k] = patch[k]
      await supabase
        .from('pedidos_premium')
        .update({ relatorio_snapshot: final })
        .eq('id', pedido.id)
    } catch { /* entrega ja feita: aqui so se ganha, nunca se perde */ }
  })
}

/**
 * Busca de multas e restricoes no orgao de transito estadual, depois da
 * entrega. Igual ao recall: roda solta, atualiza SO o campo `multas` dentro do
 * snapshot ja gravado e nunca vira erro pra quem comprou. Renavam e UF saem da
 * propria resposta paga (o portal pede placa + renavam).
 */
export function completarMultasDepois(
  supabase: any,
  pedido: { id: string; placa: string },
  ctx: { consultaId: string | null; response: any },
): void {
  void emVoo('multas', async () => {
    try {
      const renavam = renavamDaResposta(ctx.response)
      if (!renavam) return
      const detalhe = await buscarMultasDetalhe(supabase, {
        placa: pedido.placa,
        renavam,
        uf: ufDaResposta(ctx.response),
        consultaId: ctx.consultaId,
      })
      if (!detalhe) return
      const { data } = await supabase
        .from('pedidos_premium')
        .select('relatorio_snapshot')
        .eq('id', pedido.id)
        .maybeSingle()
      const snap = data?.relatorio_snapshot
      if (!snap || typeof snap !== 'object') return
      await supabase
        .from('pedidos_premium')
        .update({ relatorio_snapshot: { ...snap, multas: detalhe } })
        .eq('id', pedido.id)
    } catch { /* entrega ja feita: aqui so se ganha, nunca se perde */ }
  })
}

function valorEmReais(centavos?: number | null): string {
  if (!centavos) return 'nao informado'
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`
}

/** Nunca o e-mail inteiro no alerta: ele circula por e-mail e fica em caixa. */
function mascararEmail(email?: string | null): string {
  if (!email) return 'sem e-mail'
  const [antes, dominio] = email.split('@')
  if (!dominio) return 'invalido'
  return `${antes.slice(0, 3)}${antes.length > 3 ? '***' : ''}@${dominio}`
}

function origemDoPedido(p: { gclid?: string | null; msclkid?: string | null; utm_source?: string | null; utm_campaign?: string | null }): string {
  if (p.gclid) return `Google Ads${p.utm_campaign ? ' / ' + p.utm_campaign : ''}`
  if (p.msclkid) return `Bing Ads${p.utm_campaign ? ' / ' + p.utm_campaign : ''}`
  if (p.utm_source) return `${p.utm_source}${p.utm_campaign ? ' / ' + p.utm_campaign : ''}`
  return 'organico'
}

/**
 * Em qual etapa a consulta morreu. Sai do proprio trace quando ele existe: e a
 * primeira pergunta de quem le o alerta, e sem isso a resposta exige abrir o
 * banco.
 */
function etapaDaFalha(e: any): string {
  const trace = Array.isArray(e?.trace) ? e.trace : []
  const ultima = [...trace].reverse().find((t: any) => t?.erro || t?.ok === false)
  return ultima?.etapa || 'desconhecida'
}

// Exportados so pra teste: sao as quatro linhas do alerta de estorno, e cada
// uma ja poderia ter saido errada (valor em centavos, e-mail inteiro, origem
// vazia, etapa inventada).
export const _valorEmReais = valorEmReais
export const _mascararEmail = mascararEmail
export const _origemDoPedido = origemDoPedido
export const _etapaDaFalha = etapaDaFalha

export async function processarPedidoPago(
  supabase: any,
  pedido: {
    id: string; placa: string; email: string | null; token_entrega: string
    abacatepay_id: string | null
    /** Qual adquirente criou a cobranca. Sem isso, o estorno bate na porta errada. */
    pix_provider?: string | null
    /** 'pix' (default) | 'cartao'. Decide por onde sai o estorno na falha. */
    forma_pagamento?: string | null
    /** Sessao do Stripe (cartao): o estorno bate na Stripe por ela, nao no Pix. */
    stripe_session_id?: string | null
    /** Pedido do app: o estorno e manual, no Play Console. Vai no alerta. */
    google_play_order_id?: string | null
    /** So pro alerta de estorno: quanto entrou e saiu. */
    valor_centavos?: number | null
    /** Idem: de onde veio a venda perdida (gclid/msclkid/utm). */
    gclid?: string | null
    msclkid?: string | null
    utm_source?: string | null
    utm_campaign?: string | null
    // usado no assunto e no corpo do e-mail de entrega
    plano?: string | null
    // controle de teste: 'producao' dispara consulta real; ausente => 'homolog'
    ambiente?: string | null
    // preview salvo no checkout (uf/municipio do veiculo) — usado so pra
    // montar o snapshot do relatorio (valorCusto). Opcional: quando ausente
    // (chamadores antigos/parciais), o snapshot ainda grava, so sem
    // uf/municipio (getValorCusto cai pro fallback dele).
    preview?: any
  },
): Promise<void> {
  // Defesa em profundidade: o checkout ja decidiu o ambiente, mas um pedido
  // antigo (ou gravado antes da trava) com 'producao' no homolog nao compra
  // hash real sem a env ligada. Em prod o pedido sempre vem 'producao'.
  const ambiente = ambienteDaConsultaPaga(pedido.ambiente === 'producao' ? 'producao' : 'homolog', useRuntimeConfig())
  const { data: claimed } = await supabase
    .from('pedidos_premium')
    .update({ status: 'consultando', pago_em: new Date().toISOString() })
    .eq('id', pedido.id)
    .in('status', ['aguardando_pagamento', 'pago'])
    .select()
  if (!claimed || !claimed.length) return // ja reivindicado/processado

  try {
    let r
    // Placa equivalente que a consulta gratis ja tinha visto: entra como plano
    // B quando o registro responde "nao encontrado" para o formato pedido.
    const placaAlternativa = pedido.preview?.placaAlternativa
      || pedido.preview?.raw?.placaAlternativa
      || null
    try {
      r = await consultarSenatran(pedido.placa, ambiente, { placaAlternativa, pedidoId: pedido.id })
    } catch (e: any) {
      // Ultima chance antes do estorno, e so pra falha de REDE. A pessoa esta
      // na tela esperando: um minuto a mais e melhor que um estorno, e a
      // oscilacao que causou o incidente durou segundos. Falha de negocio cai
      // direto, porque esperar nao muda resposta de quem ja respondeu.
      if (!ehErroDeRede(e)) throw e
      console.warn('[premium] consulta caiu por rede; ultima tentativa em 60s. pedido=', pedido.id)
      await esperar(60000)
      r = await consultarSenatran(pedido.placa, ambiente, { placaAlternativa, pedidoId: pedido.id })
    }
    await supabase
      .from('pedidos_premium')
      .update({
        status: 'entregue', entregue_em: new Date().toISOString(), consulta_id: r.consultaId, debug_trace: r.trace,
        // Qual placa o registro realmente respondeu. Quando os dois formatos
        // existem, so isto explica por que o relatorio traz uma placa
        // diferente da que a pessoa digitou.
        placa_consultada: r.placaConsultada,
      })
      .eq('id', pedido.id)

    // Aviso da venda ao Cesar na hora (server/utils/aviso-venda.ts). Sem
    // await: nunca atrasa nem quebra a entrega; dedup no banco com o timer.
    void emVoo('aviso-venda', () => avisarVenda(supabase, pedido.id))

    // Snapshot imutavel: monta o payload agregado (consulta filtrada por
    // plano + valorCusto + chassiOrigem + camposRestantes) UMA VEZ, aqui na
    // entrega, pra report.get nunca mais precisar refazer chamadas externas
    // (vin-decoder/FIPE/seguro) nas visualizacoes seguintes. Fail-safe: se a
    // gravacao falhar, so loga — report.get tem fallback lazy que monta e
    // grava na 1a visualizacao caso o snapshot ainda nao exista.
    try {
      const snapshot = await montarRelatorioSnapshot(supabase, {
        placa: pedido.placa,
        plano: pedido.plano || 'completa',
        consulta_id: r.consultaId,
        preview: pedido.preview,
        token: pedido.token_entrega,
      })
      await supabase
        .from('pedidos_premium')
        .update({ relatorio_snapshot: snapshot, snapshot_em: new Date().toISOString() })
        .eq('id', pedido.id)
    } catch (snapErr: any) {
      if (import.meta.dev) console.warn('[premium] snapshot falhou na entrega, fallback lazy cobre depois:', snapErr?.message || snapErr)
    }

    // Recall pendente: o registro so diz que existe, e quem pagou quer saber
    // de QUAL campanha se trata. A busca roda SOLTA, depois da entrega: o
    // e-mail leva o link, nao o conteudo, entao nao ha motivo pra segurar a
    // entrega por causa dela. Quando a resposta chega, ela entra no snapshot e
    // a propria pagina, que fica olhando por alguns minutos, mostra o bloco.
    if (temRecallPendente(r?.response)) completarRecallDepois(supabase, pedido, r.consultaId)

    // Nissan/Mitsubishi com chassi cheio: consulta da montadora por chassi (status
    // por campanha: aberto/realizado, data, concessionaria, km). Pra TODO veiculo da marca,
    // sem depender da flag de recall (decisao do Cesar, 01/out). Solta e fail-open.
    completarRecallMontadoraDepois(supabase, pedido, r.response)

    // DETRAN-SP (multas + hodometro + IPVA + licenciamento + restricoes) via
    // Infosimples, substituindo o runner gov.br quebrado. Gated: SEMPRE pra
    // veiculo registrado em SP (UF do SENATRAN), sem depender do indicador de
    // multa RENAINF. Busca solta depois da entrega (1 chamada por pedido, custo
    // gravado ate em erro), entra no snapshot e a pagina mostra o bloco quando
    // chega. Fail-open: timeout/erro so omite o bloco. completarDetranDepois se
    // auto-restringe a SP; pra outras UFs nao ha chamada ate os endpoints delas.
    completarDetranDepois(supabase, pedido, { consultaId: r.consultaId, response: r.response })

    // Detalhe do RENAJUD (tribunal, processo, tipo, data) onde ha fonte (AL e
    // GO), so com o indicador aceso. Solto e fail-open (server/utils/renajud-detalhe.ts).
    completarRenajudDepois(supabase, pedido, { response: r.response })

    // Placa e plano entram no assunto e no corpo: "seu relatorio completo da
    // placa ABC1D23 esta pronto" e reconhecivel na caixa de entrada, "sua
    // consulta esta pronta" nao.
    // Cupom de recompra (20%, 7 dias, uso livre): gerado aqui, na entrega, pra
    // ir no e-mail e na faixa do relatorio. Fail-open: sem cupom, segue igual.
    const cupom = await gerarCupomRecompra(supabase, pedido).catch(() => null)
    const emailOk = await enviarRelatorioEmail({
      email: pedido.email,
      token: pedido.token_entrega,
      plano: pedido.plano,
      placa: pedido.placa,
      cupom,
    })
    // A consulta e a entrega DERAM CERTO mesmo se o e-mail falhar (o pedido
    // fica 'entregue' de verdade, a pessoa acessa pelo link/historico) — nao
    // e caso de 'falha'/reembolso. Mas sem alerta ninguem no time saberia que
    // essa entrega especifica nao chegou na caixa de entrada de quem pagou.
    // Pedido sem e-mail nao e falha de envio: desde que o e-mail saiu da frente
    // do Pix, existe pedido que nasce sem ele de proposito (a pessoa paga
    // primeiro e informa depois, ou nunca informa e le o relatorio na propria
    // tela). Alertar nesse caso encheria a caixa do time de alarme falso e
    // enterraria a falha de verdade.
    if (!emailOk && pedido.email) {
      await sendErrorEmail({
        endpoint: '/premium/processar',
        errorMessage: `Entrega OK mas e-mail de entrega FALHOU. pedido=${pedido.id} placa=${pedido.placa} email=${pedido.email} token=${pedido.token_entrega}`,
      })
    }
  } catch (e: any) {
    const motivo = String(e?.message || e)
    await supabase.from('pedidos_premium').update({ status: 'falha', erro: motivo, debug_trace: (e as any)?.trace ?? null }).eq('id', pedido.id)

    // Compra feita no app, cobrada pelo Google Play: nao existe estorno
    // automatico nosso pra pedir. O dinheiro esta na loja, e o reembolso sai
    // do Play Console, na mao. Chamar AbacatePay/Woovi aqui bateria na porta
    // errada e, pior, poderia estornar a cobranca Pix de outro pedido.
    // O status 'falha_google_play' separa esses casos na hora de procurar o
    // que ainda deve devolucao.
    if (pedido.pix_provider === 'google_play') {
      await supabase.from('pedidos_premium')
        .update({ status: 'falha_google_play' })
        .eq('id', pedido.id)
      await sendErrorEmail({
        endpoint: '/premium/processar',
        errorMessage: [
          'COMPRA NO APP (Google Play) PAGA e CONSULTA FALHOU. O ESTORNO PRECISA SER FEITO NA MAO no Play Console.',
          `pedido=${pedido.id}`,
          `placa=${pedido.placa}`,
          `token=${pedido.token_entrega}`,
          `valor=${valorEmReais(pedido.valor_centavos)}`,
          `origem=${origemDoPedido(pedido)}`,
          `email=${mascararEmail(pedido.email)}`,
          `etapa=${etapaDaFalha(e)}`,
          `erro=${motivo}`,
          `google_play_order_id=${(pedido as any).google_play_order_id || 'nao informado'}`,
        ].join(' | '),
        paraTambem: [AVISO_ESTORNO],
      })
      return
    }

    // Estorno automatico: pelo Stripe se a venda foi no cartao (nao tem
    // abacatepay_id; o refund bate na Stripe pelo payment_intent da sessao),
    // senao pelo provedor do Pix. Mesma filosofia dos dois: o cliente pagou, a
    // consulta falhou, o dinheiro volta sozinho.
    const reembolso = pedido.forma_pagamento === 'cartao'
      ? (pedido.stripe_session_id
          ? await reembolsarStripe(pedido.stripe_session_id, pedido.id)
          : { ok: false, error: 'pedido sem sessao stripe' })
      : (pedido.abacatepay_id
          ? await provedorDoPedido(pedido.pix_provider).reembolsarPix(pedido.abacatepay_id)
          : { ok: false, error: 'pedido sem cobranca' })
    if (reembolso.ok) {
      // O status 'reembolsado' e o que a tela usa pra dizer que o dinheiro
      // voltou. Ele ja falhou em producao (pedido de UDS2J40 ficou em 'falha'
      // com o estorno feito), entao aqui a gravacao e conferida: sem isso, a
      // pessoa ve "nao foi possivel concluir" sem saber que foi estornada, e o
      // time acha que o estorno nao aconteceu.
      const { error: erroUpdate } = await supabase
        .from('pedidos_premium')
        .update({ status: 'reembolsado' })
        .eq('id', pedido.id)
        .select('id')
      if (erroUpdate) {
        await sendErrorEmail({
          endpoint: '/premium/processar',
          errorMessage: `ESTORNO FEITO mas o status NAO gravou. pedido=${pedido.id} placa=${pedido.placa} erro_update=${erroUpdate.message}`,
          paraTambem: [AVISO_ESTORNO],
        })
      }
      // Ordem do Cesar: avisar SEMPRE que houver estorno automatico, nao so
      // quando o estorno falha. Cada um destes e uma venda que entrou e saiu, e
      // ele quer ver na hora, nao no fechamento do mes.
      await sendErrorEmail({
        endpoint: '/premium/processar',
        errorMessage: [
          'ESTORNO AUTOMATICO (o cliente pagou e a consulta falhou).',
          `pedido=${pedido.id}`,
          `placa=${pedido.placa}`,
          // O token e o que abre a pagina do comprador: sem ele, checar o caso
          // vira busca no banco.
          `token=${pedido.token_entrega}`,
          `valor=${valorEmReais(pedido.valor_centavos)}`,
          `origem=${origemDoPedido(pedido)}`,
          `email=${mascararEmail(pedido.email)}`,
          `etapa=${etapaDaFalha(e)}`,
          `erro=${motivo}`,
        ].join(' | '),
        paraTambem: [AVISO_ESTORNO],
      })
    } else {
      // Reembolso NAO aconteceu: guarda o motivo no pedido e alerta. O status
      // fica 'falha' (a UI nao promete estorno que nao ocorreu). O erro tipico
      // (INSUFFICIENT_FUNDS) e transitorio: da pra reprocessar quando o saldo
      // liberar (ver server/api/premium/reembolsar).
      await supabase.from('pedidos_premium')
        .update({ erro: `${String(e?.message || e)} | reembolso: ${reembolso.error}` })
        .eq('id', pedido.id)
      await sendErrorEmail({
        endpoint: '/premium/processar',
        errorMessage: `PAGO, CONSULTA FALHOU e REEMBOLSO FALHOU. pedido=${pedido.id} placa=${pedido.placa} token=${pedido.token_entrega} valor=${valorEmReais(pedido.valor_centavos)} origem=${origemDoPedido(pedido)} email=${mascararEmail(pedido.email)} meio=${pedido.forma_pagamento === 'cartao' ? 'cartao' : 'pix'} charge=${pedido.abacatepay_id || pedido.stripe_session_id} etapa=${etapaDaFalha(e)} consulta_erro=${motivo} reembolso_erro=${reembolso.error}`,
        paraTambem: [AVISO_ESTORNO],
      })
    }

    // E-mail pro CLIENTE quando o estorno automatico deu certo. Fail-open e
    // transacional (Resend): erro no envio nao muda status nem derruba o fluxo,
    // so loga. So dispara com reembolso OK + pedido com e-mail — nunca quando o
    // estorno falhou (a UI/tela nao promete o que nao ocorreu) nem sem e-mail.
    if (deveAvisarClienteEstorno(reembolso.ok, pedido.email)) {
      await enviarEstornoEmail({
        email: pedido.email as string,
        placa: pedido.placa,
        valorCentavos: pedido.valor_centavos ?? null,
        // Muda so a frase do prazo (cartao 10 dias uteis x Pix na hora). Em main
        // (so Pix) o campo nao existe -> undefined -> Pix, comportamento correto.
        formaPagamento: (pedido as any).forma_pagamento ?? null,
      })
    }
  }
}
