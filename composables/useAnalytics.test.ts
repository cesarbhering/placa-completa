import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reivindicarConversao, _limparConversoesReportadas, EVENTOS_META } from './useAnalytics'

// A regra que impede a MESMA compra de virar duas conversoes no Ads/GA4.
// Bug real: 30 purchases pra 17 begin_checkout num dia so.
function comStorage(quebrado = false) {
  const store = new Map<string, string>()
  const fake = quebrado
    ? { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') } }
    : { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } }
  vi.stubGlobal('localStorage', fake)
  vi.stubGlobal('sessionStorage', fake)
  return store
}

describe('reivindicarConversao', () => {
  beforeEach(() => { vi.unstubAllGlobals(); _limparConversoesReportadas() })

  it('so a primeira chamada do token reporta, o poll insistindo nao duplica', () => {
    comStorage()
    expect(reivindicarConversao('tok_1')).toBe(true)
    for (let i = 0; i < 5; i++) expect(reivindicarConversao('tok_1')).toBe(false)
  })

  it('storage quebrado (modo privado) nao vira conversao repetida', () => {
    comStorage(true)
    expect(reivindicarConversao('tok_2')).toBe(true)
    expect(reivindicarConversao('tok_2')).toBe(false)
    expect(reivindicarConversao('tok_2')).toBe(false)
  })

  it('marca ja gravada de uma visita anterior barra o reload', () => {
    const store = comStorage()
    store.set('pc_conv_tok_3', '1')
    expect(reivindicarConversao('tok_3')).toBe(false)
  })

  it('grava nos dois storages pra sobreviver ao reload', () => {
    const store = comStorage()
    reivindicarConversao('tok_4')
    expect(store.get('pc_conv_tok_4')).toBe('1')
  })

  it('token diferente e compra diferente', () => {
    comStorage()
    expect(reivindicarConversao('tok_5')).toBe(true)
    expect(reivindicarConversao('tok_6')).toBe(true)
  })

  it('sem token nao reporta nada', () => {
    comStorage()
    expect(reivindicarConversao('')).toBe(false)
  })
})

describe('espelho de eventos no Pixel da Meta', () => {
  it('so as quatro etapas do funil viram evento de remarketing', () => {
    expect(Object.keys(EVENTOS_META).sort()).toEqual(
      ['consulta_success', 'pix_gerado', 'premium_checkout_open', 'purchase'],
    )
  })

  it('usa os nomes que a Meta entende, nao os nossos', () => {
    expect(EVENTOS_META.consulta_success).toBe('Search')
    expect(EVENTOS_META.premium_checkout_open).toBe('InitiateCheckout')
    expect(EVENTOS_META.pix_gerado).toBe('AddPaymentInfo')
    expect(EVENTOS_META.purchase).toBe('Purchase')
  })

  it('nenhum evento com dado de veiculo ou de pessoa entra no mapa', () => {
    // Estes existem no site e NAO podem virar publico: um leva placa junto, os
    // outros so dizem que a pessoa clicou em alguma coisa.
    for (const fora of ['vehicle_data_shared', 'share_whatsapp', 'pwa_email_saved', 'form_start']) {
      expect(EVENTOS_META[fora]).toBeUndefined()
    }
  })
})
