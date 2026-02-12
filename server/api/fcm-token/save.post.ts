export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { token, userEmail, userAgent, deviceInfo } = body

  if (!token) {
    throw createError({ statusCode: 400, message: 'Token é obrigatório' })
  }

  try {
    const supabase = useSupabaseServer()

    // Check if token already exists
    const { data: existing } = await supabase
      .from('fcm_tokens')
      .select('id, user_email')
      .eq('token', token)
      .single()

    if (existing) {
      // Update existing token
      await supabase
        .from('fcm_tokens')
        .update({
          user_email: userEmail || existing.user_email,
          user_agent: userAgent,
          device_info: deviceInfo,
          last_used_at: new Date().toISOString()
        })
        .eq('token', token)

      return { success: true, message: 'Token atualizado' }
    }

    // Insert new token
    await supabase.from('fcm_tokens').insert({
      token,
      user_email: userEmail,
      user_agent: userAgent,
      device_info: deviceInfo
    })

    return { success: true, message: 'Token salvo com sucesso' }
  } catch (error: any) {
    console.error('Error saving FCM token:', error)
    throw createError({ statusCode: 500, message: 'Erro ao salvar token' })
  }
})
