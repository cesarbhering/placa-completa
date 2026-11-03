import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAnalytics, hashEmailSha256, normalizarEmail, trackConversaoPixGerado, _limparConversoesReportadas } from './useAnalytics'

// Enhanced conversions (Google Ads + UET) e conversao secundaria "Pix gerado".
// E-mail ficticio; o vetor e o sha256 de "teste@exemplo.com".
const HASH_TESTE = '44666ae053e9c2e7e0816335b17c75c077834cc2da72c5ce72490de64adc4428'

function ambiente(publico: Record<string, any> = {}) {
  vi.unstubAllGlobals()
  _limparConversoesReportadas()
  const w: any = globalThis.window
  w.gtag = vi.fn(); w.fbq = vi.fn(); w.uetq = { push: vi.fn() }
  const store = new Map<string, string>()
  const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } }
  vi.stubGlobal('localStorage', fake)
  vi.stubGlobal('sessionStorage', fake)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { gated: false, ...publico } }))
  return w
}

describe('hash do e-mail', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('normaliza (trim + minusculas) e e deterministico (vetor conhecido)', async () => {
    expect(normalizarEmail('  Teste@Exemplo.COM ')).toBe('teste@exemplo.com')
    expect(normalizarEmail('sem-arroba')).toBeNull()
    const a = await hashEmailSha256('  Teste@Exemplo.COM ')
    const b = await hashEmailSha256('teste@exemplo.com')
    expect(a).toBe(b)
    expect(a).toBe(HASH_TESTE)
    // sha256("abc"), vetor oficial do NIST, prova o encoder hex
    const abc = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc'))
    expect(Array.from(new Uint8Array(abc)).map((x) => x.toString(16).padStart(2, '0')).join(''))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(await hashEmailSha256('a@b.c')).toBe(await hashEmailSha256('A@B.C'))
  })

  it('sem crypto.subtle: nao gera hash', async () => {
    vi.stubGlobal('crypto', {})
    expect(await hashEmailSha256('teste@exemplo.com')).toBeNull()
  })
})

describe('enhanced conversions na compra', () => {
  it('com e-mail: user_data com o hash ANTES da conversao, UET com pid.em, e-mail nunca em claro', async () => {
    const w = ambiente()
    const esperado = await hashEmailSha256('teste@exemplo.com')
    await useAnalytics().trackConversionPaga('tok_ec_1', 'completa', 4490, undefined, { email: ' Teste@Exemplo.com' })
    const chamadas = w.gtag.mock.calls
    expect(chamadas[0]).toEqual(['set', 'user_data', { sha256_email_address: esperado }])
    expect(chamadas[1][0]).toBe('event')
    expect(chamadas[1][1]).toBe('conversion')
    expect(w.uetq.push.mock.calls[0]).toEqual(['set', { pid: { em: esperado } }])
    expect(w.uetq.push.mock.calls[1][1]).toBe('purchase')
    expect(JSON.stringify([chamadas, w.uetq.push.mock.calls, w.fbq.mock.calls]).toLowerCase()).not.toContain('teste@exemplo')
  })

  it('hash pronto do servidor: usa direto, sincrono', () => {
    const w = ambiente()
    useAnalytics().trackConversionPaga('tok_ec_2', 'completa', 4490, undefined, { emailSha256: HASH_TESTE })
    expect(w.gtag.mock.calls[0]).toEqual(['set', 'user_data', { sha256_email_address: HASH_TESTE }])
    expect(w.gtag).toHaveBeenCalledWith('event', 'conversion', expect.objectContaining({ transaction_id: 'tok_ec_2' }))
  })

  it('sem e-mail: nada de user_data nem pid', () => {
    const w = ambiente()
    useAnalytics().trackConversionPaga('tok_ec_3', 'completa', 4490, undefined, { email: '', emailSha256: null })
    expect(w.gtag.mock.calls.some((c: any[]) => c[0] === 'set')).toBe(false)
    expect(w.uetq.push.mock.calls.some((c: any[]) => c[0] === 'set')).toBe(false)
    expect(w.gtag).toHaveBeenCalledWith('event', 'conversion', expect.anything())
  })

  it('hash invalido do servidor e ignorado', () => {
    const w = ambiente()
    useAnalytics().trackConversionPaga('tok_ec_4', 'completa', 4490, undefined, { emailSha256: 'nao-e-hash' })
    expect(w.gtag.mock.calls.some((c: any[]) => c[0] === 'set')).toBe(false)
  })

  it('com e-mail, dedupe por token continua: segunda chamada nao dispara', async () => {
    const w = ambiente()
    const a = useAnalytics()
    await a.trackConversionPaga('tok_ec_5', 'completa', 4490, undefined, { email: 'teste@exemplo.com' })
    await a.trackConversionPaga('tok_ec_5', 'completa', 4490, undefined, { email: 'teste@exemplo.com' })
    expect(w.gtag.mock.calls.filter((c: any[]) => c[1] === 'conversion')).toHaveLength(1)
  })
})

describe('conversao secundaria Pix gerado', () => {
  const LABEL = 'AW-000/rotulo-de-teste'

  it('dispara uma vez por pedido com value 0, BRL e transaction_id', () => {
    const w = ambiente({ awPixGeradoSendTo: LABEL })
    expect(trackConversaoPixGerado('tok_pix_1')).toBe(true)
    expect(trackConversaoPixGerado('tok_pix_1')).toBe(false)
    expect(w.gtag).toHaveBeenCalledTimes(1)
    expect(w.gtag).toHaveBeenCalledWith('event', 'conversion', { send_to: LABEL, value: 0, currency: 'BRL', transaction_id: 'tok_pix_1' })
  })

  it('dedupe sobrevive a nova sessao via localStorage', () => {
    const w = ambiente({ awPixGeradoSendTo: LABEL })
    trackConversaoPixGerado('tok_pix_2')
    _limparConversoesReportadas()
    expect(trackConversaoPixGerado('tok_pix_2')).toBe(false)
    expect(w.gtag).toHaveBeenCalledTimes(1)
  })

  it('label vazio: nao dispara nem marca o pedido', () => {
    const w = ambiente({ awPixGeradoSendTo: '' })
    expect(trackConversaoPixGerado('tok_pix_3')).toBe(false)
    expect(w.gtag).not.toHaveBeenCalled()
    expect(globalThis.localStorage.getItem('pc_conv_pix_tok_pix_3')).toBeNull()
  })

  it('nao interfere na dedupe da compra do mesmo token', () => {
    const w = ambiente({ awPixGeradoSendTo: LABEL })
    trackConversaoPixGerado('tok_pix_4')
    useAnalytics().trackConversionPaga('tok_pix_4', 'completa', 4490)
    expect(w.gtag.mock.calls.filter((c: any[]) => c[1] === 'conversion')).toHaveLength(2)
  })

  it('homolog/staging (gated): nao dispara', () => {
    const w = ambiente({ awPixGeradoSendTo: LABEL, gated: true })
    expect(trackConversaoPixGerado('tok_pix_5')).toBe(false)
    expect(w.gtag).not.toHaveBeenCalled()
  })
})
