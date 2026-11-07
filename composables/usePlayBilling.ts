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
 * O segundo argumento vira o obfuscatedExternalAccountId da compra e o app v5
 * o grava nativamente ANTES de abrir a folha do Play. Desde nov/2026 o checkout
 * manda o id da intencao (shared/intencao-play.ts), nao a placa: o servidor
 * acha placa e e-mail por ele mesmo se o app morrer depois de pagar, e o site
 * traduz o id de volta pra placa (placaLimpa em useRecuperacaoPlay). No v4 o
 * argumento extra e ignorado.
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
      purchase: (productId: string, contaExterna?: string) => Promise<CompraPlay>
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

  async function comprar(contaExterna?: string, productId: string = PRODUTO_COMPLETA): Promise<CompraPlay> {
    if (!disponivel()) {
      const e = new Error('billing indisponivel') as ErroBilling
      throw e
    }
    const r = await window.PlacaCompletaBilling!.purchase(productId, contaExterna)
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

  /**
   * Pagamento pendente na Play (Pix/boleto que ainda nao compensou). O plugin
   * nativo rejeita com "Purchase is pending" e, ate o app novo, o app marca
   * isso como cancelado: por isso a mensagem e olhada antes do `cancelado`.
   */
  function ficouPendente(e: any): boolean {
    return !!e?.pendente || /pending|pendente/i.test(String(e?.code || e?.message || ''))
  }

  return { disponivel, comprar, foiCancelado, ficouPendente }
}
