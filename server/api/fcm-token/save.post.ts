export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { token, userEmail, userAgent, deviceInfo } = body

  if (!token || typeof token !== 'string') {
    throw createError({ statusCode: 400, message: 'Token é obrigatório' })
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
