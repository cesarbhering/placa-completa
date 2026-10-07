import { describe, it, expect } from 'vitest'
import { sanearFotos, sanearHistorico } from './historico-leilao'

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

describe('sanearHistorico com notificacao', () => {
  it('fixa a gravidade em cinza mesmo quando a API antiga manda patio amarelo', () => {
    const h = sanearHistorico({
      resumo: { n_confirmado: 1 },
      passagens: [{
        nivel: 'confirmado', fonte: 'detran_rj', fonte_tipo: 'detran', fonte_uf: 'RJ', situacao: 'notificado',
        detalhes: { situacao: 'notificado', tipo_registro: 'notificacao_leilao' },
        edital_disponivel: true, edital_ref: '123.abcdef012345',
        gravidade: { nivel: 'patio', cor: 'amarelo', rotulo: 'Leilão de pátio (DETRAN)', motivo: 'x' },
      }, {
        nivel: 'confirmado', fonte: 'detran_sp', fonte_tipo: 'detran', fonte_uf: 'SP', situacao: 'SUCATA',
        gravidade: { nivel: 'sucata', cor: 'vermelho', rotulo: 'Sucata / irrecuperável', motivo: 'y' },
      }],
    })!
    expect(h.passagens[0].gravidade).toMatchObject({ nivel: 'notificado', cor: 'cinza' })
    expect(h.passagens[1].gravidade).toMatchObject({ nivel: 'sucata', cor: 'vermelho' })
    // Edital de notificacao nunca e baixavel.
    expect(h.passagens[0].edital_disponivel).toBe(false)
    expect(h.passagens[0].edital_ref).toBeNull()
  })
})

describe('edital de leilao judicial de casa privada (07/out)', () => {
  it('passa quando a API marca disponivel; casa privada sem marca continua sem', () => {
    const h = sanearHistorico({
      resumo: { n_confirmado: 2 },
      passagens: [{
        nivel: 'confirmado', fonte: 'superbid', fonte_tipo: 'privado', comitente: 'Tribunal de Justiça do Estado de São Paulo',
        edital_disponivel: true, edital_ref: '77.abcdef012345',
      }, {
        nivel: 'confirmado', fonte: 'copart', fonte_tipo: 'privado', edital_disponivel: false, edital_ref: null,
      }],
    })!
    expect(h.passagens[0]).toMatchObject({ edital_disponivel: true, edital_ref: '77.abcdef012345' })
    expect(h.passagens[1]).toMatchObject({ edital_disponivel: false, edital_ref: null })
  })
})
