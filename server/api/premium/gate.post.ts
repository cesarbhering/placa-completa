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
  // `secure` acompanha o protocolo real. Fixo em true, o cookie era descartado
  // em silencio fora do localhost: no celular pela rede local (http://192.168.x.x)
  // a senha certa devolvia 200 e a tela voltava a pedir senha, sem explicacao.
  // Em producao o acesso e https, entao a flag continua ligada.
  const https = getRequestProtocol(event) === 'https'
  // maxAge longo (400 dias, o teto que os browsers aceitam) pra o cookie durar
  // tanto quanto a flag em localStorage: assim, depois de passar pelo gate do
  // home uma vez, o fluxo de compra nunca cai em 401 no meio.
  setCookie(event, 'premium_gate', expected, { httpOnly: true, sameSite: 'lax', secure: https, path: '/', maxAge: 60 * 60 * 24 * 400 })
  return { ok: true }
})
