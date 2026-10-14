import { describe, expect, it } from 'vitest'
import { ehRevendaFrota, sanearRevendaFrota, textoPrecoVsFipe, textoStatusRevenda } from './revenda-frota'

const bruta = (d: any = {}) => ({ fonte: 'frota_lpl', fonte_tipo: 'revenda_frota', nivel: 'confirmado', data_leilao: '2026-07-22', detalhes: { tipo_evento: 'revenda_frota', status: 'disponivel', km: 41700, condicao: 'Capô e 2 para-lamas repintados', video_url: 'https://www.youtube.com/watch?v=abc', pct_vs_fipe: -12, faixa_fipe: 'abaixo', ...d } })

describe('revenda de frota', () => {
  it('reconhece pela fonte_tipo ou pelo tipo_evento', () => {
    expect(ehRevendaFrota(bruta())).toBe(true)
    expect(ehRevendaFrota({ fonte_tipo: 'privado', detalhes: { tipo_evento: 'revenda_frota' } })).toBe(true)
    expect(ehRevendaFrota({ fonte_tipo: 'detran' })).toBe(false)
  })
  it('saneia: video so com o carro disponivel e so YouTube', () => {
    const r = sanearRevendaFrota(bruta())!
    expect(r).toMatchObject({ data: '2026-07-22', status: 'disponivel', km: 41700, pctVsFipe: -12, faixaFipe: 'abaixo', videoUrl: 'https://www.youtube.com/watch?v=abc' })
    expect(sanearRevendaFrota(bruta({ status: 'saiu_do_estoque', saiu_em: '2026-09-03' }))!.videoUrl).toBeNull()
    expect(sanearRevendaFrota(bruta({ video_url: 'https://site.com/v' }))!.videoUrl).toBeNull()
  })
  it('preco vs FIPE so em %, nunca R$', () => {
    expect(textoPrecoVsFipe({ pctVsFipe: -12, faixaFipe: 'abaixo' })).toBe('anunciado 12% abaixo da FIPE')
    expect(textoPrecoVsFipe({ pctVsFipe: 3.4, faixaFipe: 'acima' })).toBe('anunciado 3,4% acima da FIPE')
    expect(textoPrecoVsFipe({ pctVsFipe: 0.2, faixaFipe: 'na_fipe' })).toBe('anunciado pelo valor da FIPE')
    expect(textoPrecoVsFipe({ pctVsFipe: null, faixaFipe: 'abaixo' })).toBe('anunciado abaixo da FIPE')
    expect(textoPrecoVsFipe({ pctVsFipe: null, faixaFipe: null })).toBeNull()
  })
  it('status', () => {
    expect(textoStatusRevenda(sanearRevendaFrota(bruta())!)).toBe('Ainda anunciado à venda')
    expect(textoStatusRevenda(sanearRevendaFrota(bruta({ status: 'saiu_do_estoque', saiu_em: '2026-09-03' }))!)).toBe('Saiu do estoque em 03/09/2026 (provável venda)')
  })
})
