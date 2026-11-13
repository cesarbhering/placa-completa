import { getClientIp } from '../utils/client-ip'
/**
 * Rate Limiting Middleware
 * Protects against DoS attacks and API abuse
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store (use Redis in production for multi-instance deployments)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
}

// Rate limit configurations by endpoint pattern
const rateLimitConfigs: Record<string, RateLimitConfig> = {
  '/api/consulta': { windowMs: 60 * 1000, maxRequests: 10 }, // 10 per minute
  // Proposta de pacote para empresas (/para-empresas): ninguem pede mais de 5 por hora.
  '/api/empresas/proposta': { windowMs: 60 * 60 * 1000, maxRequests: 5 },
  // Floating contact button form: nobody writes more than 5 times per hour.
  '/api/contato/mensagem': { windowMs: 60 * 60 * 1000, maxRequests: 5 },
  // Acesso de parceiro: pedir link e ativar (link ou codigo de 8). Ninguem faz
  // isso mais de 5 vezes por hora; barra tentativa de adivinhar o codigo.
  '/api/parceiro/link': { windowMs: 60 * 60 * 1000, maxRequests: 5 },
  '/api/parceiro/entrar': { windowMs: 60 * 60 * 1000, maxRequests: 10 },
  '/api/fcm-token/save': { windowMs: 60 * 1000, maxRequests: 10 }, // 10 per minute
  // Verificacao de compra do Google Play: cada chamada bate na API da Google e
  // pode virar uma consulta paga no SENATRAN. Ninguem compra dez vezes por hora
  // do mesmo aparelho, entao o teto e baixo de proposito.
  '/api/premium/google-play/verificar': { windowMs: 60 * 60 * 1000, maxRequests: 10 }, // 10 por hora
  // "Cade meu relatorio" do app: so le o banco (nao bate na Google). O app
  // pergunta com intervalo crescente enquanto a compra esta pendente; 120/h
  // cobre a espera com folga e barra varredura.
  '/api/premium/google-play/pedido': { windowMs: 60 * 60 * 1000, maxRequests: 120 }, // 120 por hora
  // The three routes below are what a buyer's screen calls after the checkout,
  // with the order token in the query string. Every order followed from the
  // same address counts against the same bucket (see rotaDoBalde), so each
  // limit leaves room for several people behind one address:
  // - status: polled every 4 to 5 s while an order is pending.
  '/api/premium/status': { windowMs: 60 * 1000, maxRequests: 240 }, // 240 per minute
  // - report: a freshly delivered report reloads it up to 36 times a minute
  //   (every 3 s while it waits for the DETRAN block, plus slower reloads for
  //   recall and fines), and a blocked reload leaves the screen in its error
  //   state.
  '/api/premium/report': { windowMs: 60 * 1000, maxRequests: 300 }, // 300 per minute
  // - foto: one request per photo of an auction lot, as the carousel goes
  //   through them. The route keeps its own ceiling of new links per report.
  '/api/premium/foto': { windowMs: 60 * 1000, maxRequests: 300 }, // 300 per minute
  // Prefill of the /cotacao page, read by an id that cannot be guessed. The
  // page asks for it while it renders on the server, where the request carries
  // no visitor address, so every render of the page shares one bucket.
  '/api/cotacao-info': { windowMs: 60 * 1000, maxRequests: 300 }, // 300 per minute
  // Brand logo proxy. A report screen shows one logo through it and asks at
  // most twice (the file the source named, then the one deduced from the brand
  // name); the browser then keeps it for a week. 60 per minute is thirty
  // report screens a minute from the same address.
  '/api/logo-marca': { windowMs: 60 * 1000, maxRequests: 60 }, // 60 per minute
  // Intencao de compra do app (placa + e-mail antes da folha da Play): uma por
  // tentativa de compra. Mesmo teto do /verificar.
  '/api/premium/google-play/intencao': { windowMs: 60 * 60 * 1000, maxRequests: 10 }, // 10 por hora
  // Coletor do funil: recebe lote de ate 10 eventos por chamada, entao 60/min
  // cobre uma navegacao intensa com folga e ainda barra despejo automatizado.
  '/api/evento': { windowMs: 60 * 1000, maxRequests: 60 }, // 60 por minuto
  // Dados da /tabela-fipe para o app: ele baixa uma vez por dia na abertura e usa
  // o retrato do bundle como reserva, entao 10/min cobre tentativas e barra
  // varredura. O startsWith nao pega /api/fipe-prices (hifen no lugar da barra).
  '/api/fipe/dados': { windowMs: 60 * 1000, maxRequests: 10 }, // 10 por minuto
  'default': { windowMs: 60 * 1000, maxRequests: 30 }, // Default: 30 per minute
}

// Routes whose path carries a value (a token, a file name). The bucket is the
// route's, not each value's, so everything under the prefix counts together.
// Listed by hand on purpose: no attempt is made to guess which segment of a
// path is a value.
const ROTAS_COM_VALOR_NO_CAMINHO = ['/api/feedback', '/api/logo-marca', '/api/premium/nfse']

// No route of ours comes near this length. Longer paths all count against one
// fixed bucket, and nothing else is computed from them.
const TAMANHO_MAXIMO_DO_CAMINHO = 512
const BALDE_DE_CAMINHO_LONGO = '/api/(caminho-longo)'
const BARRA = 47 // '/'

/**
 * The route a request counts against: its path alone, with no query string,
 * no fragment and no trailing slash, cut at the route for the ones listed
 * above. The bucket key, the per-route limit lookup and the log line all use
 * it, for every route, so nothing a URL carries besides the route (a token, a
 * secret) reaches the log.
 *
 * The cost is linear in the length of the URL: one pass to find where the
 * path ends, and the trailing slashes dropped one character at a time.
 */
function rotaDoBalde(path: string): string {
  const fimDoCaminho = path.search(/[?#]/)
  let fim = fimDoCaminho === -1 ? path.length : fimDoCaminho
  if (fim > TAMANHO_MAXIMO_DO_CAMINHO) return path.startsWith('/api/') ? BALDE_DE_CAMINHO_LONGO : '/'
  while (fim > 1 && path.charCodeAt(fim - 1) === BARRA) fim--
  const caminho = path.slice(0, fim) || '/'
  return ROTAS_COM_VALOR_NO_CAMINHO.find((rota) => caminho.startsWith(`${rota}/`)) ?? caminho
}

function getRateLimitConfig(path: string): RateLimitConfig {
  for (const [pattern, config] of Object.entries(rateLimitConfigs)) {
    if (path.startsWith(pattern)) {
      return config
    }
  }
  return rateLimitConfigs.default
}

export default defineEventHandler(async (event) => {
  const path = rotaDoBalde(event.path)

  // Skip rate limiting for non-API routes
  if (!path.startsWith('/api/')) {
    return
  }

  // /api/csp-report nunca pode devolver erro: e o proprio browser reportando
  // violacao de CSP, e um 429 aqui vira "Failed to load resource" no console
  // (o remedio fica pior que a doenca). O endpoint faz sampling interno e
  // sempre responde 204.
  if (path.startsWith('/api/csp-report')) {
    return
  }

  // Homolog e ambiente de teste: sem rate limit pra nao travar quem esta
  // testando. So o container de homolog seta NUXT_PUBLIC_HOMOLOG; prod nao.
  if (useRuntimeConfig().public.homolog) {
    return
  }

  // IP real do visitante (cf-connecting-ip; nunca IP interno do proxy):
  // mesma fonte dos tetos da consulta e dos sinais (server/utils/client-ip.ts).
  const ip = getClientIp(event)
  const config = getRateLimitConfig(path)
  const key = `${ip}:${path}`

  const now = Date.now()
  let entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    // Create new entry
    entry = {
      count: 1,
      resetAt: now + config.windowMs,
    }
    rateLimitStore.set(key, entry)
  } else {
    // Increment existing entry
    entry.count++

    if (entry.count > config.maxRequests) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)

      // Log the rate limit violation
      console.warn(`[Rate Limit] IP ${ip} exceeded limit on ${path}: ${entry.count}/${config.maxRequests}`)

      // Set rate limit headers
      setHeader(event, 'X-RateLimit-Limit', config.maxRequests.toString())
      setHeader(event, 'X-RateLimit-Remaining', '0')
      setHeader(event, 'X-RateLimit-Reset', entry.resetAt.toString())
      setHeader(event, 'Retry-After', retryAfter.toString())

      throw createError({
        statusCode: 429,
        statusMessage: 'Too Many Requests',
        message: `Muitas requisições. Tente novamente em ${retryAfter} segundos.`,
      })
    }
  }

  // Set rate limit headers for successful requests
  const remaining = Math.max(0, config.maxRequests - entry.count)
  setHeader(event, 'X-RateLimit-Limit', config.maxRequests.toString())
  setHeader(event, 'X-RateLimit-Remaining', remaining.toString())
  setHeader(event, 'X-RateLimit-Reset', entry.resetAt.toString())
})
