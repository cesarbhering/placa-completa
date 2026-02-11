export const usePWA = () => {
  const isPWA = ref(false)
  const isMobile = ref(false)

  onMounted(() => {
    // Check if app is in standalone mode (PWA)
    isPWA.value = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true ||
                  document.referrer.includes('android-app://')

    // Check if device is mobile
    isMobile.value = window.matchMedia('(max-width: 768px)').matches
  })

  return {
    isPWA: readonly(isPWA),
    isMobile: readonly(isMobile)
  }
}
