import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { ehCelular } from './celular'
import { enfileirarEventoFunil, _filaFunil, _limparFilaFunil } from '~/composables/useAnalytics'

// The checkout confirmation A/B test is over: variant A (the current screen)
// won and variant B ("tela enxuta") was retired on 10/nov/2026. Columns and
// data already stored (pedidos_premium.ab_checkout, event extras) are kept.

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'

const checkout = readFileSync('components/PremiumInlineCheckout.vue', 'utf8')

describe('checkout A/B retired: everyone sees variant A', () => {
  it('the variant module is gone and nothing imports it', () => {
    expect(existsSync('shared/ab-checkout.ts')).toBe(false)
    for (const f of ['components/PremiumInlineCheckout.vue', 'components/RelatoriosProntos.vue', 'composables/useAnalytics.ts']) {
      expect(readFileSync(f, 'utf8')).not.toContain('ab-checkout')
    }
  })

  it('no variant B code or CSS left in the checkout', () => {
    for (const s of ['varianteB', 'abCheckout', 'ab_checkout', 'DESBLOQUEIA_B', 'RISCO_B', 'GARANTIA_B', 'metodoInicial', 'pic-prev', 'pic-risco', 'pic-email-pix', 'pic-cupom--b', 'salvarEmailNoPix']) {
      expect(checkout, s).not.toContain(s)
    }
  })

  it('variant A blocks render unconditionally (summary strip, coupon, e-mail, trust list)', () => {
    expect(checkout).toContain('<div class="pic-faixa">')
    expect(checkout).toContain('<div v-if="!isCapacitor" class="pic-cupom">')
    expect(checkout).toContain('<ul class="pic-conf">')
    expect(checkout).toMatch(/<div class="pic-campo">\s*<label class="pic-label" for="pic-email">/)
  })

  it('the confirmation always opens on Pix, also on phones (B opened phones on the Card tab)', () => {
    expect(checkout).toContain("const metodo = ref<'pix' | 'cartao'>('pix')")
    // the only switch to the card tab is the user's own click
    expect(checkout.match(/metodo\.value = 'cartao'/g)).toHaveLength(1)
    expect(checkout).toMatch(/function selecionarCartao[\s\S]{0,400}metodo\.value = 'cartao'/)
  })

  it('orders no longer carry ab_checkout (Pix and card endpoints)', () => {
    for (const f of ['server/api/premium/checkout.post.ts', 'server/api/premium/cartao-intent.post.ts', 'server/api/premium/checkout-stripe.post.ts']) {
      expect(readFileSync(f, 'utf8'), f).not.toContain('ab_checkout')
    }
  })
})

describe('funnel events no longer stamped with ab_checkout or metodo_inicial', () => {
  let store: Map<string, string>
  beforeEach(() => {
    vi.unstubAllGlobals()
    _limparFilaFunil()
    // a visitor who was in the test before the deploy still has the old keys
    store = new Map([['pc_ab_checkout', 'B'], ['pc_metodo_inicial', 'cartao']])
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
    })
    vi.stubGlobal('navigator', { userAgent: IPHONE })
  })

  it('opening the checkout does not draw a variant, and no event carries the old fields', () => {
    for (const ev of ['premium_checkout_open', 'checkout_confirm_visto', 'pix_gerado', 'email_informado']) {
      enfileirarEventoFunil(ev, { plano: 'completa' })
    }
    for (const e of _filaFunil()) {
      expect(e.extra?.ab_checkout).toBeUndefined()
      expect(e.extra?.metodo_inicial).toBeUndefined()
    }
  })
})

describe('ehCelular (moved to shared/celular.ts, still used by RelatoriosProntos)', () => {
  it('iPhone and Android phone yes; tablet, iPad and desktop no', () => {
    expect(ehCelular(IPHONE)).toBe(true)
    expect(ehCelular(ANDROID)).toBe(true)
    expect(ehCelular(ANDROID_TABLET)).toBe(false)
    expect(ehCelular(IPAD)).toBe(false)
    expect(ehCelular(DESKTOP)).toBe(false)
    expect(ehCelular(DESKTOP, true)).toBe(true)
    expect(ehCelular('')).toBe(false)
  })
})
