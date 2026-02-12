export const usePushNotifications = () => {
  const requestPermissionAndSave = async () => {
    try {
      // Wait for OneSignal to be ready
      if (!window.OneSignalDeferred) {
        const error = 'OneSignal not loaded'
        console.error(error)
        return { error, success: false }
      }

      console.log('⏳ Aguardando OneSignal carregar...')
      await new Promise((resolve) => {
        window.OneSignalDeferred.push(resolve)
      })

      const OneSignal = (window as any).OneSignal
      console.log('✅ OneSignal carregado')

      // Check Service Worker
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        console.log('📋 Service Worker registration:', registration?.active ? 'ativo' : 'inativo')
      }

      // Check if already subscribed
      const isSubscribed = await OneSignal.User.PushSubscription.optedIn
      console.log('📊 Já inscrito?', isSubscribed)

      if (isSubscribed) {
        const userId = await OneSignal.User.PushSubscription.id
        console.log('✅ Already subscribed, User ID:', userId)
        return { success: true, userId }
      }

      // Check if already has permission (don't request again)
      const currentPermission = Notification.permission
      console.log('📊 Permissão atual do browser:', currentPermission)

      if (currentPermission !== 'granted') {
        // Only request if not granted yet
        console.log('🔔 Pedindo permissão nativa...')
        const permission = await Notification.requestPermission()
        console.log('📱 Resposta da permissão:', permission)

        if (permission !== 'granted') {
          return { error: `Permissão: ${permission}`, success: false }
        }
      } else {
        console.log('✅ Já tem permissão granted')
      }

      // Set up event listener for subscription changes BEFORE calling optIn
      console.log('📝 Configurando listener de subscription...')
      const subscriptionPromise = new Promise<{ id: string, token: string }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout aguardando subscription (15s)'))
        }, 15000)

        OneSignal.User.PushSubscription.addEventListener('change', function(event: any) {
          console.log('🔔 Subscription change event:', event)
          const id = event.current.id
          const token = event.current.token

          if (id) {
            clearTimeout(timeout)
            console.log('✅ Subscription ID recebido via event:', id)
            resolve({ id, token })
          }
        })
      })

      // After permission granted, let OneSignal register the subscription
      console.log('📝 Registrando no OneSignal...')
      await OneSignal.User.PushSubscription.optIn()
      console.log('✅ OptIn chamado')

      // Wait for subscription event
      console.log('⏳ Aguardando subscription change event...')
      const { id: subscription, token } = await subscriptionPromise

      console.log('📊 Estado OneSignal:', {
        id: subscription,
        token: token ? 'presente' : 'ausente'
      })

      // Save to database
      console.log('💾 Salvando no banco...')
      await saveTokenToDatabase(subscription, token)
      console.log('✅ OneSignal subscription saved:', subscription)
      return { success: true, userId: subscription }
    } catch (error: any) {
      console.error('Error requesting notification permission:', error)
      return { error: error.message || 'Erro desconhecido', success: false }
    }
  }

  const saveTokenToDatabase = async (subscriptionId: string, token: string) => {
    try {
      console.log('💾 Salvando no banco...')
      const userAgent = navigator.userAgent
      const isMobile = /mobile|android|iphone/i.test(userAgent)
      const deviceInfo = isMobile ? 'Mobile' : 'Desktop'

      // Get user email from localStorage if available
      const pwaEmail = localStorage.getItem('pwa_email')
      const webEmail = localStorage.getItem('pc_email')
      const userEmail = pwaEmail || webEmail || null

      const response = await $fetch('/api/fcm-token/save', {
        method: 'POST',
        body: {
          token: subscriptionId,
          userEmail,
          userAgent,
          deviceInfo,
          pushToken: token // Store the actual push token too
        }
      })
      console.log('✅ Salvo no banco:', response)
    } catch (error: any) {
      console.error('❌ Erro salvando no banco:', error.message)
      throw error
    }
  }

  const listenForMessages = () => {
    if (!import.meta.client) return

    // OneSignal handles foreground notifications automatically
    window.OneSignalDeferred?.push(function(OneSignal: any) {
      OneSignal.Notifications.addEventListener('click', (event: any) => {
        console.log('Notification clicked:', event)
      })
    })
  }

  return {
    requestPermissionAndSave,
    listenForMessages
  }
}
