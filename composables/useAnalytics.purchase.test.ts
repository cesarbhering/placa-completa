import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAnalytics, cartaoConverteAgora } from './useAnalytics'

// Os 3 ajustes do disparo de compra (01/out): cartao so com "succeeded",
// cupom 100% (R$ 0) nao dispara nada, e o UET leva transaction_id = token.
// analyticsAtivo forcado: fora do Nuxt (teste) ele conta como ligado; o
// homolog real tem as tags desligadas (gated).

function ambiente() {
  vi.unstubAllGlobals()
  const w: any = globalThis.window
  w.gtag = vi.fn(); w.fbq = vi.fn(); w.uetq = { push: vi.fn() }
  const store = new Map<string, string>()
  const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } }
  vi.stubGlobal('localStorage', fake)
  vi.stubGlobal('sessionStorage', fake)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { gated: false } }))
  return w
}

describe('disparo de purchase', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('cartao: so "succeeded" converte na hora; "processing" fica pra pagina do relatorio', () => {
    expect(cartaoConverteAgora('succeeded')).toBe(true)
    expect(cartaoConverteAgora('processing')).toBe(false)
    expect(cartaoConverteAgora('requires_action')).toBe(false)
    expect(cartaoConverteAgora(undefined)).toBe(false)
  })

  it('cupom 100% (valor 0): conta como conversao em todas as tags, com o preco cheio do plano, uma vez', () => {
    const w = ambiente()
    const a = useAnalytics()
    a.trackConversionPaga('tok_gratis_1', 'completa', 0, 'QUALQUER')
    a.trackConversionPaga('tok_gratis_1', 'completa', 0, 'QUALQUER')
    expect(w.gtag).toHaveBeenCalledWith('event', 'conversion', expect.objectContaining({ value: 44.9, transaction_id: 'tok_gratis_1' }))
    expect(w.gtag).toHaveBeenCalledWith('event', 'purchase', expect.objectContaining({ value: 44.9 }))
    expect(w.gtag).toHaveBeenCalledTimes(2)
    expect(w.uetq.push).toHaveBeenCalledTimes(1)
    expect(w.uetq.push).toHaveBeenCalledWith('event', 'purchase', expect.objectContaining({ revenue_value: 44.9 }))
  })

  it('venda paga: Bing UET com transaction_id = token; GA4/Ads com o mesmo token; uma vez so', () => {
    const w = ambiente()
    const a = useAnalytics()
    a.trackConversionPaga('tok_pago_1', 'completa', 3990)
    a.trackConversionPaga('tok_pago_1', 'completa', 3990)
    expect(w.uetq.push).toHaveBeenCalledTimes(1)
    expect(w.uetq.push).toHaveBeenCalledWith('event', 'purchase', { revenue_value: 39.9, currency: 'BRL', transaction_id: 'tok_pago_1' })
    const purchase = w.gtag.mock.calls.find((c: any[]) => c[1] === 'purchase')
    expect(purchase[2]).toMatchObject({ transaction_id: 'tok_pago_1', value: 39.9 })
    expect(w.fbq).toHaveBeenCalledWith('track', 'Purchase', { value: 39.9, currency: 'BRL' })
  })

  it('sem valor informado (chamador antigo): usa o preco de tabela, como antes', () => {
    const w = ambiente()
    useAnalytics().trackConversionPaga('tok_tabela_1', 'completa')
    expect(w.uetq.push).toHaveBeenCalledTimes(1)
  })
})
