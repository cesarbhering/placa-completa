/**
 * PWA Ready Check Plugin
 * Keeps loading screen active until Service Worker is ready (PWA only).
 * Uses navigator.serviceWorker.ready — vite-pwa already registers /sw.js,
 * so we just wait for whichever registration becomes active.
 */
export default defineNuxtPlugin(() => {
  const pwaReady = useState('pwaReady', () => false)

  if (!('serviceWorker' in navigator)) {
    pwaReady.value = true
    return
  }

  let resolved = false
  const markReady = () => {
    if (resolved) return
    resolved = true
    pwaReady.value = true
  }

  navigator.serviceWorker.ready
    .then(() => markReady())
    .catch(() => markReady())

  setTimeout(() => {
    if (!resolved) {
      console.warn('[PWA] Service Worker ready timeout, showing app anyway')
      markReady()
    }
  }, 3000)
})
