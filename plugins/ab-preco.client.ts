/**
 * Price A/B test of the Completa (shared/ab-preco.ts). Runs once per page
 * load, before any page code: turns the client side on only when
 * NUXT_PUBLIC_AB_PRECO is on and the visitor participates (not the app, not a
 * bot), then draws the sticky arm right away so every funnel event of the
 * visit carries `extra.ab_preco`.
 *
 * Exception: the paid report (/premium/<token>) does not draw on load. The
 * page adopts the order's arm first (resolverBracoComPedido), so the basic
 * report upsell always shows the price the checkout will charge.
 *
 * Flag off: nothing is read, drawn or stored.
 */
import { abPrecoLigadoPorEnv, configurarAbPreco, pareceBot, rotaSemSorteioNaCarga, sortearBraco, uaDoApp } from '~/shared/ab-preco'

export default defineNuxtPlugin(() => {
  try {
    const ligado = abPrecoLigadoPorEnv(useRuntimeConfig().public.abPreco)
    if (!ligado) { configurarAbPreco({ ligado: false }); return }
    const ua = String(window.navigator?.userAgent || '')
    const nativo = (window as any).Capacitor
    const app = uaDoApp(ua) || (typeof nativo?.isNativePlatform === 'function' && nativo.isNativePlatform())
    configurarAbPreco({ ligado, participa: !app && !pareceBot(ua, (window.navigator as any)?.webdriver === true) })
    if (!rotaSemSorteioNaCarga(window.location.pathname)) sortearBraco()
  } catch {
    configurarAbPreco({ ligado: false })
  }
})
