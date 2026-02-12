export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { title, message, targetAll = true, targetEmails = [] } = body

  if (!title || !message) {
    throw createError({ statusCode: 400, message: 'Título e mensagem são obrigatórios' })
  }

  try {
    const config = useRuntimeConfig()
    const supabase = useSupabaseServer()

    // Get tokens from database
    let query = supabase.from('fcm_tokens').select('token, user_email')

    if (!targetAll && targetEmails.length > 0) {
      query = query.in('user_email', targetEmails)
    }

    const { data: tokens, error } = await query

    if (error) {
      throw error
    }

    if (!tokens || tokens.length === 0) {
      return { success: true, sent: 0, message: 'Nenhum token encontrado' }
    }

    // Get subscription IDs
    const subscriptionIds = tokens.map(t => t.token)

    // Send notification via OneSignal REST API
    const response = await $fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${config.oneSignalRestApiKey}`
      },
      body: {
        app_id: config.oneSignalAppId,
        headings: { en: title },
        contents: { en: message },
        include_subscription_ids: subscriptionIds,
        web_url: 'https://placacompleta.com.br'
      }
    })

    return {
      success: true,
      sent: (response as any).recipients || subscriptionIds.length,
      total: subscriptionIds.length,
      oneSignalId: (response as any).id
    }
  } catch (error: any) {
    console.error('Error sending notifications:', error)
    throw createError({
      statusCode: 500,
      message: `Erro ao enviar notificações: ${error.message}`
    })
  }
})
