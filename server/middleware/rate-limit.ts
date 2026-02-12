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
  '/api/read-plate': { windowMs: 60 * 1000, maxRequests: 5 }, // 5 per minute (expensive AI call)
  '/api/send-notification': { windowMs: 60 * 1000, maxRequests: 5 }, // 5 per minute
  '/api/dash-auth': { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 per hour (auth)
  '/api/fcm-token/save': { windowMs: 60 * 1000, maxRequests: 10 }, // 10 per minute
  'default': { windowMs: 60 * 1000, maxRequests: 30 }, // Default: 30 per minute
}

function getClientIP(event: any): string {
  // Try various headers (CloudFlare, Netlify, etc.)
  const headers = [
    'cf-connecting-ip',
    'x-real-ip',
    'x-forwarded-for',
    'x-client-ip',
  ]

  for (const header of headers) {
    const value = getHeader(event, header)
    if (value) {
      // x-forwarded-for can be a comma-separated list
      return value.split(',')[0].trim()
    }
  }

  // Fallback to request IP
  return event.node.req.socket.remoteAddress || 'unknown'
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

  // Skip rate limiting for GET /api/count (public metric)
  if (path === '/api/count' && getMethod(event) === 'GET') {
    return
  }

  const ip = getClientIP(event)
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
