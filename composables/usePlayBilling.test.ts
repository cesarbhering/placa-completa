import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePlayBilling, PRODUTO_COMPLETA } from './usePlayBilling'

// A placa viaja junto com o productId porque o app v5 a grava antes de abrir a
// folha do Play: sem ela, uma compra paga que o app perde no meio do caminho
// fica orfa e nao da pra saber qual relatorio entregar.
function pontede(resposta: any = { purchaseToken: 'tok-1', orderId: 'ord-1', productId: PRODUTO_COMPLETA }) {
  const purchase = vi.fn().mockResolvedValue(resposta)
  vi.stubGlobal('window', { PlacaCompletaBilling: { purchase } })
  return purchase
}

describe('ponte do Google Play Billing', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('manda a placa como segundo argumento do purchase', async () => {
    const purchase = pontede()
    await usePlayBilling().comprar('ABC1D23')
    expect(purchase).toHaveBeenCalledWith(PRODUTO_COMPLETA, 'ABC1D23')
  })

  it('sem placa ainda compra: o app v4 ignora o argumento extra', async () => {
    const purchase = pontede()
    const compra = await usePlayBilling().comprar()
    expect(purchase).toHaveBeenCalledWith(PRODUTO_COMPLETA, undefined)
    expect(compra.purchaseToken).toBe('tok-1')
  })

  it('compra sem comprovante e erro, nao venda', async () => {
    pontede({ orderId: 'ord-2', productId: PRODUTO_COMPLETA })
    await expect(usePlayBilling().comprar('ABC1D23')).rejects.toThrow('compra sem comprovante')
  })
})
