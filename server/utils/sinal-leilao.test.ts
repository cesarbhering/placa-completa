import { describe, it, expect, beforeEach } from 'vitest'
import { sinalDoHistorico, fraseSinal, SINAL_VAZIO, SINAL_INDISPONIVEL, dentroDoTetoDeSinal, _limparTetoDeSinal } from './sinal-leilao'

const hist = (r: any) => ({ resumo: { n_confirmado: 0, n_provavel: 0, n_possivel: 0, ...r }, passagens: [] }) as any

// A muralha: da consulta gratis sai um numero e um booleano, nada mais.
describe('sinal de leilao da consulta gratis', () => {
  it('confirmado e provavel viram sinal positivo, somados', () => {
    expect(sinalDoHistorico(hist({ n_confirmado: 1 }))).toEqual({ positivo: true, quantidade: 1 })
    expect(sinalDoHistorico(hist({ n_provavel: 2 }))).toEqual({ positivo: true, quantidade: 2 })
    expect(sinalDoHistorico(hist({ n_confirmado: 1, n_provavel: 2 }))).toEqual({ positivo: true, quantidade: 3 })
  })

  it('possivel NAO vira sinal: e inferencia por identificador parcial', () => {
    expect(sinalDoHistorico(hist({ n_possivel: 5 }))).toEqual(SINAL_VAZIO)
  })

  // O furo que quase foi pra producao: sem historico, o endpoint devolvia
  // "nao tem registro", que na tela vira uma AFIRMACAO sobre o carro de outra
  // pessoa baseada numa lentidao nossa.
  it('servico fora do ar e "nao sabemos", nunca "nao tem"', () => {
    expect(sinalDoHistorico(null)).toEqual(SINAL_INDISPONIVEL)
    expect(sinalDoHistorico(undefined)).toEqual(SINAL_INDISPONIVEL)
    expect(sinalDoHistorico({} as any)).toEqual(SINAL_INDISPONIVEL)
    // E os tres estados sao mesmo distinguiveis por quem le a resposta.
    expect(SINAL_INDISPONIVEL.positivo).toBeNull()
    expect(SINAL_VAZIO.positivo).toBe(false)
  })

  it('base respondeu sem registro e "nao tem", e isso pode ir pra tela', () => {
    expect(sinalDoHistorico(hist({}))).toEqual(SINAL_VAZIO)
  })

  it('o sinal nao carrega nada alem de positivo e quantidade', () => {
    const completo = {
      resumo: { n_confirmado: 1, n_provavel: 0, fontes_com_passagem: ['detran-mg'] },
      passagens: [{ data_leilao: '2023-03-14', leiloeiro: 'Fulano Leiloes', valor: 21400, fotos: ['x'] }],
    } as any
    expect(Object.keys(sinalDoHistorico(completo)).sort()).toEqual(['positivo', 'quantidade'])
  })
})

describe('frase do sinal', () => {
  it('indisponivel nao tem frase: a tela nao fala de leilao', () => {
    expect(fraseSinal(SINAL_INDISPONIVEL, 'este carro')).toBe('')
  })

  // Decisao de produto: sem registro, a tela nao fala de leilao. Contar que
  // nao achamos nada entregava de graca a duvida que vende o relatorio, e ela
  // existe em quase toda placa.
  it('sem registro nao ha frase nenhuma', () => {
    expect(fraseSinal(SINAL_VAZIO, 'este carro')).toBe('')
  })

  it('positiva e VAGA: indica sem contagem e aponta pro completo', () => {
    const f = fraseSinal({ positivo: true, quantidade: 3 })
    expect(f).toContain('indícios de leilão')
    expect(f).toContain('relatório completo')
    expect(f).not.toMatch(/\d+\s*registro/) // sem contagem no gratis
  })

  it('nao vaza detalhe nenhum na frase', () => {
    const f = fraseSinal({ positivo: true, quantidade: 2 }, 'este veículo')
    for (const proibido of ['leiloeir', 'lote', 'R$', 'sucata', 'recuper']) {
      // "leiloeira" aparece so como PROMESSA do que vem no pago, nunca com nome
      if (proibido === 'leiloeir') continue
      expect(f.toLowerCase()).not.toContain(proibido)
    }
  })

  it('sem travessao', () => {
    expect(fraseSinal(SINAL_VAZIO, 'este carro')).not.toContain('—')
    expect(fraseSinal({ positivo: true, quantidade: 1 }, 'este carro')).not.toContain('—')
  })
})

describe('teto por IP', () => {
  beforeEach(() => _limparTetoDeSinal())

  it('deixa passar o uso normal e corta a varredura', () => {
    for (let i = 0; i < 60; i++) expect(dentroDoTetoDeSinal('1.2.3.4'), `chamada ${i + 1}`).toBe(true)
    expect(dentroDoTetoDeSinal('1.2.3.4')).toBe(false)
  })

  it('a janela reabre depois de uma hora', () => {
    const t0 = Date.now()
    for (let i = 0; i < 61; i++) dentroDoTetoDeSinal('9.9.9.9', t0)
    expect(dentroDoTetoDeSinal('9.9.9.9', t0)).toBe(false)
    expect(dentroDoTetoDeSinal('9.9.9.9', t0 + 60 * 60 * 1000 + 1)).toBe(true)
  })

  it('um IP nao gasta a cota do outro', () => {
    for (let i = 0; i < 61; i++) dentroDoTetoDeSinal('1.1.1.1')
    expect(dentroDoTetoDeSinal('2.2.2.2')).toBe(true)
  })

  it('sem IP identificado, nao bloqueia ninguem', () => {
    for (let i = 0; i < 100; i++) expect(dentroDoTetoDeSinal('')).toBe(true)
  })
})

// Edital de notificacao: o DETRAN avisou o dono, o leilao pode nao ter
// acontecido. A API conta como confirmado (casa pelo chassi inteiro).
describe('sinal com notificacao para leilao', () => {
  const notif = { nivel: 'confirmado', situacao: 'notificado', detalhes: { tipo_registro: 'notificacao_leilao' } }
  const soNotificacao = { resumo: { n_confirmado: 2, n_provavel: 0, n_possivel: 0 }, passagens: [notif, { ...notif }] } as any

  it('por decisao do Cesar, notificacao sozinha NAO acende o sinal', () => {
    expect(sinalDoHistorico(soNotificacao)).toEqual(SINAL_VAZIO)
  })

  it('com a chave ligada, notificacao acenderia', () => {
    expect(sinalDoHistorico(soNotificacao, true)).toEqual({ positivo: true, quantidade: 2 })
  })

  it('com a chave desligada, leilao real ao lado da notificacao continua contando', () => {
    const misto = {
      resumo: { n_confirmado: 2, n_provavel: 0 },
      passagens: [notif, { nivel: 'confirmado', situacao: 'ARREMATADO', detalhes: {} }],
    } as any
    expect(sinalDoHistorico(misto, false)).toEqual({ positivo: true, quantidade: 1 })
  })

  it('a frase continua vaga, sem falar em notificacao', () => {
    expect(fraseSinal(sinalDoHistorico(soNotificacao, true))).toBe(
      'Existem indícios de leilão deste veículo em nossa base. Confira no relatório completo.',
    )
  })
})
