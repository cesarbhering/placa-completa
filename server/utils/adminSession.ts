import crypto from 'node:crypto'
import type { H3Event } from 'h3'

const COOKIE_NAME = 'admin_session'
const TTL_MS = 8 * 60 * 60 * 1000

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(s: string): Buffer {
  const pad = (4 - (s.length % 4)) % 4
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad), 'base64')
}

function getSecret(): string {
  const secret = useRuntimeConfig().dashboardLookerGoogleAnalytics
  if (!secret) {
    throw createError({ statusCode: 500, message: 'Admin session secret not configured' })
  }
  return secret
}

function sign(payload: string, secret: string): string {
  return base64url(crypto.createHmac('sha256', secret).update(payload).digest())
}

export function issueAdminSession(event: H3Event): void {
  const exp = Date.now() + TTL_MS
  const payload = base64url(Buffer.from(JSON.stringify({ exp })))
  const token = `${payload}.${sign(payload, getSecret())}`
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(TTL_MS / 1000),
  })
}

export function requireAdminSession(event: H3Event): void {
  const cookie = getCookie(event, COOKIE_NAME)
  if (!cookie) {
    throw createError({ statusCode: 401, message: 'Sessão admin ausente' })
  }
  const [payload, mac] = cookie.split('.')
  if (!payload || !mac) {
    throw createError({ statusCode: 401, message: 'Sessão admin inválida' })
  }
  const expected = sign(payload, getSecret())
  const given = Buffer.from(mac)
  const want = Buffer.from(expected)
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    throw createError({ statusCode: 401, message: 'Sessão admin inválida' })
  }
  let exp = 0
  try {
    exp = JSON.parse(fromBase64url(payload).toString('utf8')).exp
  } catch {
    throw createError({ statusCode: 401, message: 'Sessão admin inválida' })
  }
  if (typeof exp !== 'number' || Date.now() >= exp) {
    throw createError({ statusCode: 401, message: 'Sessão admin expirada' })
  }
}
