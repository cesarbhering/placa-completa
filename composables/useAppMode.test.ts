import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'

// Esta deteccao decide se a pessoa ve Pix ou o botao da loja. Um falso
// positivo esconde o Pix de quem esta no navegador; um falso negativo mostra
// Pix dentro do app, que e justamente o que a Google proibe.
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('onMounted', () => {})
// No teste a pagina esta "no navegador" (happy-dom), entao o ramo de SSR nao
// roda; o stub existe so pra ele nao explodir caso alguem mude a ordem.
vi.stubGlobal('useRequestHeaders', () => ({}))

const { useAppMode } = await import('./useAppMode')

function comAmbiente({ ua = 'Mozilla/5.0', capacitor = null as any, standalone = false, referrer = '' } = {}) {
  vi.spyOn(window, 'matchMedia').mockImplementation(((q: string) => ({
    matches: q.includes('display-mode') ? standalone : false,
    addEventListener: () => {},
  })) as any)
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
  Object.defineProperty(document, 'referrer', { value: referrer, configurable: true })
  ;(window as any).Capacitor = capacitor
}

describe('useAppMode', () => {
  beforeEach(() => { comAmbiente() })

  it('navegador comum nao e app: o Pix continua na tela', () => {
    const { isCapacitor, isApp } = useAppMode()
    expect(isCapacitor.value).toBe(false)
    expect(isApp.value).toBe(false)
  })

  it('bridge do Capacitor presente marca app nativo', () => {
    comAmbiente({ capacitor: { isNativePlatform: () => true } })
    expect(useAppMode().isCapacitor.value).toBe(true)
  })

  it('marcador no user-agent vale mesmo antes do bridge carregar', () => {
    comAmbiente({ ua: 'Mozilla/5.0 (Linux; Android 14) PlacaCompletaApp/3' })
    expect(useAppMode().isCapacitor.value).toBe(true)
  })

  it('Capacitor rodando na web (isNativePlatform false) nao vira app', () => {
    comAmbiente({ capacitor: { isNativePlatform: () => false } })
    expect(useAppMode().isCapacitor.value).toBe(false)
  })

  // A consulta gratis dentro do app precisa do modo PWA: e ele que pede
  // e-mail, mostra o chassi completo e entrega na tela, como o app antigo ja
  // fazia. Sem isto o app novo caia no fluxo do site.
  it('app novo (UA do Capacitor) entra em modo PWA sem deixar de ser Capacitor', () => {
    comAmbiente({ ua: 'Mozilla/5.0 (Linux; Android 14) PlacaCompletaApp/3' })
    const { isPWA, isCapacitor, isApp } = useAppMode()
    expect(isPWA.value).toBe(true)
    expect(isCapacitor.value).toBe(true)
    expect(isApp.value).toBe(true)
  })

  it('bridge nativo tambem liga o modo PWA', () => {
    comAmbiente({ capacitor: { isNativePlatform: () => true } })
    expect(useAppMode().isPWA.value).toBe(true)
  })

  it('navegador comum nao entra em modo PWA por acidente', () => {
    const { isPWA, isCapacitor } = useAppMode()
    expect(isPWA.value).toBe(false)
    expect(isCapacitor.value).toBe(false)
  })

  it('standalone sem marcador do app e PWA, mas nao e Capacitor', () => {
    comAmbiente({ standalone: true })
    const { isPWA, isCapacitor } = useAppMode()
    expect(isPWA.value).toBe(true)
    expect(isCapacitor.value).toBe(false)
  })

  it('TWA antigo continua PWA e NAO vira Capacitor: la a compra segue no Pix', () => {
    comAmbiente({ referrer: 'android-app://br.com.placacompleta' })
    const { isPWA, isCapacitor, isApp } = useAppMode()
    expect(isPWA.value).toBe(true)
    expect(isCapacitor.value).toBe(false)
    expect(isApp.value).toBe(true)
  })
})

describe('fluxoLegado (fluxo antigo da home)', () => {
  beforeEach(() => { try { sessionStorage.clear() } catch {} ; comAmbiente() })
  it('so o TWA antigo (referrer android-app://) fica no fluxo antigo, mesmo navegando depois', () => {
    comAmbiente({ referrer: 'android-app://br.com.placacompleta/' })
    expect(useAppMode().fluxoLegado.value).toBe(true)
    comAmbiente({ referrer: 'https://placacompleta.com.br/' })
    expect(useAppMode().fluxoLegado.value).toBe(true)
  })
  it('app novo (Capacitor) e PWA instalado pelo navegador usam o bloco do site', () => {
    comAmbiente({ ua: 'Mozilla/5.0 PlacaCompletaApp/3' })
    expect(useAppMode().fluxoLegado.value).toBe(false)
    comAmbiente({ standalone: true })
    const m = useAppMode()
    expect(m.isPWA.value).toBe(true)
    expect(m.fluxoLegado.value).toBe(false)
  })
})
