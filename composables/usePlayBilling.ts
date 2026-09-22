/**
 * Ponte com o Google Play Billing, que quem implementa e a camada nativa do
 * app (Capacitor). O site nao fala com a loja: ele pede a compra pro app e
 * recebe de volta o comprovante, que o servidor confere com a Google.
 *
 * Isolado num composable de proposito. O contrato abaixo e o combinado
 * provisorio com o app; quando o plugin real chegar, muda AQUI e nem o
 * checkout nem o endpoint precisam saber.
 *
 *   window.PlacaCompletaBilling.purchase('consulta_completa', 'ABC1D23')
 *     -> { purchaseToken, orderId, productId }
 *
 * A placa vai junto porque o app v5 a grava nativamente ANTES de abrir a folha
 * do Play: se a pessoa fechar o app no meio, a compra paga nao fica orfa e o
 * app sabe qual relatorio restaurar. No v4 o argumento extra e ignorado, entao
 * o site pode mandar sempre.
 *
 * Erro e cancelamento viram exception, porque desistir da compra e cancelar,
 * nao falhar: quem chama diferencia pelo campo `cancelado`.
 */

export const PRODUTO_COMPLETA = 'consulta_completa'

export interface CompraPlay {
  purchaseToken: string
  orderId?: string | null
  productId: string
}

export interface ErroBilling extends Error {
  cancelado?: boolean
}

declare global {
  interface Window {
    PlacaCompletaBilling?: {
      purchase: (productId: string, placa?: string) => Promise<CompraPlay>
    }
  }
}

export const usePlayBilling = () => {
  /**
   * A ponte existe? Sem ela nao ha como cobrar dentro do app.
   *
   * `typeof window` e nao `import.meta.client` pelo mesmo motivo do
   * useAnalytics: a checagem precisa valer fora do build do Nuxt (teste
   * unitario), e o efeito e identico, ja que no servidor nao existe window.
   */
  const disponivel = () => typeof window !== 'undefined' && typeof window.PlacaCompletaBilling?.purchase === 'function'

  async function comprar(placa?: string, productId: string = PRODUTO_COMPLETA): Promise<CompraPlay> {
    if (!disponivel()) {
      const e = new Error('billing indisponivel') as ErroBilling
      throw e
    }
    const r = await window.PlacaCompletaBilling!.purchase(productId, placa)
    if (!r?.purchaseToken) {
      const e = new Error('compra sem comprovante') as ErroBilling
      throw e
    }
    return { purchaseToken: r.purchaseToken, orderId: r.orderId ?? null, productId: r.productId || productId }
  }

  /**
   * O app sinaliza desistencia com um erro marcado. Sem isto, fechar a tela da
   * loja apareceria pra pessoa como "deu erro na compra".
   */
  function foiCancelado(e: any): boolean {
    return !!e?.cancelado || /cancel/i.test(String(e?.code || e?.message || ''))
  }

  return { disponivel, comprar, foiCancelado }
}
