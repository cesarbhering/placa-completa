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

  return {
    track,
  }
}
