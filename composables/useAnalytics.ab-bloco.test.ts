import { describe, it, expect, beforeEach, vi } from 'vitest'
import { enfileirarEventoFunil, _filaFunil, _limparFilaFunil } from './useAnalytics'
import { AB_BLOCO_KEY } from '~/shared/ab-bloco'

// A variante precisa viajar em TODO evento da visita, nao so no clique do
// CTA: sem ela em pix_gerado, o teste mede intencao e nao venda.
function comVariante(v?: string) {
  const store = new Map<string, string>()
  if (v) store.set(AB_BLOCO_KEY, v)
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, val: string) => { store.set(k, val) },
    removeItem: (k: string) => { store.delete(k) },
  })
}

describe('carimbo da variante A/B nos eventos do funil', () => {
  beforeEach(() => { vi.unstubAllGlobals(); _limparFilaFunil() })

  it('grava extra.ab_bloco quando a variante ja foi decidida', () => {
    comVariante('A2')
    enfileirarEventoFunil('pix_gerado', { placa: 'ABC1D23', plano: 'completa' })
    expect(_filaFunil()[0]?.extra?.ab_bloco).toBe('A2')
  })

  it('preserva o extra que o chamador ja mandava', () => {
    comVariante('A')
    enfileirarEventoFunil('cta_completa_click', { extra: { origem_cta: 'bloco_bloqueado' } })
    expect(_filaFunil()[0]?.extra).toEqual({ origem_cta: 'bloco_bloqueado', ab_bloco: 'A', ab_rodada: '3' })
  })

  it('antes da decisao (evento anterior ao bloco) nao inventa variante', () => {
    comVariante()
    enfileirarEventoFunil('resultado_exibido', { placa: 'ABC1D23' })
    expect(_filaFunil()[0]?.extra).toBeNull()
  })
})
