import { describe, expect, it } from 'vitest'
import { classificarRestricaoDetran as c, restricoesDetranParaTela, normalizarTexto } from './restricao-detran-classe'

// Os 23 textos distintos de multas.restricoes_detran nos relatorios de prod ate
// 16/out/2026 (MG, SP, PR, AL, PA, ES...). Nome de pessoa ja vem mascarado pela fonte.
const REAIS: [string, string, 'nega' | 'restricao' | 'duvida', string?][] = [
  ['financeira', 'Consta Gravame', 'restricao'],
  ['administrativa', 'Este veículo não possui impedimentos e/ou restrições.', 'nega'],
  ['administrativa', 'SEM RESTRICAO', 'nega'],
  ['administrativa', 'Veiculo possui comunicacao de venda ativa.', 'restricao'],
  ['administrativa', 'RELACIONADO P/ LEILAO', 'restricao'],
  ['judiciaria', 'Consta Bloqueio Judicial - Renajud', 'restricao'],
  ['administrativa', 'RESTRICAO JUDICIAL DE TRANSFERENCIA. SEM RESTRICAO', 'restricao', 'RESTRICAO JUDICIAL DE TRANSFERENCIA'],
  ['sng', 'Registro de Alienação Fiduciária informado em 29/09/2026', 'restricao'],
  ['administrativa', 'REST. ADMINISTRATIVA', 'restricao'],
  ['administrativa', 'ALIENACAO FIDUCIARIA AGENTE: BANCO VOLKSWAGEN SA', 'restricao'],
  ['administrativa', 'Administrativa', 'duvida'],
  ['administrativa', 'REGISTRO DE ESTELIONATO NA BASE DETRAN / ADMINISTRATIVA', 'restricao'],
  ['financeira', 'Consta Intenção de Gravame', 'restricao'],
  ['administrativa', 'Intenção de Venda para M**** F****** P**** (Data de Inclusão: 13/10/2026)', 'restricao'],
  ['administrativa', 'VEICULO AUTUADO POR DEBITO DE IPVA. Veiculo possui comunicacao de venda ativa.', 'restricao'],
  ['financeira', 'Alienação Fiduciária em favor de SANTANDER SOCIEDADE DE CREDITO, FINANC. INVESTIMENTO SA', 'restricao'],
  ['administrativa', 'SINISTRADO/RECUPERADO', 'restricao'],
  ['administrativa', 'BLOQUEIOS DIVERSOS', 'restricao'],
  ['administrativa', 'VEICULO AUTUADO POR DEBITO DE IPVA. SEM RESTRICAO', 'restricao', 'VEICULO AUTUADO POR DEBITO DE IPVA'],
  ['cadastro', 'Comunicação de venda registrada no DETRAN-AL', 'restricao'],
  ['administrativa', 'RENAJUD (Transferência de Propriedade)', 'restricao'],
  ['administrativa', 'RESERVA DE AL.FIDUC. AGENTE: BCO.VOLKSWAGEN S/A', 'restricao'],
]

describe('classificador de restricoes do DETRAN', () => {
  it.each(REAIS)('%s | %s -> %s', (tipo, texto, classe, exib) => {
    const r = c({ tipo, texto })
    expect(r.classe).toBe(classe)
    if (exib) expect(r.texto).toBe(exib)
    if (classe === 'restricao' && !exib) expect(r.texto.replace(/\.$/, '')).toBe(texto.replace(/\.$/, ''))
  })
  it('negacoes comuns', () => {
    for (const t of ['Nada consta', 'NAO HA RESTRICOES', 'Sem impedimentos', 'Restrições: inexistentes', 'Nenhuma restrição', 'Não constam restrições para este veículo']) {
      expect(c({ tipo: 'administrativa', texto: t }).classe, t).toBe('nega')
    }
  })
  it('negacao com termo real ou que inverte vai ao revisor (nunca vira "sem restricao")', () => {
    expect(c({ tipo: 'financeira', texto: 'NAO CONSTA BAIXA DE ALIENACAO FIDUCIARIA' }).classe).toBe('duvida')
    expect(c({ tipo: 'administrativa', texto: 'Não possui liberação do bloqueio' }).classe).toBe('duvida')
  })
  it('"consta" sozinho e categoria sozinha: duvida', () => {
    expect(c({ tipo: 'administrativa', texto: 'CONSTA' }).classe).toBe('duvida')
    expect(c({ tipo: 'judiciaria', texto: '' }).classe).toBe('duvida')
  })
  it('chave normalizada (cache do revisor): sem acento, caixa e espacos', () => {
    expect(c({ tipo: 'administrativa', texto: 'Administrativa ' }).chave).toBe(c({ tipo: 'ADMINISTRATIVA', texto: 'administrativa' }).chave)
    expect(normalizarTexto('  Não   possui ')).toBe('NAO POSSUI')
  })
})

describe('lista para a tela', () => {
  it('TDI3E93 (MG): so negacao -> sem restricao, nada na lista', () => {
    const t = restricoesDetranParaTela([{ tipo: 'administrativa', texto: 'Este veículo não possui impedimentos e/ou restrições.' }])
    expect(t).toMatchObject({ reais: [], informativas: [], semRestricao: true, pendentesRevisor: [] })
  })
  it('real + negacao: so a real; nao diz "sem restricao"', () => {
    const t = restricoesDetranParaTela([{ tipo: 'financeira', texto: 'Consta Gravame' }, { tipo: 'administrativa', texto: 'SEM RESTRICAO' }])
    expect(t.reais.map((r) => r.texto)).toEqual(['Consta Gravame'])
    expect(t.semRestricao).toBe(false)
  })
  it('duvida sem veredito: informativa neutra e pendente do revisor', () => {
    const t = restricoesDetranParaTela([{ tipo: 'administrativa', texto: 'Administrativa' }])
    expect(t.reais).toEqual([])
    expect(t.informativas).toHaveLength(1)
    expect(t.pendentesRevisor).toHaveLength(1)
    expect(t.semRestricao).toBe(false)
  })
  it('duvida com veredito do revisor', () => {
    const chave = c({ tipo: 'administrativa', texto: 'Administrativa' }).chave
    expect(restricoesDetranParaTela([{ tipo: 'administrativa', texto: 'Administrativa' }], { [chave]: { classe: 'restricao' } }).reais).toHaveLength(1)
    expect(restricoesDetranParaTela([{ tipo: 'administrativa', texto: 'Administrativa' }], { [chave]: { classe: 'nega' } }).semRestricao).toBe(true)
  })
})
