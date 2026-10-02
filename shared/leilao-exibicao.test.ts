import { describe, it, expect } from 'vitest'
import { detalhesLegiveis, semValorEmReais, ROTULO_DETALHE } from './leilao-exibicao'

describe('card de leilao sem valor em R$ (decisao 01/out)', () => {
  it('valor_final nao e rotulo exibido', () => {
    expect(Object.keys(ROTULO_DETALHE)).not.toContain('valor_final')
    expect(Object.keys(ROTULO_DETALHE)).not.toContain('valor')
  })
  it('snapshot antigo com valor_final/valor: nao aparece', () => {
    const d = detalhesLegiveis({ sinistro: true, valor_final: 'R$ 18.500,00', valor: 18500, monta: 'Media' })
    expect(d).toEqual([{ rotulo: 'Monta', valor: 'Media' }, { rotulo: 'Sinistro', valor: 'Sim' }])
    expect(JSON.stringify(d)).not.toMatch(/R\$|18\.?500/)
  })
  it('observacao com lance em R$: o trecho sai, o resto fica', () => {
    expect(semValorEmReais('Veiculo com chave. Lance inicial: R$ 12.000,00. Documento ok')).toBe('Veiculo com chave. Documento ok')
    expect(semValorEmReais('Lance minimo R$ 5.000')).toBeNull()
    expect(semValorEmReais('Motor nao funciona - lance de R$ 3.200,00')).toBe('Motor nao funciona')
    expect(semValorEmReais('avaliado em 15000 reais')).toBeNull()
    const d = detalhesLegiveis({ observacao: 'Lance: R$ 9.900,00' })
    expect(d).toEqual([])
  })
  it('texto sem R$ passa igual', () => {
    expect(semValorEmReais('Sem chave; pneus carecas')).toBe('Sem chave; pneus carecas')
  })
})
