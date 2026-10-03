// CSP in Report-Only mode. Browsers evaluate the policy and POST any
// violations to /api/csp-report (logged server-side) without blocking
// the page. This is the baseline used to size a real allowlist before
// switching to enforced CSP.
//
// 'unsafe-inline' is intentionally allowed for both script-src and
// style-src during the baseline week:
//   - Vue scoped styles + inline style="..." attrs (e.g. pages/index.vue,
//     pages/tabela-fipe/[slug].vue) — style-attr can't use nonces.
//   - 20+ inline <script> blocks carry GA bootstrap and JSON-LD
//     (nuxt.config.ts head, plus per-page useHead({script}) in pSEO
//     pages). Migration to nonce-per-request needs middleware that
//     also clears SWR caching for those routes.
//
// Once the report stream is quiet, drop 'unsafe-inline' from script-src,
// add 'nonce-${nonce}' generated per request, and flip the header to
// `Content-Security-Policy`.

const POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  // Stripe Elements (cartao) monta iframes de js.stripe.com; o 3DS usa
  // hooks.stripe.com. Sem isto o formulario do cartao nem carrega.
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "form-action 'self'",
  // upgrade-insecure-requests e ignorada quando entregue via Report-Only
  // (so vale em CSP enforced) - so gera warning de graca no Lighthouse.
  // Reativar quando o header virar `Content-Security-Policy`.
  // "upgrade-insecure-requests",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com https://www.google-analytics.com https://cdn.onesignal.com https://api.onesignal.com https://www.clarity.ms https://scripts.clarity.ms https://bzrcdn.openai.com https://bat.bing.com https://static.cloudflareinsights.com https://www.googleadservices.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://bzr.openai.com https://www.google-analytics.com https://www.googletagmanager.com https://bat.bing.com https://c.clarity.ms https://*.clarity.ms https://googleads.g.doubleclick.net https://www.google.com https://www.google.com.br https://www.googleadservices.com",
  "font-src 'self'",
  "connect-src 'self' https://bzr.openai.com https://bzrcdn.openai.com https://api.stripe.com https://js.stripe.com https://www.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://api.onesignal.com https://onesignal.com https://*.os.tc https://www.clarity.ms https://*.clarity.ms https://c.clarity.ms https://bat.bing.com https://googleads.g.doubleclick.net https://www.google.com https://www.google.com.br",
  "worker-src 'self'",
  "manifest-src 'self'",
  "media-src 'self'",
  "report-uri /api/csp-report",
].join('; ')

export default defineEventHandler((event) => {
  setHeader(event, 'Content-Security-Policy-Report-Only', POLICY)
})
