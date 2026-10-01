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
  '/api/send-notification': { windowMs: 60 * 1000, maxRequests: 5 }, // 5 per minute
  '/api/dash-auth': { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 per hour (auth)
  '/api/fcm-token/save': { windowMs: 60 * 1000, maxRequests: 10 }, // 10 per minute
  // Verificacao de compra do Google Play: cada chamada bate na API da Google e
  // pode virar uma consulta paga no SENATRAN. Ninguem compra dez vezes por hora
  // do mesmo aparelho, entao o teto e baixo de proposito.
  '/api/premium/google-play/verificar': { windowMs: 60 * 60 * 1000, maxRequests: 10 }, // 10 por hora
  // Coletor do funil: recebe lote de ate 10 eventos por chamada, entao 60/min
  // cobre uma navegacao intensa com folga e ainda barra despejo automatizado.
  '/api/evento': { windowMs: 60 * 1000, maxRequests: 60 }, // 60 por minuto
  'default': { windowMs: 60 * 1000, maxRequests: 30 }, // Default: 30 per minute
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
  const path = event.path

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
