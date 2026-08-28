import { PLANOS, isPlanoPago } from '~/shared/planos'

/**
 * Composable para tracking de eventos com Google Analytics
 *
 * Fornece wrapper para envio de eventos ao GA4 via gtag
 *
 * @returns {Object} Objeto com função de tracking
 */
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
  }

  // Google Ads: acao de conversao "Consulta paga (Pix)", BRL.
  const AW_SEND_TO = 'AW-18330779331/KeCcCOXO7OMcEMP95aRE'

  /**
   * Resolve valor/item do plano a partir da fonte unica (shared/planos.ts).
   * O valor de conversao TEM que ser o preco real do plano (basica R$19,90,
   * completa R$44,90): o Ads otimiza os lances por esse numero, entao um R$45
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
    const key = 'pc_conv_' + token
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch { /* modo privado: segue (pode duplicar, aceitavel) */ }
    const { value: valorTabela, item } = infoPlano(plano)
    const value = valorPagoCentavos != null ? valorPagoCentavos / 100 : valorTabela
    if (window.gtag) {
      window.gtag('event', 'conversion', { send_to: AW_SEND_TO, value, currency: 'BRL', transaction_id: token })
      window.gtag('event', 'purchase', { transaction_id: token, value, currency: 'BRL', items: [{ ...item, price: value }] })
    }
    if (window.uetq) {
      window.uetq.push('event', 'purchase', { revenue_value: value, currency: 'BRL' })
    }
  }

  return {
    track,
    trackBeginCheckout,
    trackConversionPaga,
  }
}
