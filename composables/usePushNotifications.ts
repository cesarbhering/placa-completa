export const usePushNotifications = () => {
  const requestPermissionAndSave = async () => {
    try {
      // Wait for OneSignal to be ready
      if (!window.OneSignalDeferred) {
        console.error('OneSignal not loaded')
        return null
      }

      await new Promise((resolve) => {
        window.OneSignalDeferred.push(resolve)
      })

      const OneSignal = (window as any).OneSignal

      // Check if already subscribed
      const isSubscribed = await OneSignal.User.PushSubscription.optedIn

      if (isSubscribed) {
        const userId = await OneSignal.User.PushSubscription.id
        console.log('✅ Already subscribed, User ID:', userId)
        return userId
      }

      // Use native browser permission prompt (in system language - Portuguese)
      const permission = await Notification.requestPermission()

      if (permission !== 'granted') {
        console.log('Permission denied')
        return null
      }

      // After permission granted, let OneSignal register the subscription
      await OneSignal.User.PushSubscription.optIn()

      // Wait a bit for subscription to complete
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Get subscription info
      const subscription = await OneSignal.User.PushSubscription.id
      const token = await OneSignal.User.PushSubscription.token

      if (subscription) {
        // Save to database
        await saveTokenToDatabase(subscription, token)
        console.log('✅ OneSignal subscription saved:', subscription)
        return subscription
      }

      return null
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return null
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
          pushToken: token // Store the actual push token too
        }
      })
    } catch (error) {
      console.error('Error saving subscription to database:', error)
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
