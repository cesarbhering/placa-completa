import { describe, it, expect, vi } from 'vitest'
import { explicaRestricao, EXPLICA_RESTRICAO_GENERICA } from './restricoes'

describe('explicaRestricao', () => {
  it('BAIXA (caso HJN2372) tem copy propria e conclusiva', () => {
    const t = explicaRestricao('BAIXA')
    expect(t).toContain('baixado de forma definitiva')
    expect(t).toContain('irreversível')
    expect(t).not.toBe(EXPLICA_RESTRICAO_GENERICA)
  })

  it('RECUPERADO_SINISTRO (caso MSH9001) explica o impacto no valor', () => {
    const t = explicaRestricao('RECUPERADO_SINISTRO')
    expect(t).toContain('sinistro de grande monta')
    expect(t).toContain('valor de mercado')
  })

  it('variante com sufixo do sistema casa pela chave especifica', () => {
    expect(explicaRestricao('RESTRICAO_ADMINISTRATIVA_FILE_VEICULOS'))
      .toBe(explicaRestricao('RESTRICAO_ADMINISTRATIVA'))
    expect(explicaRestricao('ALIENACAO_FIDUCIARIA_FILE_VEICULOS'))
      .toBe(explicaRestricao('ALIENACAO_FIDUCIARIA'))
  })

  it('judicial, renajud, gravame e leilao tem copy propria', () => {
    for (const tipo of ['RESTRICAO_JUDICIAL', 'RESTRICAO_RENAJUD', 'GRAVAME', 'LEILAO', 'PENHOR', 'ROUBO_FURTO']) {
      expect(explicaRestricao(tipo)).not.toBe(EXPLICA_RESTRICAO_GENERICA)
    }
  })

  it('nenhuma copy usa travessao', () => {
    for (const tipo of ['BAIXA', 'RECUPERADO_SINISTRO', 'RESTRICAO_ADMINISTRATIVA', 'GRAVAME', 'LEILAO']) {
      expect(explicaRestricao(tipo)).not.toContain('—')
    }
  })

  it('tipo desconhecido cai no generico e e reportado uma vez', () => {
    const aviso = vi.fn()
    expect(explicaRestricao('TIPO_QUE_NAO_EXISTE', aviso)).toBe(EXPLICA_RESTRICAO_GENERICA)
    expect(aviso).toHaveBeenCalledWith('TIPO_QUE_NAO_EXISTE')
  })

  it('normaliza espaco, hifen e caixa', () => {
    expect(explicaRestricao('recuperado sinistro')).toBe(explicaRestricao('RECUPERADO_SINISTRO'))
    expect(explicaRestricao('restricao-judicial')).toBe(explicaRestricao('RESTRICAO_JUDICIAL'))
  })
})
