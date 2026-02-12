export const usePushNotifications = () => {
  const requestPermissionAndSave = async () => {
    try {
      // Wait for OneSignal to be ready
      if (!window.OneSignalDeferred) {
        return { error: 'OneSignal not loaded', success: false }
      }

      await new Promise((resolve) => {
        window.OneSignalDeferred.push(resolve)
      })

      const OneSignal = (window as any).OneSignal

      // Check if already subscribed
      const isSubscribed = await OneSignal.User.PushSubscription.optedIn
      if (isSubscribed) {
        const userId = await OneSignal.User.PushSubscription.id
        const token = await OneSignal.User.PushSubscription.token

        // Save to database even if already subscribed (sync OneSignal -> Supabase)
        if (userId) {
          try {
            await saveTokenToDatabase(userId, token || '')
          } catch (error) {
            // Continue even if save fails
          }
        }

        return { success: true, userId }
      }

      // Check if already has permission
      const currentPermission = Notification.permission
      if (currentPermission !== 'granted') {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          return { error: `Permissão: ${permission}`, success: false }
        }
      }

      // Set up event listener for subscription changes
      const subscriptionPromise = new Promise<{ id: string, token: string }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          OneSignal.User.PushSubscription.id.then((finalId: string) => {
            if (finalId) {
              resolve({ id: finalId, token: '' })
            } else {
              reject(new Error('Timeout aguardando subscription'))
            }
          })
        }, 15000)

        OneSignal.User.PushSubscription.addEventListener('change', function(event: any) {
          const id = event.current?.id
          const token = event.current?.token

          if (id) {
            clearTimeout(timeout)
            resolve({ id, token })
          }
        })
      })

      // Wait for Service Worker to be ready
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready
      }

      // Register subscription
      await OneSignal.User.PushSubscription.optIn()

      // Wait for subscription event
      const { id: subscription, token } = await subscriptionPromise

      // Save to database
      await saveTokenToDatabase(subscription, token)
      return { success: true, userId: subscription }
    } catch (error: any) {
      console.error('Error requesting notification permission:', error)
      return { error: error.message || 'Erro desconhecido', success: false }
    }
  }

  const saveTokenToDatabase = async (subscriptionId: string, token: string) => {
    try {
      const userAgent = navigator.userAgent
      const isMobile = /mobile|android|iphone/i.test(userAgent)
      const deviceInfo = isMobile ? 'Mobile' : 'Desktop'

      // Get user email from localStorage if available
      const pwaEmail = localStorage.getItem('pwa_email')
      const webEmail = localStorage.getItem('pc_email')
      const userEmail = pwaEmail || webEmail || null

      await $fetch('/api/fcm-token/save', {
        method: 'POST',
        body: {
          token: subscriptionId,
          userEmail,
          userAgent,
          deviceInfo,
          pushToken: token
        }
      })
    } catch (error: any) {
      console.error('Error saving push token:', error.message)
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
