export const useAppMode = () => {
  const isPWA = ref(false)
  const isMobile = ref(false)

  if (import.meta.client) {
    onMounted(() => {
      // Check if app is in standalone mode (PWA)
      isPWA.value = window.matchMedia('(display-mode: standalone)').matches ||
                    (window.navigator as any).standalone === true ||
                    document.referrer.includes('android-app://')

      // Check if device is mobile
      isMobile.value = window.matchMedia('(max-width: 768px)').matches
    })
  }

  return {
    isPWA,
    isMobile
  }
}
