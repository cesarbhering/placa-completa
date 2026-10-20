import { describe, it, expect } from 'vitest'
import { validarGrupos, agrupamentoValido } from './recall-agrupamento'
import { cardRecallAssociado, type CampanhaBase } from './recall-associado'

// Caso HOI8752 (Voyage, 20/out/2026): 6 campanhas de airbag em 4+ cards.
const C = (nome: string, ano: string): CampanhaBase => ({ codigo: null, nome, modelo: 'Voyage', ano_modelo: ano, inicio: null, nivel: 'firme' })
const VOYAGE: CampanhaBase[] = [
  C('Gerador de gás do airbag do motorista', '2011 a 2014'),
  C('Gerador de gás do airbag do motorista e/ ou do passageiro', '2011 a 2012'),
  C('Gerador de gás do airbag do motorista', '2010 a 2012'),
  C('Gerador de gás do airbag do motorista e/ou do passageiro', '2015 a 2016'),
  C('Gerador de gás do airbag do motorista e/ou do passageiro', '2009 a 2016'),
  C('Gerador de gás do airbag do motorista', '2011 a 2014'),
]
const UM_GRUPO = [{ titulo: 'Airbag do motorista e/ou passageiro', resumo: 'O airbag pode se romper e lançar fragmentos ao abrir.', indices: [0, 1, 2, 3, 4, 5], anos: '2009 a 2016', modelo: 'Voyage' }]

describe('validarGrupos: cada campanha em exatamente um grupo', () => {
  it('aceita a particao completa', () => {
    expect(validarGrupos(UM_GRUPO, 6)).toHaveLength(1)
    expect(validarGrupos([{ ...UM_GRUPO[0], indices: [0, 1, 2] }, { ...UM_GRUPO[0], titulo: 'Outro', indices: [5, 4, 3] }], 6)![1].indices).toEqual([3, 4, 5])
  })
  it('indice perdido, repetido, fora da lista ou nao inteiro: descarta tudo', () => {
    expect(validarGrupos([{ ...UM_GRUPO[0], indices: [0, 1, 2, 3, 4] }], 6)).toBe(null)
    expect(validarGrupos([{ ...UM_GRUPO[0], indices: [0, 1, 2, 3, 4, 5] }, { ...UM_GRUPO[0], indices: [5] }], 6)).toBe(null)
    expect(validarGrupos([{ ...UM_GRUPO[0], indices: [0, 1, 2, 3, 4, 5, 6] }], 6)).toBe(null)
    expect(validarGrupos([{ ...UM_GRUPO[0], indices: [0, 1, 2, 3, 4, 5.5] }], 6)).toBe(null)
    expect(validarGrupos([{ ...UM_GRUPO[0], titulo: '' }], 6)).toBe(null)
    expect(validarGrupos('lixo', 6)).toBe(null)
  })
  it('sem ganho (um grupo por campanha) fica a lista original', () => {
    expect(validarGrupos([0, 1].map((i) => ({ ...UM_GRUPO[0], indices: [i] })), 2)).toBe(null)
  })
  it('tira travessao do texto do agente', () => {
    expect(validarGrupos([{ ...UM_GRUPO[0], resumo: 'Pode romper — e ferir' }], 6)![0].resumo).toBe('Pode romper, e ferir')
  })
  it('agrupamento gravado pra outra quantidade de campanhas nao vale', () => {
    expect(agrupamentoValido({ hash: 'x', total: 5, grupos: UM_GRUPO }, 6)).toBe(null)
    expect(agrupamentoValido(null, 6)).toBe(null)
  })
})

describe('card do recall associado com o agrupamento', () => {
  const base = (agrupado: any) => ({ consultado: true, sinal: 'firme' as const, fonte: 'base_recalls' as const, campanhas: VOYAGE, agrupado })
  const card = (agrupado: any) => cardRecallAssociado({ sinal: 'firme', base: base(agrupado), pendente: false, montadoraComCampanhas: false })!

  it('um card por grupo, com contagem, anos e a lista original para expandir', () => {
    const c = card({ hash: 'h', total: 6, grupos: UM_GRUPO })
    expect(c.itens).toHaveLength(1)
    expect(c.itens[0]).toMatchObject({ nome: 'Airbag do motorista e/ou passageiro', meta: '6 campanhas · Voyage, modelos 2009 a 2016', resumo: 'O airbag pode se romper e lançar fragmentos ao abrir.' })
    expect(c.itens[0].campanhas).toHaveLength(6)
    expect(c.itens[0].campanhas![4]).toEqual({ nome: 'Gerador de gás do airbag do motorista e/ou do passageiro', meta: 'Voyage 2009 a 2016' })
    // copy da base por modelo: "consta", nunca "pendente"
    expect(c.situacao).toMatch(/Não consta como pendente/)
  })
  it('agente errou os indices: lista original (como antes)', () => {
    const errado = card({ hash: 'h', total: 6, grupos: [{ ...UM_GRUPO[0], indices: [0, 1, 2] }] })
    const sem = card(undefined)
    expect(errado.itens).toEqual(sem.itens)
    expect(sem.itens.length).toBeGreaterThan(1)
    expect(sem.itens.every((i) => !i.campanhas)).toBe(true)
  })
})
