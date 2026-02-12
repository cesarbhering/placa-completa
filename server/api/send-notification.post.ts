import * as admin from 'firebase-admin'

let firebaseApp: admin.app.App | null = null

function getFirebaseAdmin() {
  if (firebaseApp) {
    return firebaseApp
  }

  const config = useRuntimeConfig()
  const serviceAccount = JSON.parse(config.firebaseServiceAccount)

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })

  return firebaseApp
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { title, message, targetAll = true, targetEmails = [] } = body

  if (!title || !message) {
    throw createError({ statusCode: 400, message: 'Título e mensagem são obrigatórios' })
  }

  try {
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

    // Send notifications
    const firebaseAdmin = getFirebaseAdmin()
    const messaging = firebaseAdmin.messaging()

    const tokenStrings = tokens.map(t => t.token)

    const payload = {
      notification: {
        title,
        body: message
      },
      tokens: tokenStrings
    }

    const response = await messaging.sendEachForMulticast(payload)

    return {
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      total: tokens.length
    }
  } catch (error: any) {
    console.error('Error sending notifications:', error)
    throw createError({ statusCode: 500, message: 'Erro ao enviar notificações' })
  }
})
