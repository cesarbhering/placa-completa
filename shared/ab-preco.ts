import { PLANOS, aplicarCupom, type PlanoId } from './planos'
import { CUPOM_TELA_PCT } from './cupom-tela'

// ---------------------------------------------------------------------------
// Price A/B test of the Consulta Completa (decided 12/nov/2026, ~4 weeks).
//
// A (control) = today's table price (shared/planos.ts, R$ 44,90).
// B           = R$ 39,90 with the SAME presentation (no "de/por", no badge).
// Basica never changes. App (Google Play), bots and SSR always see A.
//
// Unlike the previous tests (ab-bloco, ab_checkout: one draw per VISIT in
// sessionStorage), this draw is per VISITOR and sticky across visits:
// localStorage first, sessionStorage as fallback, memory as last resort.
// No cookie.
//
// Kill switch: NUXT_PUBLIC_AB_PRECO=on turns the test on (default off). Off =
// everybody in A, nothing read or written, no `ab_preco` anywhere.
// ---------------------------------------------------------------------------

export type BracoPreco = 'A' | 'B'

/** localStorage/sessionStorage key. Sticky per visitor. */
export const AB_PRECO_KEY = 'pc_ab_preco'

/** Completa price per arm, in cents. A always follows the table. */
export const PRECO_COMPLETA_BRACO: Readonly<Record<BracoPreco, number>> = {
  A: PLANOS.completa.valorCentavos,
  B: 3990,
}

export function bracoValido(v: unknown): v is BracoPreco {
  return v === 'A' || v === 'B'
}

/** NUXT_PUBLIC_AB_PRECO / runtimeConfig value -> on/off. Only explicit "on"-like values turn it on. */
export function abPrecoLigadoPorEnv(v: unknown): boolean {
  return ['on', '1', 'true', 'ligado'].includes(String(v ?? '').trim().toLowerCase())
}

/**
 * Table price of a paid plan for an arm. Only the Completa varies; anything
 * that is not exactly 'B' gets the table price (fail-closed to control).
 */
export function precoDoPlano(plano: 'basica' | 'completa', braco?: BracoPreco | null): number {
  if (plano === 'completa' && braco === 'B') return PRECO_COMPLETA_BRACO.B
  return PLANOS[plano].valorCentavos
}

/**
 * Same as aplicarCupom (shared/planos.ts), but on the arm's base price: a
 * percentage coupon applies to the price the visitor was shown.
 */
export function aplicarCupomNoBraco(
  plano: 'basica' | 'completa',
  cupom: Parameters<typeof aplicarCupom>[1],
  braco?: BracoPreco | null,
) {
  return aplicarCupom(plano, cupom, precoDoPlano(plano, braco))
}

/** Screen-coupon discount on the arm price (0 when the screen coupon is not active). */
export function descontoTelaNoBraco(plano: 'basica' | 'completa', braco: BracoPreco | null | undefined, telaAtiva: boolean): number {
  if (!telaAtiva) return 0
  return aplicarCupomNoBraco(plano, { tipo: 'percentual', valor: CUPOM_TELA_PCT, planos: ['basica', 'completa'] }, braco).descontoCentavos
}

/**
 * Price the inline checkout SHOWS: arm price minus the larger of the typed
 * coupon discount (as returned by /api/premium/coupon) and the screen coupon.
 * Same rule as the server (resolverDescontoTela: no stacking, larger wins), so
 * shown = charged. Pure, shared by the component and its tests.
 */
export function precoExibidoNoCheckout(
  plano: 'basica' | 'completa',
  braco: BracoPreco | null | undefined,
  descontoCupomCentavos: number,
  telaAtiva: boolean,
): number {
  const desconto = Math.max(descontoCupomCentavos || 0, descontoTelaNoBraco(plano, braco, telaAtiva))
  return Math.max(0, precoDoPlano(plano, braco) - desconto)
}

// ---------------------------------------------------------------------------
// Client side: sticky draw.
// ---------------------------------------------------------------------------

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem?(k: string): void }

function lerStore(nome: 'localStorage' | 'sessionStorage'): Store | null {
  try {
    return ((globalThis as any)[nome] as Store | undefined) ?? null
  } catch {
    return null
  }
}

/** Last resort when both storages throw (strict private mode): stable for the page life. */
let memoria: BracoPreco | null = null
/** Set once at startup by plugins/ab-preco.client.ts. Off until then. */
let ligado = false

/**
 * Turns the client side of the test on/off for this page. `participa` is
 * false for the app (Capacitor) and for bots: they stay in A, with nothing
 * stored and no stamp.
 */
export function configurarAbPreco(opts: { ligado: boolean; participa?: boolean }): void {
  ligado = !!opts.ligado && opts.participa !== false
}

export function abPrecoAtivo(): boolean {
  return ligado
}

/** App WebView marker in the user-agent, case-insensitive like the server (server/utils/dispositivo.ts). */
export function uaDoApp(ua: string | null | undefined): boolean {
  return /PlacaCompletaApp/i.test(String(ua || ''))
}

/** Crawler / headless heuristics. They never enter the test. */
export function pareceBot(ua: string | null | undefined, webdriver?: boolean): boolean {
  if (webdriver) return true
  return /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|bingpreview|google-inspectiontool/i.test(String(ua || ''))
}

function lerGuardado(): BracoPreco | null {
  for (const nome of ['localStorage', 'sessionStorage'] as const) {
    try {
      const v = lerStore(nome)?.getItem(AB_PRECO_KEY)
      if (bracoValido(v)) return v
    } catch { /* next one */ }
  }
  return bracoValido(memoria) ? memoria : null
}

function guardar(v: BracoPreco): void {
  memoria = v
  for (const nome of ['localStorage', 'sessionStorage'] as const) {
    try {
      lerStore(nome)?.setItem(AB_PRECO_KEY, v)
      return
    } catch { /* quota / private mode: try the next one */ }
  }
}

/**
 * Arm already drawn for this visitor, without drawing. null when the test is
 * off, the visitor does not participate, or nothing was drawn yet. Used to
 * stamp `extra.ab_preco` on funnel events.
 */
export function bracoAtual(): BracoPreco | null {
  if (!ligado) return null
  return lerGuardado()
}

/**
 * Arm of this visitor, drawing once (50/50) if needed and storing it. Test
 * off / not participating = 'A' and nothing stored. `rnd` injectable for tests.
 */
export function sortearBraco(rnd: () => number = Math.random): BracoPreco {
  if (!ligado) return 'A'
  const atual = lerGuardado()
  if (atual) return atual
  const v: BracoPreco = rnd() < 0.5 ? 'A' : 'B'
  guardar(v)
  return v
}

/**
 * Adopts an arm coming from a link we generated ourselves (the basic report
 * upsell carries the order's arm) ONLY when this browser has none yet: the
 * stored one always wins, so nobody switches price by editing a URL.
 */
export function adotarBracoSeVazio(v: unknown): BracoPreco | null {
  if (!ligado || !bracoValido(v)) return bracoAtual()
  if (!lerGuardado()) guardar(v)
  return lerGuardado()
}

/**
 * Pages where the plugin must NOT draw on load: the paid report
 * (/premium/<token>, optionally under a locale prefix). There the order's arm
 * is adopted first (resolverBracoComPedido), so a fresh browser does not draw
 * a different arm before the report data arrives.
 */
export function rotaSemSorteioNaCarga(pathname: string | null | undefined): boolean {
  return /^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/premium\/[^/]+\/?$/i.test(String(pathname || ''))
}

/**
 * Report page: adopt the order's arm if this browser has none, then draw only
 * if it is still empty. Returns the browser's arm (what the checkout will
 * charge), or null when the test is off / the visitor does not participate.
 */
export function resolverBracoComPedido(bracoDoPedidoBruto: unknown): BracoPreco | null {
  if (!ligado) return null
  adotarBracoSeVazio(bracoDoPedidoBruto)
  sortearBraco()
  return bracoAtual()
}

/** Test helper. */
export function _resetAbPreco(): void {
  memoria = null
  ligado = false
  for (const nome of ['localStorage', 'sessionStorage'] as const) {
    try { lerStore(nome)?.removeItem?.(AB_PRECO_KEY) } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Server side.
// ---------------------------------------------------------------------------

/**
 * Arm recorded on the order. null = order outside the test (flag off, app,
 * missing or invalid variant). Only a recorded 'B' changes the price, so an
 * invalid variant always falls back to A's price.
 */
export function bracoDoPedido(bruto: unknown, opts: { ligado: boolean; canal?: string | null }): BracoPreco | null {
  if (!opts.ligado) return null
  if (opts.canal === 'app') return null
  return bracoValido(bruto) ? bruto : null
}

/** Insert columns: nothing at all when the test is off (deploy-safe before the migration). */
export function colunasAbPreco(braco: BracoPreco | null, ligadoFlag: boolean): { ab_preco?: BracoPreco | null } {
  return ligadoFlag ? { ab_preco: braco } : {}
}

export type { PlanoId }
