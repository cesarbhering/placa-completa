import { describe, it, expect } from 'vitest'
import { ehItemDeRestricao, filtrarItensRestricao } from './restricoes'
import { normalizarResposta } from './planos'

// QUC6E49 (06/out): "CNPJ_DA INSTITUICAO_FINANCEIRA" vinha em restricoesItens
// junto da alienacao; e o rotulo do CNPJ do credor, nao restricao.
describe('item que nao e restricao', () => {
  it('reconhece as variacoes de espaco/underscore', () => {
    for (const s of ['CNPJ_DA INSTITUICAO_FINANCEIRA', 'CNPJ_DA_INSTITUICAO_FINANCEIRA', 'cnpj da instituicao financeira', 'CNPJ__DA  INSTITUICAO-FINANCEIRA']) {
      expect(ehItemDeRestricao(s)).toBe(false)
    }
    expect(ehItemDeRestricao('ALIENACAO_FIDUCIARIA_FILE_VEICULOS')).toBe(true)
    expect(ehItemDeRestricao('')).toBe(false)
  })
  it('filtra a lista (snapshot ja entregue) e deixa a alienacao', () => {
    expect(filtrarItensRestricao(['ALIENACAO_FIDUCIARIA_FILE_VEICULOS', 'CNPJ_DA INSTITUICAO_FINANCEIRA'])).toEqual(['ALIENACAO_FIDUCIARIA_FILE_VEICULOS'])
    expect(filtrarItensRestricao(null)).toBeNull()
  })
  it('normalizarResposta (relatorio novo) ja nao grava o item', () => {
    const r = normalizarResposta([{ restricoes: { items: [{ tipoRestricao: 'ALIENACAO_FIDUCIARIA_FILE_VEICULOS' }, { tipoRestricao: 'CNPJ_DA INSTITUICAO_FINANCEIRA' }] } }])
    expect(r.restricoesItens).toEqual(['ALIENACAO_FIDUCIARIA_FILE_VEICULOS'])
  })
})
