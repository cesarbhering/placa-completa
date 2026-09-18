import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'

// Esta deteccao decide se a pessoa ve Pix ou o botao da loja. Um falso
// positivo esconde o Pix de quem esta no navegador; um falso negativo mostra
// Pix dentro do app, que e justamente o que a Google proibe.
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('onMounted', () => {})

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

  it('TWA antigo continua PWA e NAO vira Capacitor: la a compra segue no Pix', () => {
    comAmbiente({ referrer: 'android-app://br.com.placacompleta' })
    const { isPWA, isCapacitor, isApp } = useAppMode()
    expect(isPWA.value).toBe(true)
    expect(isCapacitor.value).toBe(false)
    expect(isApp.value).toBe(true)
  })
})
