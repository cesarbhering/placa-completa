export const useAppMode = () => {
  const isPWA = ref(false)
  const isMobile = ref(false)

  if (import.meta.client) {
    // Detect IMMEDIATELY (synchronously) to prevent flicker
    // This runs during composable initialization, before onMounted
    isPWA.value = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true ||
                  document.referrer.includes('android-app://')

    isMobile.value = window.matchMedia('(max-width: 768px)').matches

    // Listen for changes (e.g., user adds to home screen while browsing)
    onMounted(() => {
      const mediaQuery = window.matchMedia('(display-mode: standalone)')
      const mobileQuery = window.matchMedia('(max-width: 768px)')

      const updatePWA = () => {
        const newValue = mediaQuery.matches ||
                        (window.navigator as any).standalone === true ||
                        document.referrer.includes('android-app://')
        if (newValue !== isPWA.value) isPWA.value = newValue
      }

      const updateMobile = () => {
        if (mobileQuery.matches !== isMobile.value) isMobile.value = mobileQuery.matches
      }

      mediaQuery.addEventListener('change', updatePWA)
      mobileQuery.addEventListener('change', updateMobile)
    })
  }

  return {
    isPWA,
    isMobile
  }
}
