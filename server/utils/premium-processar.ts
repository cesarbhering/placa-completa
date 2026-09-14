// Processa um pedido PAGO: dispara a consulta SENATRAN uma vez, entrega ou
// reembolsa. Usado pelo WEBHOOK e pelo POLLING de status (o que chegar primeiro).
// Trava atomica via update condicional (status aguardando/pago -> consultando):
// so um processo "reivindica" o pedido; os outros saem.
// O Cesar quer ver todo estorno automatico na hora. A caixa de erros do time
// continua recebendo; este e o endereco extra.
const AVISO_ESTORNO = 'cesarcbhering@gmail.com'

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
  const ambiente = pedido.ambiente === 'producao' ? 'producao' : 'homolog'
  const { data: claimed } = await supabase
    .from('pedidos_premium')
    .update({ status: 'consultando', pago_em: new Date().toISOString() })
    .eq('id', pedido.id)
    .in('status', ['aguardando_pagamento', 'pago'])
    .select()
  if (!claimed || !claimed.length) return // ja reivindicado/processado

  try {
    let r
    try {
      r = await consultarSenatran(pedido.placa, ambiente)
    } catch (e: any) {
      // Ultima chance antes do estorno, e so pra falha de REDE. A pessoa esta
      // na tela esperando: um minuto a mais e melhor que um estorno, e a
      // oscilacao que causou o incidente durou segundos. Falha de negocio cai
      // direto, porque esperar nao muda resposta de quem ja respondeu.
      if (!ehErroDeRede(e)) throw e
      console.warn('[premium] consulta caiu por rede; ultima tentativa em 60s. pedido=', pedido.id)
      await esperar(60000)
      r = await consultarSenatran(pedido.placa, ambiente)
    }
    await supabase
      .from('pedidos_premium')
      .update({ status: 'entregue', entregue_em: new Date().toISOString(), consulta_id: r.consultaId, debug_trace: r.trace })
      .eq('id', pedido.id)

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
      })
      await supabase
        .from('pedidos_premium')
        .update({ relatorio_snapshot: snapshot, snapshot_em: new Date().toISOString() })
        .eq('id', pedido.id)
    } catch (snapErr: any) {
      if (import.meta.dev) console.warn('[premium] snapshot falhou na entrega, fallback lazy cobre depois:', snapErr?.message || snapErr)
    }

    // Placa e plano entram no assunto e no corpo: "seu relatorio completo da
    // placa ABC1D23 esta pronto" e reconhecivel na caixa de entrada, "sua
    // consulta esta pronta" nao.
    const emailOk = await enviarRelatorioEmail({
      email: pedido.email,
      token: pedido.token_entrega,
      plano: pedido.plano,
      placa: pedido.placa,
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
    const reembolso = pedido.abacatepay_id
      ? await provedorDoPedido(pedido.pix_provider).reembolsarPix(pedido.abacatepay_id)
      : { ok: false, error: 'pedido sem cobranca' }
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
        errorMessage: `PAGO, CONSULTA FALHOU e REEMBOLSO FALHOU. pedido=${pedido.id} placa=${pedido.placa} valor=${valorEmReais(pedido.valor_centavos)} origem=${origemDoPedido(pedido)} email=${mascararEmail(pedido.email)} charge=${pedido.abacatepay_id} etapa=${etapaDaFalha(e)} consulta_erro=${motivo} reembolso_erro=${reembolso.error}`,
        paraTambem: [AVISO_ESTORNO],
      })
    }
  }
}
