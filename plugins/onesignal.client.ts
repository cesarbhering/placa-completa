export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  // Load OneSignal SDK script
  const script = document.createElement('script')
  script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
  script.defer = true
  document.head.appendChild(script)

  // Initialize OneSignal
  window.OneSignalDeferred = window.OneSignalDeferred || []
  window.OneSignalDeferred.push(async function(OneSignal: any) {
    try {
      await OneSignal.init({
        appId: '9ac2bca4-3290-4cf7-b797-524616b57d4d',
        safari_web_id: 'web.onesignal.auto.3fd215f3-eebf-45ec-a840-b342bc8d8df9',
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: 'OneSignalSDKWorker.js',
        notifyButton: {
          enable: false,
        },
        allowLocalhostAsSecureOrigin: true,
      })
    } catch (error: any) {
      console.error('Error initializing OneSignal:', error.message)
    }
  })

  return {
    provide: {
      oneSignal: true
    }
  }
})
