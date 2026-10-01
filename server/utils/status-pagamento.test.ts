import { describe, it, expect, vi } from 'vitest'
import { detectarPagamento } from './status-pagamento'

// Detecta pagamento na ordem certa (Stripe pro cartao, Pix pro resto), com foco
// na regressao "abriu Pix, trocou pra cartao": pedido de cartao que ganhou um
// abacatepay_id de Pix nao pode travar checando so o Pix.

function deps(stripePago: boolean, pixPago: boolean) {
  return {
    checarStripe: vi.fn(async () => stripePago),
    checarPix: vi.fn(async () => pixPago),
  }
}

describe('detectarPagamento', () => {
  it('cartao com Stripe pago => pago (nem chega a checar Pix)', async () => {
    const d = deps(true, false)
    const pedido = { forma_pagamento: 'cartao', stripe_session_id: 'cs_1', abacatepay_id: 'pix_1' }
    expect(await detectarPagamento(pedido, d)).toBe(true)
    expect(d.checarStripe).toHaveBeenCalledWith('cs_1')
    expect(d.checarPix).not.toHaveBeenCalled()
  })

  it('REGRESSAO: cartao com Pix (nao pago) MAS Stripe pago => pago via Stripe', async () => {
    // Antes o codigo checava so o Pix (abacatepay_id) e travava. Agora o Stripe
    // e checado primeiro e o pedido e liberado.
    const d = deps(true, false)
    const pedido = { forma_pagamento: 'cartao', stripe_session_id: 'cs_1', abacatepay_id: 'pix_1', pix_provider: 'woovi' }
    expect(await detectarPagamento(pedido, d)).toBe(true)
    expect(d.checarStripe).toHaveBeenCalledOnce()
  })

  it('cartao com Stripe nao pago e Pix nao pago => nao pago', async () => {
    const d = deps(false, false)
    const pedido = { forma_pagamento: 'cartao', stripe_session_id: 'cs_1', abacatepay_id: 'pix_1' }
    expect(await detectarPagamento(pedido, d)).toBe(false)
    // Checou as duas trilhas antes de desistir.
    expect(d.checarStripe).toHaveBeenCalledOnce()
    expect(d.checarPix).toHaveBeenCalledOnce()
  })

  it('cartao SEM Stripe pago mas com Pix pago => pago (qualquer trilha vale)', async () => {
    const d = deps(false, true)
    const pedido = { forma_pagamento: 'cartao', stripe_session_id: 'cs_1', abacatepay_id: 'pix_1' }
    expect(await detectarPagamento(pedido, d)).toBe(true)
  })

  it('pedido Pix normal: Stripe nunca e checado; Pix pago => pago', async () => {
    const d = deps(false, true)
    const pedido = { forma_pagamento: 'pix', abacatepay_id: 'pix_1', pix_provider: 'abacatepay' }
    expect(await detectarPagamento(pedido, d)).toBe(true)
    expect(d.checarStripe).not.toHaveBeenCalled()
    expect(d.checarPix).toHaveBeenCalledWith('abacatepay', 'pix_1')
  })

  it('pedido de cartao sem sessao e sem Pix => nao pago, sem chamar nada', async () => {
    const d = deps(true, true)
    const pedido = { forma_pagamento: 'cartao' }
    expect(await detectarPagamento(pedido, d)).toBe(false)
    expect(d.checarStripe).not.toHaveBeenCalled()
    expect(d.checarPix).not.toHaveBeenCalled()
  })
})
