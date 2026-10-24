import { describe, it, expect, vi, beforeEach } from 'vitest'

// Pixel da OpenAI no navegador: order_created com o MESMO id e dados da CAPI.
vi.stubGlobal('useRuntimeConfig', () => ({ public: { gated: false } }))
const { trackOrderCreatedOpenAI } = await import('./useAnalytics')
const { montarEvento } = await import('../server/utils/openai-capi')

const pedido = { token: 'r_FICTICIO000000000000a', status: 'entregue', plano: 'completa', valorCentavos: 4490, ambiente: 'producao', formaPagamento: 'pix' }

describe('order_created no pixel da OpenAI', () => {
  let oaiq: ReturnType<typeof vi.fn>
  beforeEach(() => {
    localStorage.clear()
    oaiq = vi.fn()
    ;(window as any).oaiq = oaiq
    delete (window as any).Capacitor
  })

  it("chama oaiq('measure','order_created', dados da CAPI, { event_id: token }) uma vez por token", () => {
    expect(trackOrderCreatedOpenAI(pedido)).toBe(true)
    expect(trackOrderCreatedOpenAI(pedido)).toBe(false)
    expect(oaiq).toHaveBeenCalledOnce()
    const [cmd, nome, props, opcoes] = oaiq.mock.calls[0]
    expect([cmd, nome, opcoes]).toEqual(['measure', 'order_created', { event_id: pedido.token }])
    const capi: any = montarEvento({ token_entrega: pedido.token, status: 'entregue', valor_centavos: 4490, plano: 'completa', email: null, pago_em: '2026-10-24T00:35:00Z', ambiente: 'producao', ip_address: null, google_play_order_id: null, oppref: null, obref: null })
    expect(props).toEqual(capi.data)
    expect(capi.id).toBe(opcoes.event_id)
    expect(Number.isInteger(props.amount)).toBe(true)
  })

  it('cupom 100%: vai com o preco cheio, igual a CAPI', () => {
    trackOrderCreatedOpenAI({ ...pedido, valorCentavos: 0 })
    expect(oaiq.mock.calls[0][2].amount).toBeGreaterThan(0)
  })

  it('nao dispara: nao entregue, teste, app (Google Play ou WebView), sem SDK', () => {
    expect(trackOrderCreatedOpenAI({ ...pedido, status: 'pago' })).toBe(false)
    expect(trackOrderCreatedOpenAI({ ...pedido, ambiente: 'teste' })).toBe(false)
    expect(trackOrderCreatedOpenAI({ ...pedido, formaPagamento: 'google_play' })).toBe(false)
    ;(window as any).Capacitor = { isNativePlatform: () => true }
    expect(trackOrderCreatedOpenAI(pedido)).toBe(false)
    delete (window as any).Capacitor
    delete (window as any).oaiq
    expect(trackOrderCreatedOpenAI(pedido)).toBe(false)
    expect(localStorage.getItem('pc_oai_conv_' + pedido.token)).toBeNull()
  })
})

describe('homolog/staging (gated)', () => {
  it('nao dispara', async () => {
    vi.resetModules()
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { gated: true } }))
    const m = await import('./useAnalytics')
    ;(window as any).oaiq = vi.fn()
    localStorage.clear()
    expect(m.trackOrderCreatedOpenAI(pedido)).toBe(false)
  })
})
