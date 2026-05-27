import crypto from 'crypto'

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { password } = body

  if (!password) {
    throw createError({ statusCode: 400, message: 'Senha é obrigatória' })
  }

  const config = useRuntimeConfig()
  const correctPassword = config.dashboardLookerGoogleAnalytics

  if (!correctPassword) {
    throw createError({ statusCode: 500, message: 'Configuração de autenticação não encontrada' })
  }

  // Use constant-time comparison to prevent timing attacks
  const isValid = constantTimeCompare(password, correctPassword)

  // Log auth attempt to audit log
  const ip = getHeader(event, 'x-forwarded-for')?.split(',')[0].trim() ||
             getHeader(event, 'x-real-ip') ||
             event.node.req.socket.remoteAddress ||
             'unknown'

  // Use Supabase to log audit (async, don't await)
  try {
    const supabase = useSupabaseServer()
    supabase.rpc('log_audit', {
      p_action: 'dashboard_auth_attempt',
      p_endpoint: '/api/dash-auth',
      p_user_email: null,
      p_ip_address: ip,
      p_success: isValid,
      p_details: { timestamp: new Date().toISOString() }
    }).then()
  } catch (e) {
    // Don't fail auth if logging fails
    console.error('Failed to log auth attempt:', e)
  }

  if (!isValid) {
    console.warn(`[Security] Failed dashboard auth attempt from IP: ${ip}`)
    throw createError({ statusCode: 401, message: 'Senha incorreta' })
  }

  issueAdminSession(event)

  return { success: true }
})
