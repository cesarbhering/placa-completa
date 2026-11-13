/**
 * Price A/B test of the Completa (shared/ab-preco.ts). Runs once per page
 * load, before any page code: turns the client side on only when
 * NUXT_PUBLIC_AB_PRECO is on and the visitor participates (not the app, not a
 * bot), then draws the sticky arm right away so every funnel event of the
 * visit carries `extra.ab_preco`.
 *
 * Flag off: nothing is read, drawn or stored.
 */
import { abPrecoLigadoPorEnv, adotarBracoSeVazio, configurarAbPreco, pareceBot, sortearBraco } from '~/shared/ab-preco'

const MARCADOR_APP = 'PlacaCompletaApp'

export default defineNuxtPlugin(() => {
  try {
    const ligado = abPrecoLigadoPorEnv(useRuntimeConfig().public.abPreco)
    if (!ligado) { configurarAbPreco({ ligado: false }); return }
    const ua = String(window.navigator?.userAgent || '')
    const nativo = (window as any).Capacitor
    const app = ua.includes(MARCADOR_APP) || (typeof nativo?.isNativePlatform === 'function' && nativo.isNativePlatform())
    configurarAbPreco({ ligado, participa: !app && !pareceBot(ua, (window.navigator as any)?.webdriver === true) })
    // Our own basic-report upsell link carries the order's arm: adopted only
    // when this browser has none yet (the stored arm always wins).
    const daUrl = new URLSearchParams(window.location.search).get('ab_preco')
    if (daUrl) adotarBracoSeVazio(daUrl)
    sortearBraco()
  } catch {
    configurarAbPreco({ ligado: false })
  }
})
