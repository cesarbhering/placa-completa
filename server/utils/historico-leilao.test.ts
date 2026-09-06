import { describe, it, expect } from 'vitest'
import { sanearFotos } from './historico-leilao'

// A allowlist e o que impede a pagina do cliente de virar hotlink do site da
// leiloeira: sem ela, bastaria a API mandar a URL de terceiro.
describe('sanearFotos', () => {
  const nosso = 'https://fotos.placacompleta.com.br/lote/1.jpg'

  it('aceita foto do nosso host', () => {
    expect(sanearFotos([nosso])).toEqual([nosso])
  })

  it('rejeita host de leiloeira, mesmo com https', () => {
    expect(sanearFotos(['https://www.superbid.net/lote/1.jpg'])).toEqual([])
    expect(sanearFotos(['https://cdn.leiloeira-x.com.br/foto.jpg'])).toEqual([])
  })

  it('rejeita http sem TLS e URL quebrada', () => {
    expect(sanearFotos(['http://fotos.placacompleta.com.br/lote/1.jpg'])).toEqual([])
    expect(sanearFotos(['nao e url', '', null, 42])).toEqual([])
  })

  it('nao cai em host que so TERMINA com o nosso dominio', () => {
    expect(sanearFotos(['https://fotos.placacompleta.com.br.evil.com/x.jpg'])).toEqual([])
    expect(sanearFotos(['https://evil.com/?x=fotos.placacompleta.com.br'])).toEqual([])
  })

  it('respeita a allowlist configurada por env', () => {
    const outro = 'https://midia.placacompleta.com.br/lote/1.jpg'
    expect(sanearFotos([outro])).toEqual([])
    expect(sanearFotos([outro], { leiloesFotosHosts: 'midia.placacompleta.com.br' })).toEqual([outro])
    expect(sanearFotos([outro, nosso], { leiloesFotosHosts: 'midia.placacompleta.com.br, fotos.placacompleta.com.br' }))
      .toEqual([outro, nosso])
  })

  it('leva no maximo tres fotos', () => {
    const muitas = [1, 2, 3, 4, 5].map((n) => `https://fotos.placacompleta.com.br/lote/${n}.jpg`)
    expect(sanearFotos(muitas)).toHaveLength(3)
  })

  it('entrada que nao e lista nao quebra', () => {
    expect(sanearFotos(undefined)).toEqual([])
    expect(sanearFotos('https://fotos.placacompleta.com.br/x.jpg')).toEqual([])
  })
})
