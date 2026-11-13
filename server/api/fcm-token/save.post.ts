// The endpoint is anonymous and stores what the client sends, so every field
// has a ceiling before it reaches the database.
/** Real tokens are a few dozen to a couple of hundred characters. */
const TOKEN_MAX = 1024
const USER_AGENT_MAX = 300
const DEVICE_INFO_MAX = 100

/** Text field from the client: a string trimmed to `max`, anything else is null. */
function textoCurto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max)
  return s || null
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {}
  const { token, userEmail } = body
  const userAgent = textoCurto(body.userAgent, USER_AGENT_MAX)
  const deviceInfo = textoCurto(body.deviceInfo, DEVICE_INFO_MAX)

  if (!token || typeof token !== 'string') {
    throw createError({ statusCode: 400, message: 'Token é obrigatório' })
  }
  // A token is one printable ASCII word; anything longer or with spaces or
  // control characters is not a push token.
  if (token.length > TOKEN_MAX || !/^[\x21-\x7e]+$/.test(token)) {
    throw createError({ statusCode: 400, message: 'Token inválido' })
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
