import { PLANOS, isPlanoPago } from '~/shared/planos'

/**
 * Composable para tracking de eventos com Google Analytics
 *
 * Fornece wrapper para envio de eventos ao GA4 via gtag
 *
 * @returns {Object} Objeto com função de tracking
 */
// Tokens que ja reportaram conversao NESTA aba. Fica fora do composable de
// proposito: cada chamada de useAnalytics cria um escopo novo, e o modal, a
// pagina do checkout e a do relatorio chamam cada um o seu.
const conversoesReportadas = new Set<string>()

/**
 * Decide se a conversao deste token ainda precisa ser reportada, e ja marca
 * que foi. Chamar DUAS vezes com o mesmo token devolve true so na primeira.
 *
 * Tres camadas, da mais forte pra mais fraca:
 * 1) memoria do processo, que pega o poll chamando em rajada dentro da mesma
 *    sessao mesmo quando o storage lanca (modo privado, cookies bloqueados) —
 *    antes disso, storage indisponivel significava conversao repetida a cada
 *    tick do poll;
 * 2) localStorage, que sobrevive ao reload e a revisita do relatorio;
 * 3) sessionStorage, rede de seguranca pra quando o localStorage esta cheio
 *    ou particionado mas o de sessao funciona.
 *
 * Exportada pra ser testavel sem gtag: e a regra que impede a mesma compra de
 * virar duas conversoes no Ads.
 */
export function reivindicarConversao(token: string): boolean {
  if (!token) return false
  if (conversoesReportadas.has(token)) return false
  conversoesReportadas.add(token)
  const key = 'pc_conv_' + token
  let jaFoi = false
  try { jaFoi = !!globalThis.localStorage?.getItem(key) } catch { /* storage indisponivel */ }
  if (!jaFoi) {
    try { jaFoi = !!globalThis.sessionStorage?.getItem(key) } catch { /* idem */ }
  }
  if (jaFoi) return false
  try { globalThis.localStorage?.setItem(key, '1') } catch { /* modo privado */ }
  try { globalThis.sessionStorage?.setItem(key, '1') } catch { /* idem */ }
  return true
}

/** So pra teste: esquece o que ja foi reportado nesta sessao. */
export function _limparConversoesReportadas() {
  conversoesReportadas.clear()
}

/**
 * Os quatro momentos que o remarketing precisa distinguir, traduzidos pros
 * nomes que a Meta entende. Evento fora deste mapa nao vai pro pixel: lista de
 * publico se faz com etapa de funil, nao com todo clique do site.
 */
export const EVENTOS_META: Record<string, string> = {
  consulta_success: 'Search',
  premium_checkout_open: 'InitiateCheckout',
  pix_gerado: 'AddPaymentInfo',
  purchase: 'Purchase',
}

export const useAnalytics = () => {
  /**
   * Envia evento para o Google Analytics
   *
   * Verifica se está no client-side e se gtag está disponível
   * antes de enviar o evento
   *
   * @param {string} event - Nome do evento a ser rastreado
   * @param {Record<string, any>} [params] - Parâmetros adicionais do evento
   *
   * @example
   * track('form_submit', { form_name: 'plate_consultation' })
   * track('button_click')
   */
  const track = (event: string, params?: Record<string, any>) => {
    if (import.meta.client && window.gtag) {
      window.gtag('event', event, params)
    }
    espelharNaMeta(event, params)
  }

  /**
   * Espelha no Pixel da Meta os quatro momentos que o remarketing precisa
   * distinguir. A Meta so entende os nomes dela, entao o mapa traduz; evento
   * fora do mapa nao vai, porque lista de publico se faz com etapa de funil,
   * nao com todo clique do site.
   *
   * Nada de identificavel atravessa: placa, chassi, e-mail, telefone e token
   * ficam de fora, so o valor e a moeda passam.
   */
  const espelharNaMeta = (event: string, params?: Record<string, any>) => {
    if (!import.meta.client) return
    const nome = EVENTOS_META[event]
    const fbq = (window as any).fbq
    if (!nome || typeof fbq !== 'function') return
    const dados: Record<string, any> = {}
    if (typeof params?.value === 'number') {
      dados.value = params.value
      dados.currency = 'BRL'
    }
    fbq('track', nome, dados)
  }

  /**
   * Restricao do relatorio que caiu no texto generico por nao ter copy
   * propria. Manda SO o codigo do tipo (ex: RESTRICAO_ADMINISTRATIVA_X),
   * nunca placa/chassi/token: serve pra saber quais tipos ainda faltam no
   * dicionario de explicacoes.
   */
  const trackRestricaoDesconhecida = (tipo: string) => {
    track('restricao_sem_copy', { tipo_restricao: tipo })
  }

  // Google Ads: acao de conversao "Consulta paga (Pix)", BRL.
  const AW_SEND_TO = 'AW-18330779331/KeCcCOXO7OMcEMP95aRE'

  /**
   * Resolve valor/item do plano a partir da fonte unica (shared/planos.ts).
   * O valor de conversao TEM que ser o preco real do plano (basica R$25,00,
   * completa R$39,90): o Ads otimiza os lances por esse numero, entao um valor
   * fixo pra todo mundo distorcia a otimizacao. `value` vai em reais.
   * Plano ausente/invalido cai em 'completa' (default historico do checkout).
   */
  const infoPlano = (plano?: string) => {
    const id = isPlanoPago(plano) ? plano : 'completa'
    const p = PLANOS[id]
    const value = p.valorCentavos / 100
    return {
      value,
      item: { item_id: `plano-${id}`, item_name: p.nome, price: value, quantity: 1 },
    }
  }

  /**
   * Clique no botao que gera a cobranca, disparado ANTES do POST do checkout.
   * Sem ele o funil do GA4 pulava de "abriu o modal" pra "pagou", entao a
   * tela de confirmacao, que e onde mais gente desiste, nao era mensuravel.
   * Nome padrao do funil de e-commerce do GA4, pros relatorios prontos
   * funcionarem sem configuracao.
   */
  const trackAddPaymentInfo = (plano?: string, placa?: string, valorCentavos?: number) => {
    const { value: valorTabela, item } = infoPlano(plano)
    const value = valorCentavos != null ? valorCentavos / 100 : valorTabela
    track('add_payment_info', {
      currency: 'BRL',
      value,
      payment_type: 'Pix',
      items: [{ ...item, price: value }],
      placa,
    })
  }

  /**
   * Cobranca Pix criada de verdade (resposta do checkout com brCode na mao).
   * add_payment_info marca a INTENCAO, antes da chamada; este marca o
   * resultado. A diferenca entre os dois e exatamente a taxa que o e-mail
   * fora da frente do Pix deveria melhorar, e sem os dois eventos ela so
   * existiria no banco, sem quebra por campanha ou dispositivo.
   */
  const trackPixGerado = (plano?: string, placa?: string, valorCentavos?: number, comEmail?: boolean) => {
    const { value: valorTabela, item } = infoPlano(plano)
    const value = valorCentavos != null ? valorCentavos / 100 : valorTabela
    track('pix_gerado', {
      currency: 'BRL',
      value,
      items: [{ ...item, price: value }],
      placa,
      // Permite comparar quem chegou ao Pix ja com e-mail e quem deixou pra
      // depois, que e a pergunta de produto por tras da mudanca.
      com_email: comEmail ? 'sim' : 'nao',
    })
  }

  /** Inicio do checkout pago (clique no CTA de pagar). Valor real por plano. */
  const trackBeginCheckout = (plano?: string, placa?: string) => {
    const { value, item } = infoPlano(plano)
    track('begin_checkout', { currency: 'BRL', value, items: [item], placa })
  }

  /**
   * Conversao do relatorio pago. Dispara UMA vez por pedido (token), quando o
   * pagamento e confirmado. Envia a conversao do Google Ads + o purchase do GA4
   * (receita/ecommerce e importacao) E o purchase do Bing UET (teste
   * head-to-head Google vs Bing). Idempotente via localStorage, MESMA chave
   * pros dois — uma unica gravacao cobre ambos, revisita nao duplica nenhum.
   * O `value` e o preco real do plano; o send_to do Ads segue inalterado.
   */
  /**
   * `valorPagoCentavos` sobrescreve o preco de tabela quando o que a pessoa
   * pagou de verdade e diferente (cupom): sem isso, um resgate GRATIS
   * reportaria o preco cheio do plano pro Ads/GA4, inflando ROAS com receita
   * que nunca existiu.
   */
  const trackConversionPaga = (token?: string, plano?: string, valorPagoCentavos?: number) => {
    if (!import.meta.client || !token) return
    if (!reivindicarConversao(token)) return
    const { value: valorTabela, item } = infoPlano(plano)
    const value = valorPagoCentavos != null ? valorPagoCentavos / 100 : valorTabela
    if (window.gtag) {
      window.gtag('event', 'conversion', { send_to: AW_SEND_TO, value, currency: 'BRL', transaction_id: token })
      window.gtag('event', 'purchase', { transaction_id: token, value, currency: 'BRL', items: [{ ...item, price: value }] })
    }
    if (window.uetq) {
      window.uetq.push('event', 'purchase', { revenue_value: value, currency: 'BRL' })
    }
    // A compra nao passa pelo track() (ela fala direto com gtag e uetq, por
    // causa da dedupe por token), entao o espelho da Meta e chamado a mao aqui.
    espelharNaMeta('purchase', { value })
  }

  return {
    track,
    trackBeginCheckout,
    trackAddPaymentInfo,
    trackPixGerado,
    trackConversionPaga,
    trackRestricaoDesconhecida,
  }
}
