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

  // Google Ads: acao de conversao "Consulta paga (Pix)" (R$ 45, BRL).
  const AW_SEND_TO = 'AW-18330779331/KeCcCOXO7OMcEMP95aRE'
  const VALOR = 45
  const ITEM = { item_id: 'relatorio_premium', item_name: 'Relatorio veicular completo', price: VALOR, quantity: 1 }

  /** Inicio do checkout pago (clique no CTA "Ver relatorio R$ 45"). */
  const trackBeginCheckout = (placa?: string) => {
    track('begin_checkout', { currency: 'BRL', value: VALOR, items: [ITEM], placa })
  }

  /**
   * Conversao do relatorio pago. Dispara UMA vez por pedido (token), quando o
   * pagamento e confirmado. Envia a conversao do Google Ads + o purchase do GA4
   * (receita/ecommerce e importacao). Idempotente via localStorage.
   */
  const trackConversionPaga = (token?: string) => {
    if (!import.meta.client || !window.gtag || !token) return
    const key = 'pc_conv_' + token
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch { /* modo privado: segue (pode duplicar, aceitavel) */ }
    window.gtag('event', 'conversion', { send_to: AW_SEND_TO, value: VALOR, currency: 'BRL', transaction_id: token })
    window.gtag('event', 'purchase', { transaction_id: token, value: VALOR, currency: 'BRL', items: [ITEM] })
  }

  return {
    track,
    trackBeginCheckout,
    trackConversionPaga,
  }
}
