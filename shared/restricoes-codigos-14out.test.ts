import { describe, it, expect } from 'vitest'
import { explicaRestricao, EXPLICA_RESTRICAO_GENERICA, itemInformativo, itensQueRestringem, filtrarItensRestricao, chavesSemCopy, ROTULO_RESTRICAO, EXPLICA_RESTRICAO } from './restricoes'

// Codigos vistos em relatorios entregues sem copy propria (levantamento de 14/out).
const COM_COPY: Record<string, string> = {
  ALTERACAO_DOC: 'Alteração de documento',
  CHASSI_REMARCADO: 'Chassi remarcado',
  'INTENCAO VENDA': 'Intenção de venda registrada',
  TRANSFERENCIA_DE_PROPRIEDADE_ESPECIAL: 'Transferência de propriedade especial',
  SINISTRO_MEDIA_MONTA: 'Sinistro de média monta',
  'CONV_64/2006': 'Benefício fiscal (convênio 64/2006)',
  VEICULO_NACIONAL_BENEFICIO_TRIB_ZFM: 'Benefício fiscal (Zona Franca de Manaus)',
}
const INFORMATIVOS: Record<string, string> = {
  PRINCIPAL_CONDUTOR: 'Principal condutor',
  SISTEMA_GNV: 'Sistema de GNV instalado',
  TANQUE_SUPLEMENTAR: 'Tanque suplementar',
  CHASSI_ALONGADO: 'Chassi alongado',
  PLACA_SEGURANCA: 'Placa de segurança',
}
const SUFIXO_FILE = ['ALIENACAO_FIDUCIARIA_FILE_VEICULOS', 'RESTRICAO_ADMINISTRATIVA_FILE_VEICULOS', 'RESTRICAO_JUDICIAL_FILE_VEICULOS', 'RESTRICAO_BENEFICIO_TRIBUTARIO_FILE_VEICULOS']
const chave = (c: string) => c.toUpperCase().replace(/[\s-]+/g, '_')

describe('restricoes: todos os codigos levantados em 14/out tem copy', () => {
  for (const [cod, rotulo] of Object.entries(COM_COPY)) {
    it(`${cod}: rotulo e explicacao proprios (nunca o generico)`, () => {
      let desconhecida: string | null = null
      const t = explicaRestricao(cod, (c) => { desconhecida = c })
      expect(t).not.toBe(EXPLICA_RESTRICAO_GENERICA)
      expect(desconhecida).toBeNull()
      expect(ROTULO_RESTRICAO[chave(cod)]).toBe(rotulo)
      expect(t).not.toContain('—')
      expect(itemInformativo(cod)).toBeNull()
    })
  }
  it('SINISTRO_MEDIA_MONTA tem texto proprio, nao o de SINISTRO', () => {
    expect(explicaRestricao('SINISTRO_MEDIA_MONTA')).toBe(EXPLICA_RESTRICAO.SINISTRO_MEDIA_MONTA)
    expect(explicaRestricao('SINISTRO_MEDIA_MONTA')).not.toBe(EXPLICA_RESTRICAO.SINISTRO)
  })
  for (const [cod, titulo] of Object.entries(INFORMATIVOS)) {
    it(`${cod}: informativo (nao restringe)`, () => {
      expect(itemInformativo(cod)?.titulo).toBe(titulo)
      expect(itemInformativo(cod)!.texto).not.toContain('—')
      expect(itensQueRestringem([cod])).toEqual([])
    })
  }
  for (const cod of SUFIXO_FILE) {
    it(`${cod}: o sufixo de sistema casa pela chave base`, () => {
      expect(explicaRestricao(cod)).not.toBe(EXPLICA_RESTRICAO_GENERICA)
    })
  }
  it('CNPJ_DA INSTITUICAO_FINANCEIRA (com espaco) nao e restricao: some da lista', () => {
    expect(filtrarItensRestricao(['ALIENACAO_FIDUCIARIA', 'CNPJ_DA INSTITUICAO_FINANCEIRA'])).toEqual(['ALIENACAO_FIDUCIARIA'])
  })
  it('chavesSemCopy: so o que cairia no generico (sem informativo, RENAVE, RENAJUD, CNPJ)', () => {
    const itens = ['ALTERACAO_DOC', 'PRINCIPAL_CONDUTOR', 'ESTOQUE_RENAVE', 'RENAJUD', 'CNPJ_DA INSTITUICAO_FINANCEIRA', 'CODIGO_INEDITO_X', 'INTENCAO VENDA']
    expect(chavesSemCopy(itens)).toEqual(['CODIGO_INEDITO_X'])
    expect(chavesSemCopy(null)).toEqual([])
  })
})
