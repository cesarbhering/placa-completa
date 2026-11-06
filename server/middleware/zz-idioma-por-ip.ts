import { COOKIE_IDIOMA, HOSTS_PADRAO, destinoPorIdioma } from '../../shared/idioma-por-ip'

// Language by IP (Nov 6, 2026): visitors outside Brazil land on /en. All the
// rules live in shared/idioma-por-ip.ts; this file only reads the request.
//
// The "zz-" prefix runs it after the other middlewares (Nitro sorts them by
// name): old URLs get their 301 first, and the markdown negotiation answers
// agents before this ever looks at the language.
//
// The country comes from CF-IPCountry (Cloudflare tunnel). Without that
// header (local dev, internal fetch) nothing happens.
//
// Active hosts: shared/idioma-por-ip.ts (HOSTS_PADRAO). Extra ones via
// NUXT_IDIOMA_IP_HOSTS, comma separated.
export default defineEventHandler((event) => {
  const metodo = getMethod(event)
  if (metodo !== 'GET') return

  const extra = String(useRuntimeConfig(event).idiomaIpHosts || '')
    .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)

  const destino = destinoPorIdioma({
    metodo,
    url: event.path || '/',
    host: getRequestHost(event, { xForwardedHost: true }) || '',
    accept: getHeader(event, 'accept'),
    userAgent: getHeader(event, 'user-agent'),
    pais: getHeader(event, 'cf-ipcountry'),
    cookieIdioma: getCookie(event, COOKIE_IDIOMA),
    interno: !!getHeader(event, 'x-pc-md-interno'),
  }, [...HOSTS_PADRAO, ...extra])

  if (!destino) return
  // The answer depends on country and cookie: no shared cache may keep it
  // (Cloudflare does not cache HTML today, this keeps it safe if that changes).
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  appendResponseHeader(event, 'Vary', 'CF-IPCountry, Cookie')
  return sendRedirect(event, destino, 302)
})
