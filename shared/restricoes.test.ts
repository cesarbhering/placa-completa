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

describe('estoque RENAVE', async () => {
  const { ehEstoqueRenave, RENAVE_EXPLICACAO, PARECER_SO_RENAVE } = await import('./restricoes')
  it('reconhece variacoes, sem diferenciar caixa', () => {
    for (const s of ['ESTOQUE RENAVE', 'RENAVE', 'Estoque Renave', 'estoque_renave']) expect(ehEstoqueRenave(s)).toBe(true)
    for (const s of ['RENAVAM', 'RENAJUD', 'ALIENACAO_FIDUCIARIA', '', null]) expect(ehEstoqueRenave(s)).toBe(false)
  })
  it('texto aprovado, sem travessao', () => {
    const tudo = JSON.stringify([RENAVE_EXPLICACAO, PARECER_SO_RENAVE])
    expect(tudo).not.toContain('—')
    expect(RENAVE_EXPLICACAO.destaque).toBe('Não é multa, débito, roubo nem bloqueio judicial.')
    expect(`${PARECER_SO_RENAVE.titulo} ${PARECER_SO_RENAVE.texto}`).toBe('Atenção: o veículo consta no estoque de uma revenda (RENAVE). Veja na seção de Restrições o que conferir antes de fechar negócio.')
  })
})

import { ehRenajud, RENAJUD_EXPLICACAO, EXPLICA_RESTRICAO_GENERICA as GENERICA } from './restricoes'

// Caso 4ZPCC (FFR1002): a consulta devolve "RENAJUD" puro em restricoesItens, que
// caia no texto generico.
describe('RENAJUD', () => {
  it('"RENAJUD" puro e as variantes ganham o texto proprio, nunca o generico', () => {
    for (const t of ['RENAJUD', 'RESTRICAO_RENAJUD', 'RESTRICAO_JUDICIAL', 'restricao-judicial']) {
      expect(ehRenajud(t), t).toBe(true)
      expect(explicaRestricao(t), t).not.toBe(GENERICA)
      expect(explicaRestricao(t), t).toBe(RENAJUD_EXPLICACAO.texto)
    }
    expect(ehRenajud('GRAVAME')).toBe(false)
    expect(ehRenajud('RENAINF')).toBe(false)
  })
  it('quatro tipos, quem retira e o que conferir', () => {
    expect(RENAJUD_EXPLICACAO.tipos.map((t) => t.nome)).toEqual(['Transferência', 'Licenciamento', 'Circulação', 'Penhora'])
    expect(RENAJUD_EXPLICACAO.destaque).toMatch(/Só o juiz/)
    expect(RENAJUD_EXPLICACAO.conferir.length).toBe(3)
  })
  it('sem travessao, sem nomear a fonte oficial e sem afirmar o tipo', () => {
    const tudo = JSON.stringify(RENAJUD_EXPLICACAO)
    expect(tudo).not.toContain('—')
    expect(tudo).not.toMatch(/senatran/i)
    expect(RENAJUD_EXPLICACAO.texto).toMatch(/não informa qual tipo/)
  })
})
