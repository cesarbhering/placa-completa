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
    expect(sanearFotos(muitas)).toHaveLength(4)
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

describe('pagina publica do lote (judicial sem edital entregavel, 07/out)', () => {
  const base = { nivel: 'confirmado', fonte: 'superbid', fonte_tipo: 'privado' }
  it('passa https da Superbid quando nao ha edital', () => {
    const h = sanearHistorico({ resumo: {}, passagens: [{ ...base, pagina_publica_url: 'https://www.superbid.net/oferta/4611943' }] })!
    expect(h.passagens[0].pagina_publica_url).toBe('https://www.superbid.net/oferta/4611943')
  })
  it('cai: http, host estranho, junto com edital, notificacao', () => {
    const casos = [
      { ...base, pagina_publica_url: 'http://www.superbid.net/oferta/1' },
      { ...base, pagina_publica_url: 'https://superbid.net.evil.com/oferta/1' },
      { ...base, pagina_publica_url: 'https://evil.com/?u=superbid.net' },
      { ...base, pagina_publica_url: 'javascript:alert(1)' },
      { ...base, edital_disponivel: true, edital_ref: 'x.y', pagina_publica_url: 'https://www.superbid.net/oferta/1' },
      { ...base, situacao: 'notificado', detalhes: { tipo_registro: 'notificacao_leilao' }, pagina_publica_url: 'https://www.superbid.net/oferta/1' },
    ]
    const h = sanearHistorico({ resumo: {}, passagens: casos })!
    for (const p of h.passagens) expect(p.pagina_publica_url).toBeNull()
  })
})

describe('fotos_pendente (fotos que chegam depois da venda)', () => {
  const res = (det: any, extra: any = {}) => ({ resumo: { fontes_com_passagem: ['copart'] }, passagens: [{ nivel: 'possivel', fonte: 'copart', fonte_tipo: 'privado', lote: '1', detalhes: det, ...extra }] })

  it('detalhes.fotos_pendente=true sem foto vira fotos_pendente na passagem do snapshot', () => {
    expect(sanearHistorico(res({ fotos_pendente: true }))!.passagens[0].fotos_pendente).toBe(true)
  })

  it('sem a marca, ou com foto ja no R2, nao fica pendente', () => {
    expect(sanearHistorico(res({}))!.passagens[0].fotos_pendente).toBe(false)
    const comFoto = res({ fotos_pendente: true, fotos: [{ ordem: 1, vista: 'frente', foto_ref: 'ref1.abcdefABCDEF0123' }] })
    expect(sanearHistorico(comFoto)!.passagens[0].fotos_pendente).toBe(false)
  })
})
