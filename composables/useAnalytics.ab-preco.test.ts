import { describe, it, expect, beforeEach, vi } from 'vitest'
import { enfileirarEventoFunil, _filaFunil, _limparFilaFunil } from './useAnalytics'
import { AB_PRECO_KEY, _resetAbPreco, configurarAbPreco } from '~/shared/ab-preco'
import { sanearEvento } from '~/shared/eventos-funil'

// Price A/B arm on every funnel event of the visit (resultado_exibido,
// cta_completa_*, premium_checkout_open, checkout_confirm_visto, pix_gerado,
// checkout_fechado_sem_pagar), first key so the server 8-key cap keeps it.
function comBraco(v?: string) {
  const store = new Map<string, string>()
  if (v) store.set(AB_PRECO_KEY, v)
  const s = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, x: string) => { store.set(k, x) }, removeItem: (k: string) => { store.delete(k) } }
  vi.stubGlobal('localStorage', s)
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
}

describe('extra.ab_preco on funnel events', () => {
  beforeEach(() => { vi.unstubAllGlobals(); _limparFilaFunil(); _resetAbPreco() })

  it('stamps the visitor arm on every event when the test is on', () => {
    comBraco('B')
    configurarAbPreco({ ligado: true })
    for (const ev of ['resultado_exibido', 'cta_completa_visto', 'cta_completa_click', 'premium_checkout_open', 'checkout_confirm_visto', 'pix_gerado', 'checkout_fechado_sem_pagar']) {
      enfileirarEventoFunil(ev, { extra: { origem_cta: 'x' } })
    }
    expect(_filaFunil()).toHaveLength(7)
    for (const e of _filaFunil()) {
      expect(e.extra?.ab_preco).toBe('B')
      expect(Object.keys(e.extra || {})[0]).toBe('ab_preco')
    }
  })

  it('test off: no stamp even with a stale arm in storage', () => {
    comBraco('B')
    configurarAbPreco({ ligado: false })
    enfileirarEventoFunil('pix_gerado', { placa: 'ABC1D23' })
    expect(_filaFunil()[0]?.extra?.ab_preco).toBeUndefined()
  })

  it('server: ab_preco does not count toward the 8-key cap and rejects invalid values', () => {
    const extra: Record<string, string> = {}
    for (let i = 0; i < 8; i++) extra[`k${i}`] = 'v'
    const ok = sanearEvento({ evento: 'pix_gerado', extra: { ab_preco: 'B', ...extra } })
    expect(ok!.extra!.ab_preco).toBe('B')
    // All 8 own keys survive next to the arm.
    expect(Object.keys(ok!.extra!).filter(k => k !== 'ab_preco')).toHaveLength(8)
    const ruim = sanearEvento({ evento: 'pix_gerado', extra: { ab_preco: 'Z', a: 1 } })
    expect(ruim!.extra).toEqual({ a: 1 })
  })
})
