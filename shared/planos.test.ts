import { describe, it, expect } from 'vitest'
import { normalizarResposta } from './planos'

// A resposta da SERPRO chega como array de um elemento, com as restricoes
// aninhadas em `restricoes.items[].tipoRestricao`. Alguns registros trazem uma
// linha placeholder "Nada consta" junto de uma restricao real: sem filtrar, o
// relatorio mostrava "Nada consta" ACIMA de uma restricao de verdade.
function resposta(items: any[]) {
  return [{ placa: 'ABC1D23', restricoes: { indicadorRestricaoRenajud: true, items } }]
}

describe('normalizarResposta / restricoesItens', () => {
  it('derruba a linha placeholder "Nada consta" e mantem a restricao real', () => {
    const r = normalizarResposta(resposta([
      { tipoRestricao: 'Nada consta' },
      { tipoRestricao: 'RESTRICAO_JUDICIAL' },
    ]))
    expect(r.restricoesItens).toEqual(['RESTRICAO_JUDICIAL'])
  })

  it('derruba variacoes de caixa, espaco e pontuacao solta', () => {
    const r = normalizarResposta(resposta([
      { tipoRestricao: 'nada consta' },
      { tipoRestricao: '  NADA   CONSTA.  ' },
      { tipoRestricao: 'Nada consta;' },
      { tipoRestricao: 'GRAVAME' },
    ]))
    expect(r.restricoesItens).toEqual(['GRAVAME'])
  })

  it('preserva texto que apenas COMECA com "nada consta" mas diz mais coisa', () => {
    const r = normalizarResposta(resposta([
      { tipoRestricao: 'Nada consta de restricao administrativa, mas ha gravame' },
    ]))
    expect(r.restricoesItens).toEqual(['Nada consta de restricao administrativa, mas ha gravame'])
  })

  it('lista so com "Nada consta" fica vazia', () => {
    const r = normalizarResposta(resposta([{ tipoRestricao: 'Nada consta' }]))
    expect(r.restricoesItens).toEqual([])
  })

  it('remove entradas vazias/nulas junto com o placeholder', () => {
    const r = normalizarResposta(resposta([
      { tipoRestricao: '' },
      { tipoRestricao: null },
      { tipoRestricao: 'Nada consta' },
      { tipoRestricao: 'LEILAO' },
    ]))
    expect(r.restricoesItens).toEqual(['LEILAO'])
  })

  it('sem items a lista vem vazia (sem quebrar)', () => {
    expect(normalizarResposta([{ placa: 'ABC1D23', restricoes: {} }]).restricoesItens).toEqual([])
    expect(normalizarResposta([{ placa: 'ABC1D23' }]).restricoesItens).toEqual([])
  })
})

describe('fonteNoPlano (Cesar, 25/out/2026)', () => {
  it('Basica: so recall; completo e pedido sem plano: tudo', async () => {
    const { fonteNoPlano } = await import('./planos')
    expect(['detran', 'recall', 'recall_montadora', 'renajud'].filter((f: any) => fonteNoPlano(f, 'basica'))).toEqual(['recall', 'recall_montadora'])
    expect(fonteNoPlano('detran', 'completa')).toBe(true)
    expect(fonteNoPlano('renajud', null)).toBe(true)
  })
})
