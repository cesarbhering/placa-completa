// What the client sends (composables/usePushNotifications.ts): token is the
// OneSignal subscription id (a UUID, 36 chars), userAgent is
// navigator.userAgent, deviceInfo is 'Mobile' or 'Desktop', userEmail comes
// from localStorage and pushToken is sent but not stored. The endpoint is
// anonymous, so anything else or anything bigger is refused: it would only
// fill the database (Supabase Free, read-only above 500 MB). The table has
// the same limits as a CHECK (migration 20261119240000).
export const LIMITES_FCM = { token: 256, userAgent: 512, deviceInfo: 64, pushToken: 4096 } as const
const CAMPOS_FCM = new Set(['token', 'userEmail', 'userAgent', 'deviceInfo', 'pushToken'])

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, message: 'Corpo inválido' })
  }
  if (Object.keys(body).some((campo) => !CAMPOS_FCM.has(campo))) {
    throw createError({ statusCode: 400, message: 'Campo não esperado' })
  }
  const { token, userEmail, userAgent, deviceInfo, pushToken } = body

  if (!token || typeof token !== 'string') {
    throw createError({ statusCode: 400, message: 'Token é obrigatório' })
  }
  const opcionais = { userAgent, deviceInfo, pushToken } as const
  for (const [campo, valor] of [['token', token], ...Object.entries(opcionais)] as [keyof typeof LIMITES_FCM, unknown][]) {
    if (valor == null) continue
    if (typeof valor !== 'string' || valor.length > LIMITES_FCM[campo]) {
      throw createError({ statusCode: 400, message: `${campo} inválido` })
    }
  }
  if (userEmail != null && typeof userEmail !== 'string') {
    throw createError({ statusCode: 400, message: 'userEmail inválido' })
  }

  // The endpoint is anonymous (no auth), so we can never trust the client
  // to tell us "this token belongs to user X". The best we can do is:
  //  - accept a candidate email only on the first registration
  //  - never overwrite an existing user_email — that would let an
  //    attacker reassign someone else's device to their own address
  //    and hijack targeted notifications.
  const candidateEmail = (typeof userEmail === 'string' && isValidEmail(userEmail))
    ? sanitizeEmail(userEmail)
    : null

  try {
    const supabase = useSupabaseServer()

    const { data: existing } = await supabase
      .from('fcm_tokens')
      .select('id, user_email')
      .eq('token', token)
      .single()

    if (existing) {
      const updates: Record<string, unknown> = {
        user_agent: userAgent,
        device_info: deviceInfo,
        last_used_at: new Date().toISOString(),
      }
      // First-claim only: assign the email if the row had none yet.
      // Once set, it is sticky for the lifetime of the token.
      if (!existing.user_email && candidateEmail) {
        updates.user_email = candidateEmail
      }
      await supabase
        .from('fcm_tokens')
        .update(updates)
        .eq('token', token)

      return { success: true, message: 'Token atualizado' }
    }

    await supabase.from('fcm_tokens').insert({
      token,
      user_email: candidateEmail,
      user_agent: userAgent,
      device_info: deviceInfo,
    })

    return { success: true, message: 'Token salvo com sucesso' }
  } catch (error: any) {
    console.error('Error saving FCM token:', error)
    throw createError({ statusCode: 500, message: 'Erro ao salvar token' })
  }
})
