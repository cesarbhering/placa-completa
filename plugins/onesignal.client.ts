import { analyticsAtivo } from '~/shared/analytics-tags'
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return
  // Homolog/staging ou host fora da producao: nenhuma tag (shared/analytics-tags.ts).
  if (!analyticsAtivo(useRuntimeConfig().public.gated, window.location.hostname)) return

  const init = () => {
    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.defer = true
    document.head.appendChild(script)

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
  }

  // Defer until the browser is idle so OneSignal's SW registration doesn't
  // compete with vite-pwa's /sw.js during the critical render path. Fallback
  // to setTimeout for browsers without requestIdleCallback (Safari).
  const ric: any = (window as any).requestIdleCallback
  if (typeof ric === 'function') {
    ric(init, { timeout: 4000 })
  } else {
    setTimeout(init, 2500)
  }

  return {
    provide: {
      oneSignal: true
    }
  }
})
