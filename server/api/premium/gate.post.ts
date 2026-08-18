import crypto from 'node:crypto'

// Valida a senha do gate premium e seta o cookie. Homologacao.
export default defineEventHandler(async (event) => {
  const { password } = await readBody(event)
  const config = useRuntimeConfig()
  const expected = config.premiumPagePassword as string
  if (!expected) throw createError({ statusCode: 503, message: 'Premium nao configurado.' })
  const ok =
    typeof password === 'string' &&
    password.length === expected.length &&
    (() => { try { return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected)) } catch { return false } })()
  if (!ok) throw createError({ statusCode: 401, message: 'Senha incorreta.' })
  setCookie(event, 'premium_gate', expected, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 12 })
  return { ok: true }
})
