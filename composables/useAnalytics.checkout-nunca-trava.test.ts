import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAnalytics } from './useAnalytics'

// Guarda contra o incidente de 20/09/2026: uma refatoracao removeu a funcao
// espelharNaMeta mas deixou a chamada dentro de track(). Em producao,
// trackBeginCheckout estourou ReferenceError ANTES do consultarPreview e o
// checkout ficou preso em "loading" por ~29h, com zero vendas possiveis.
//
// Regra: NENHUMA funcao de rastreio pode lancar, em nenhuma combinacao de
// ambiente (com/sem gtag, com/sem fbq, com/sem storage). Medicao nunca pode
// derrubar o fluxo de compra. Este teste chama todas elas, nos cenarios que
// existem em producao, e falha se qualquer uma jogar excecao.

const CENARIOS: Array<{ nome: string; gtag: boolean; fbq: boolean; storage: boolean }> = [
  { nome: 'navegador comum (gtag + fbq + storage)', gtag: true, fbq: true, storage: true },
  { nome: 'bloqueador de anuncio (sem gtag, sem fbq)', gtag: false, fbq: false, storage: true },
  { nome: 'so gtag (pixel da Meta nao carregou)', gtag: true, fbq: false, storage: true },
  { nome: 'so fbq (gtag bloqueado)', gtag: false, fbq: true, storage: true },
  { nome: 'modo privado (storage lanca)', gtag: true, fbq: true, storage: false },
]

function montarAmbiente(c: (typeof CENARIOS)[number]) {
  vi.unstubAllGlobals()
  const w: any = globalThis.window ?? {}
  if (c.gtag) w.gtag = vi.fn(); else delete w.gtag
  if (c.fbq) w.fbq = vi.fn(); else delete w.fbq
  const store = new Map<string, string>()
  const fake = c.storage
    ? { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } }
    : { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') }, removeItem: () => { throw new Error('bloqueado') } }
  vi.stubGlobal('localStorage', fake)
  vi.stubGlobal('sessionStorage', fake)
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))))
  if (w.navigator) w.navigator.sendBeacon = vi.fn(() => true)
}

describe('rastreio nunca derruba o checkout', () => {
  beforeEach(() => vi.unstubAllGlobals())

  for (const c of CENARIOS) {
    it(`todas as funcoes de rastreio rodam sem lancar: ${c.nome}`, () => {
      montarAmbiente(c)
      const a = useAnalytics()
      // A ordem e a do fluxo real de compra: abrir checkout -> Pix -> pago.
      expect(() => a.trackBeginCheckout('completa', 'ABC1D23')).not.toThrow()
      expect(() => a.trackAddPaymentInfo('completa', 'ABC1D23', 3990)).not.toThrow()
      expect(() => a.trackPixGerado('completa', 'ABC1D23', 3990, true)).not.toThrow()
      expect(() => a.trackConversionPaga('tok_teste', 'completa', 3990)).not.toThrow()
      expect(() => a.trackRestricaoDesconhecida('RESTRICAO_X')).not.toThrow()
      expect(() => a.track('premium_checkout_open', { plano: 'completa', leilao_sinal: 'sem_sinal' })).not.toThrow()
      expect(() => a.track('evento_qualquer_fora_da_allowlist', { x: 1 })).not.toThrow()
      expect(() => a.enfileirarEventoFunil('cta_completa_click', { placa: 'ABC1D23' })).not.toThrow()
    })
  }

  // gtag/fbq so sao chamados quando import.meta.client e true (build do Nuxt),
  // e no vitest ele e undefined; o que da pra provar aqui e que track() vai ate
  // o fim e o funil (que nao depende da flag) recebe o evento.
  it('track() executa ate o fim: o evento do funil e enfileirado depois do espelho da Meta', async () => {
    montarAmbiente(CENARIOS[0])
    const { _filaFunil, _limparFilaFunil } = await import('./useAnalytics')
    _limparFilaFunil()
    const a = useAnalytics()
    a.track('premium_checkout_open', { plano: 'completa', leilao_sinal: 'sem_sinal' })
    expect(_filaFunil().some(e => e.evento === 'premium_checkout_open')).toBe(true)
  })
})
