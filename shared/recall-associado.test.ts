import { describe, it, expect } from 'vitest'
import { cardRecallAssociado, SITUACAO_RECALL_ASSOCIADO, type RecallBase } from './recall-associado'

const BASE: RecallBase = {
  consultado: true, sinal: 'firme', fonte: 'base_recalls',
  campanhas: [{ codigo: '2HV', nome: 'Airbag do motorista pode romper ao ser acionado', modelo: 'COROLLA', ano_modelo: '2015/2016', inicio: '2019-03-12', nivel: 'firme' }],
}

describe('card "Recall associado a este veículo"', () => {
  it('hook positivo + recall pendente: nao aparece (o card de pendente responde)', () => {
    expect(cardRecallAssociado({ sinal: 'firme', base: BASE, pendente: true, montadoraComCampanhas: false })).toBeNull()
  })

  it('hook positivo + sem pendencia (caso novo): campanha, situacao e fonte', () => {
    const c = cardRecallAssociado({ sinal: 'firme', base: BASE, pendente: false, montadoraComCampanhas: false })!
    expect(c.titulo).toBe('Recall associado a este veículo')
    expect(c.itens).toEqual([{ nome: 'Airbag do motorista pode romper ao ser acionado', meta: 'Campanha 2HV · iniciada em 03/2019 · COROLLA 2015/2016' }])
    expect(c.situacao).toBe('Não consta como pendente na data da consulta: pode já ter sido atendido. Confirme na concessionária com o chassi.')
    expect(c.fonte).toContain('base de recalls')
    // nunca afirma que foi feito, nunca travessao
    const tudo = JSON.stringify(c)
    expect(tudo).not.toMatch(/foi atendido\b(?!.*pode)|já foi feito|realizado/i)
    expect(tudo).not.toContain('—')
  })

  it('sem hook (negativo, fora de escopo, sem sinal ou pedido antigo): nao aparece', () => {
    for (const sinal of ['negativo', 'fora_escopo', 'sem_sinal', null, undefined]) {
      expect(cardRecallAssociado({ sinal, base: BASE, pendente: false, montadoraComCampanhas: false })).toBeNull()
    }
  })

  it('montadora ja listou campanhas (realizadas): o card dela responde', () => {
    expect(cardRecallAssociado({ sinal: 'firme', base: BASE, pendente: false, montadoraComCampanhas: true })).toBeNull()
  })

  it('hook so por modelo/ano (suave): titulo nao diz "este veiculo"', () => {
    const c = cardRecallAssociado({ sinal: 'suave', base: { ...BASE, sinal: 'suave', campanhas: [{ ...BASE.campanhas[0], nivel: 'suave' }] }, pendente: false, montadoraComCampanhas: false })!
    expect(c.titulo).toBe('Recall associado a este modelo e ano')
  })

  it('base sem detalhe agora: card aparece mesmo assim, com a situacao', () => {
    const c = cardRecallAssociado({ sinal: 'firme', base: null, pendente: false, montadoraComCampanhas: false })!
    expect(c.semDetalhe).toBe(true)
    expect(c.itens).toEqual([])
    expect(c.situacao).toBe(SITUACAO_RECALL_ASSOCIADO)
  })
  it('mesma campanha em variantes de modelo vira um item so (SHW1H43)', () => {
    const mk = (nome: string, modelo: string, ano: string) => ({ codigo: null, nome, modelo, ano_modelo: ano, inicio: null, nivel: 'suave' as const })
    const card = cardRecallAssociado({
      sinal: 'suave', pendente: false, montadoraComCampanhas: false,
      base: { consultado: true, sinal: 'suave', fonte: 'base_recalls', campanhas: [
        mk('Apoio para cabeça central do banco traseiro', 'Polo', '2023'),
        mk('Apoio para cabeça central do banco traseiro', 'Novo Polo', '2023'),
        mk('Elementos de fixação', 'Polo', '2022 a 2023'),
        mk('Elementos de fixação', 'Novo Polo', '2022 a 2023'),
      ] },
    })
    expect(card?.itens).toEqual([
      { nome: 'Apoio para cabeça central do banco traseiro', meta: 'Polo e Novo Polo 2023' },
      { nome: 'Elementos de fixação', meta: 'Polo e Novo Polo 2022 a 2023' },
    ])
  })
})
