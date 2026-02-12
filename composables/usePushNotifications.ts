import { getToken, onMessage } from 'firebase/messaging'

export const usePushNotifications = () => {
  const { $messaging } = useNuxtApp()

  const requestPermissionAndSave = async () => {
    try {
      // Check if already have permission
      if (Notification.permission === 'granted') {
        return await getTokenAndSave()
      }

      // Request permission
      const permission = await Notification.requestPermission()

      if (permission === 'granted') {
        return await getTokenAndSave()
      }

      return null
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return null
    }
  }

  const getTokenAndSave = async () => {
    try {
      const token = await getToken($messaging as any, {
        vapidKey: 'BPDFWCwBESkjPyIziJvSgoU7i4zml6ZQwng9bxCsVGSAfoKM4HRCeH7WA4_3zCsyabk_I1QwnNJCP7FUKrY4lVU'
      })

      if (token) {
        // Save token to Supabase
        await saveTokenToDatabase(token)
        console.log('✅ FCM Token saved:', token)
        return token
      }

      return null
    } catch (error) {
      console.error('Error getting FCM token:', error)
      return null
    }
  }

  const saveTokenToDatabase = async (token: string) => {
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
          token,
          userEmail,
          userAgent,
          deviceInfo
        }
      })
    } catch (error) {
      console.error('Error saving FCM token to database:', error)
    }
  }

  const listenForMessages = () => {
    if (!import.meta.client) return

    onMessage($messaging as any, (payload) => {
      console.log('Foreground message received:', payload)

      const notificationTitle = payload.notification?.title || 'PlacaCompleta'
      const notificationOptions = {
        body: payload.notification?.body || 'Nova notificação',
        icon: '/pwa-192x192.png'
      }

      new Notification(notificationTitle, notificationOptions)
    })
  }

  return {
    requestPermissionAndSave,
    listenForMessages
  }
}
