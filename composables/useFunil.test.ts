import { describe, it, expect, beforeEach, vi } from 'vitest'
import { enfileirarEventoFunil, enviarFunil, _filaFunil, _limparFilaFunil, idDaSessao } from './useAnalytics'

// O enfileirador e a metade client do funil: ele decide o que SAI do navegador.
// Allowlist errada aqui significa dado fora do contrato chegando no banco;
// lote errado significa uma requisicao por clique.
function comStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
  })
  return store
}

describe('enfileirador do funil', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    _limparFilaFunil()
    comStorage()
  })

  it('evento fora da allowlist nao entra na fila', () => {
    enfileirarEventoFunil('purchase')
    enfileirarEventoFunil('form_start')
    expect(_filaFunil().length).toBe(0)
  })

  it('evento da allowlist entra com sessao e origem preenchidas', () => {
    enfileirarEventoFunil('resultado_exibido', { placa: 'ABC1D23' })
    const [e] = _filaFunil()
    expect(e.evento).toBe('resultado_exibido')
    expect(e.placa).toBe('ABC1D23')
    expect(typeof e.sessao).toBe('string')
  })

  it('a sessao e a mesma na aba inteira', () => {
    const primeira = idDaSessao()
    expect(idDaSessao()).toBe(primeira)
    enfileirarEventoFunil('cta_completa_visto')
    expect(_filaFunil()[0].sessao).toBe(primeira)
  })

  it('manda em lote: varios eventos numa requisicao so', () => {
    const beacon = vi.fn(() => true)
    vi.stubGlobal('navigator', { sendBeacon: beacon })
    comStorage()
    enfileirarEventoFunil('resultado_exibido')
    enfileirarEventoFunil('leilao_sinal_visto')
    enfileirarEventoFunil('cta_completa_visto')
    enviarFunil()
    expect(beacon).toHaveBeenCalledTimes(1)
    expect(_filaFunil().length).toBe(0)
  })

  it('nunca manda mais de 10 eventos por requisicao', () => {
    const beacon = vi.fn(() => true)
    vi.stubGlobal('navigator', { sendBeacon: beacon })
    comStorage()
    for (let i = 0; i < 14; i++) enfileirarEventoFunil('cta_completa_click')
    enviarFunil()
    expect(_filaFunil().length).toBe(4)
  })

  it('fila vazia nao gera requisicao', () => {
    const beacon = vi.fn(() => true)
    vi.stubGlobal('navigator', { sendBeacon: beacon })
    enviarFunil()
    expect(beacon).not.toHaveBeenCalled()
  })

  it('sendBeacon indisponivel cai no fetch com keepalive, sem quebrar a pagina', () => {
    const fetchMock = vi.fn(() => Promise.resolve({} as any))
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('fetch', fetchMock)
    comStorage()
    enfileirarEventoFunil('pix_gerado')
    expect(() => enviarFunil()).not.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0] as any)[1].keepalive).toBe(true)
  })

  it('nada identificavel entra na fila pelo caminho normal', () => {
    enfileirarEventoFunil('email_informado', { extra: { onde: 'checkout' } })
    const json = JSON.stringify(_filaFunil())
    expect(json).not.toMatch(/@/)
  })
})
