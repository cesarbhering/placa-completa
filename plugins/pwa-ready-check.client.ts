/**
 * PWA Ready Check Plugin
 * Keeps loading screen active until Service Worker is ready
 * Prevents flicker during auto-update by hiding reload behind loading screen
 */
export default defineNuxtPlugin(() => {
  // Create global state to signal when PWA is ready
  const pwaReady = useState('pwaReady', () => false)

  if ('serviceWorker' in navigator) {
    let checkComplete = false

    // Listen for controlling SW changes (happens during auto-update)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // New SW took control - page will reload soon (autoUpdate behavior)
      // Keep loading screen active during reload to hide flicker
      console.log('[PWA] Service Worker updated, page will reload')
    })

    // Register and check SW status
    navigator.serviceWorker.register('/sw.js').then(registration => {
      // If there's already an active SW, we're ready
      if (navigator.serviceWorker.controller) {
        checkComplete = true
        pwaReady.value = true
        console.log('[PWA] Service Worker already active, ready to show app')
        return
      }

      // Wait for SW to activate
      if (registration.installing) {
        console.log('[PWA] Service Worker installing, waiting for activation')
        registration.installing.addEventListener('statechange', function(this: ServiceWorker) {
          if (this.state === 'activated') {
            checkComplete = true
            pwaReady.value = true
            console.log('[PWA] Service Worker activated, ready to show app')
          }
        })
      } else if (registration.waiting) {
        console.log('[PWA] Service Worker waiting, triggering activation')
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      } else if (registration.active) {
        checkComplete = true
        pwaReady.value = true
        console.log('[PWA] Service Worker active, ready to show app')
      }
    }).catch(error => {
      console.error('[PWA] Service Worker registration failed:', error)
      // On error, allow app to show anyway
      checkComplete = true
      pwaReady.value = true
    })

    // Safety timeout: if SW check takes too long, show app anyway
    // This prevents infinite loading if something goes wrong
    setTimeout(() => {
      if (!checkComplete) {
        console.warn('[PWA] Service Worker check timeout, showing app anyway')
        pwaReady.value = true
      }
    }, 3000)
  } else {
    // No Service Worker support, show app immediately
    pwaReady.value = true
  }
})
