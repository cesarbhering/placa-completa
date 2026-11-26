import {
  PAGINA_CHECKOUT,
  criarEmissorPresenca,
  idPresencaValido,
  normalizarCaminho,
  novoIdPresenca,
  type PaginaPresenca,
} from '~/shared/presenca'

// "Agora no site" on the office TV: while this tab is visible it says which
// page it is on, every 30 s and on each route change (rules in
// shared/presenca.ts, endpoint in server/api/presenca).
//
// What leaves the browser: a random id for this tab (sessionStorage, a key of
// its own, never sent with anything else) and the page reduced to its route
// pattern, without cookies or Referer. Fire and forget: fetch keepalive, nothing
// awaited, every step in try/catch, and the first send waits until the browser
// is idle after the page loads.
//
// The checkout is only READ: while its overlay is on screen (.pic-overlay, the
// root of components/PremiumInlineCheckout.vue) the page counts as
// "checkout". No checkout code runs or changes because of this file.

const CHAVE_ID = 'pc_presenca'
const URL_PRESENCA = '/api/presenca'

function idDaAba(): string {
  try {
    const salvo = sessionStorage.getItem(CHAVE_ID)
    if (idPresencaValido(salvo)) return salvo
    const novo = novoIdPresenca()
    sessionStorage.setItem(CHAVE_ID, novo)
    return novo
  } catch {
    // Storage blocked: one id for this page load.
    return novoIdPresenca()
  }
}

// fetch, not sendBeacon (rev-804): a beacon carries the cookies and the full page URL in its Referer, and
// the URL of a report holds its token. Here: no cookie, no Referer, nothing cached.
const PEDIDO: RequestInit = {
  method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
}

function enviar(corpo: string) {
  try {
    void fetch(URL_PRESENCA, { ...PEDIDO, body: corpo, keepalive: true }).catch(() => {})
  } catch {
    try {
      void fetch(URL_PRESENCA, { ...PEDIDO, body: corpo }).catch(() => {})       // a browser without keepalive
    } catch {
      // Measuring never breaks a page.
    }
  }
}

export default defineNuxtPlugin({
  name: 'presenca',
  parallel: true,
  setup(nuxtApp) {
    try {
      const router = useRouter()
      const visivel = () => document.visibilityState === 'visible'
      const pagina = (): PaginaPresenca => {
        try {
          if (document.querySelector('.pic-overlay')) return PAGINA_CHECKOUT
        } catch {
          // Falls back to the route.
        }
        return normalizarCaminho(router.currentRoute.value.path)
      }
      const emissor = criarEmissorPresenca({ id: idDaAba(), pagina, enviar, visivel })

      // Nothing is sent before the first idle moment after the page loads;
      // route changes before that are covered by the first send itself.
      let iniciado = false
      const cutucar = () => {
        if (iniciado) emissor.cutucar()
      }
      router.afterEach(cutucar)
      document.addEventListener('visibilitychange', () => (visivel() ? cutucar() : emissor.parar()))
      addEventListener('pageshow', cutucar)
      addEventListener('pagehide', () => emissor.parar())

      nuxtApp.hook('app:mounted', () => {
        const comecar = () => {
          iniciado = true
          emissor.cutucar()
        }
        try {
          if (typeof requestIdleCallback === 'function') requestIdleCallback(comecar, { timeout: 5000 })
          else setTimeout(comecar, 3000)
        } catch {
          // No first send: the site is exactly the same without presence.
        }
      })
    } catch {
      // Presence is optional: without it the site is exactly the same.
    }
  },
})
