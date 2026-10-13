/**
 * Em que casca a pagina esta rodando.
 *
 * - isPWA: instalada na tela inicial (display-mode standalone), aberta pelo
 *   app Android antigo (TWA, que chega com referrer android-app://) ou rodando
 *   dentro do app novo. A WebView do Capacitor nao passa em nenhuma das tres
 *   checagens classicas, entao sem esta ultima perna o app novo caia no fluxo
 *   do site: sem e-mail pedido, chassi mascarado, modal de seguro. A consulta
 *   gratis dentro do app tem que se comportar como o app antigo.
 * - isCapacitor: rodando DENTRO do app novo, que carrega o site numa WebView
 *   nativa. So aqui existe Google Play Billing, e so aqui o Pix some.
 * - isApp: qualquer uma das duas cascas de app.
 *
 * No servidor a deteccao e so uma: o marcador no user-agent da requisicao.
 * Ela existe porque a hidratacao nao conserta o que o SSR ja pintou errado.
 *
 * A deteccao do Capacitor no cliente tem duas pernas de proposito. `window.Capacitor` e a
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
  // App Android ANTIGO (TWA): abre com referrer android-app://. O referrer some
  // na navegacao interna, entao a marca fica na sessao.
  const isTWA = ref(false)

  function detectarCapacitor(): boolean {
    if (!noNavegador()) return false
    const nativo = (window as any).Capacitor
    if (typeof nativo?.isNativePlatform === 'function' && nativo.isNativePlatform()) return true
    return String(window.navigator?.userAgent || '').includes(MARCADOR_APP)
  }

  // No SERVIDOR o app se anuncia pelo user-agent da requisicao, e usar isso
  // aqui nao e luxo: a hidratacao do Vue em producao NAO corrige classe nem
  // `v-if` que ja vieram errados do SSR. Sem esta perna, a home do app era
  // pintada com o layout do site e so trocava no proximo re-render, que pode
  // nunca vir. Com ela, a primeira pintura ja e a do app.
  if (!noNavegador()) {
    const ua = String(useRequestHeaders(['user-agent'])['user-agent'] || '')
    if (ua.includes(MARCADOR_APP)) {
      isCapacitor.value = true
      isPWA.value = true
      isMobile.value = true
    }
  }

  if (noNavegador()) {
    // Detect IMMEDIATELY (synchronously) to prevent flicker
    // This runs during composable initialization, before onMounted
    isMobile.value = window.matchMedia('(max-width: 768px)').matches
    isCapacitor.value = detectarCapacitor()
    try {
      if (document.referrer.includes('android-app://')) sessionStorage.setItem('pc_twa', '1')
      isTWA.value = !isCapacitor.value && sessionStorage.getItem('pc_twa') === '1'
    } catch {
      isTWA.value = !isCapacitor.value && document.referrer.includes('android-app://')
    }

    isPWA.value = isCapacitor.value ||
                  window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true ||
                  document.referrer.includes('android-app://')

    // Listen for changes (e.g., user adds to home screen while browsing)
    onMounted(() => {
      const mediaQuery = window.matchMedia('(display-mode: standalone)')
      const mobileQuery = window.matchMedia('(max-width: 768px)')

      const updatePWA = () => {
        const newValue = isCapacitor.value ||
                        mediaQuery.matches ||
                        (window.navigator as any).standalone === true ||
                        document.referrer.includes('android-app://')
        if (newValue !== isPWA.value) isPWA.value = newValue
      }

      const updateMobile = () => {
        if (mobileQuery.matches !== isMobile.value) isMobile.value = mobileQuery.matches
      }

      // Rechecagem depois da montagem: se o bridge do Capacitor subiu depois
      // da primeira pintura, e aqui que ele aparece. E ele arrasta o isPWA
      // junto, senao a tela ficaria meio no fluxo do app e meio no do site.
      if (!isCapacitor.value) {
        isCapacitor.value = detectarCapacitor()
        if (isCapacitor.value) { isPWA.value = true; isTWA.value = false }
      }

      mediaQuery.addEventListener('change', updatePWA)
      mobileQuery.addEventListener('change', updateMobile)
    })
  }

  // Qualquer casca de app: serve pra decisao de layout. Quem decide PAGAMENTO
  // usa isCapacitor, nunca isto — o TWA antigo continua no Pix.
  const isApp = computed(() => isPWA.value || isCapacitor.value)

  /**
   * Fluxo antigo da home (pede e-mail, resultado numa janela, sem oferta): so
   * o TWA antigo da Play. O app novo (Capacitor) usa o bloco do site com
   * Google Play; o PWA instalado pelo navegador e o proprio site, com Pix.
   */
  const fluxoLegado = computed(() => isTWA.value && !isCapacitor.value)

  return {
    isPWA,
    isMobile,
    isCapacitor,
    isApp,
    isTWA,
    fluxoLegado,
  }
}
