/**
 * Em que casca a pagina esta rodando.
 *
 * - isPWA: instalada na tela inicial (display-mode standalone) ou aberta pelo
 *   app Android antigo (TWA, que chega com referrer android-app://).
 * - isCapacitor: rodando DENTRO do app novo, que carrega o site numa WebView
 *   nativa. So aqui existe Google Play Billing, e so aqui o Pix some.
 * - isApp: qualquer uma das duas cascas de app.
 *
 * A deteccao do Capacitor tem duas pernas de proposito. `window.Capacitor` e a
 * fonte certa, mas ela so existe depois do bridge nativo carregar, e a
 * primeira pintura da tela pode acontecer antes disso. O marcador no
 * user-agent (PlacaCompletaApp/3), que o app injeta, chega junto com a
 * requisicao e nunca perde essa corrida. Se uma das duas disser que e app,
 * e app.
 */

/** Marca que o app injeta no user-agent. Combinado com o time do app. */
const MARCADOR_APP = 'PlacaCompletaApp'

// `import.meta.client` e a flag do Nuxt (false no SSR). Fora do Nuxt, num
// teste unitario, ela nem existe — e ai a pergunta certa e se ha window.
const noNavegador = () => import.meta.client ?? (typeof window !== 'undefined')

export const useAppMode = () => {
  const isPWA = ref(false)
  const isMobile = ref(false)
  const isCapacitor = ref(false)

  function detectarCapacitor(): boolean {
    if (!noNavegador()) return false
    const nativo = (window as any).Capacitor
    if (typeof nativo?.isNativePlatform === 'function' && nativo.isNativePlatform()) return true
    return String(window.navigator?.userAgent || '').includes(MARCADOR_APP)
  }

  if (noNavegador()) {
    // Detect IMMEDIATELY (synchronously) to prevent flicker
    // This runs during composable initialization, before onMounted
    isPWA.value = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true ||
                  document.referrer.includes('android-app://')

    isMobile.value = window.matchMedia('(max-width: 768px)').matches
    isCapacitor.value = detectarCapacitor()

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

      // Rechecagem depois da montagem: se o bridge do Capacitor subiu depois da
      // primeira pintura, e aqui que ele aparece.
      if (!isCapacitor.value) isCapacitor.value = detectarCapacitor()

      mediaQuery.addEventListener('change', updatePWA)
      mobileQuery.addEventListener('change', updateMobile)
    })
  }

  // Qualquer casca de app: serve pra decisao de layout. Quem decide PAGAMENTO
  // usa isCapacitor, nunca isto — o TWA antigo continua no Pix.
  const isApp = computed(() => isPWA.value || isCapacitor.value)

  return {
    isPWA,
    isMobile,
    isCapacitor,
    isApp,
  }
}
