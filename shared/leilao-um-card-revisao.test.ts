import { describe, it, expect } from 'vitest'
import { passagensSemCanhao, historicoParaExibicao, historicoNaTela, fonteExibicaoLeilao, detalhesLegiveis, comAcentos, rotuloFonteLinhaDoTempo } from './leilao-exibicao'
import { juntarNotificacoes, linhaNotificacao, ehNotificacao, JANELA_NOTIFICACAO_DIAS } from './leilao-notificacao'
import { passagemLgpd } from './leilao-lgpd'

// Review of PR #750 (one card per auction, 13/11/2026). Fictitious data.
const SPIN = { modelo: 'CHEV/SPIN 1.8L AT LTZ' }
const ONIX_NA_FONTE = { marca: 'CHEVROLET', modelo: 'ONIX 1.4 AT LTZ' }

describe('a weak direct passage never hides a canhao passage (review item 1)', () => {
  const canhao = { fonte: 'canhao:cdn.exemplo.net', fonte_tipo: 'privado', nivel: 'confirmado', lote: '012', data_leilao: '2026-03-10' }
  const direta = (nivel: string, x: any = {}) => ({ fonte: 'casa_x', fonte_tipo: 'privado', nivel, lote: '12', data_leilao: '2026-03-10', ...x })

  it('possivel direct passage keeps the canhao passage', () => {
    expect(passagensSemCanhao([direta('possivel'), canhao])).toHaveLength(2)
  })

  it('a strong direct passage absorbs it and keeps the higher level (review 2)', () => {
    const r = passagensSemCanhao([direta('provavel'), canhao])
    expect(r).toHaveLength(1)
    expect(r[0].via_canhao).toBeUndefined()
    expect(r[0].nivel).toBe('confirmado')
    expect(passagensSemCanhao([direta('confirmado'), canhao])).toHaveLength(1)
    expect(passagensSemCanhao([direta('provavel'), { ...canhao, nivel: 'provavel' }])).toHaveLength(1)
    expect(passagensSemCanhao([direta('confirmado'), { ...canhao, nivel: 'provavel' }])).toHaveLength(1)
  })

  it('same rule for the Detran same-source-and-lot case', () => {
    const det = { fonte: 'detran_mg', fonte_tipo: 'detran', nivel: 'possivel', lote: '77' }
    const doc = { fonte: 'canhao:leilao.detran.mg.gov.br', nivel: 'confirmado', lote: '077' }
    expect(passagensSemCanhao([det, doc])).toHaveLength(2)
    expect(passagensSemCanhao([{ ...det, nivel: 'confirmado' }, doc])).toHaveLength(1)
  })

  it('model lock runs first: the confirmed canhao auction stays on screen', () => {
    const h = {
      resumo: { tem_indicio: true, n_confirmado: 1, n_possivel: 1, nivel_max: 'confirmado' },
      passagens: [direta('possivel', { veiculo_na_fonte: ONIX_NA_FONTE }), canhao],
      linha_do_tempo: null, recorrencia: null,
    }
    const r: any = historicoNaTela(h, SPIN)
    expect(r.passagens).toHaveLength(1)
    expect(r.passagens[0].via_canhao).toBe(true)
    expect(r.passagens[0].nivel).toBe('confirmado')
    expect(fonteExibicaoLeilao(r.passagens[0])).toBe('Leiloeira particular')
  })
})

describe('a notice only joins a card that stays on screen (review item 2)', () => {
  it('auction removed by the model lock: the confirmed notice keeps its own card', () => {
    const h = {
      resumo: { tem_indicio: true },
      passagens: [
        { fonte: 'detran_xx', fonte_tipo: 'detran', nivel: 'provavel', lote: '5', data_leilao: '2026-05-20', veiculo_na_fonte: ONIX_NA_FONTE, detalhes: {} },
        { fonte: 'detran_xx', fonte_tipo: 'detran', nivel: 'confirmado', situacao: 'notificado', detalhes: { tipo_registro: 'notificacao_leilao', data_publicacao: '2026-04-01', edital_numero: '3/2026' } },
      ],
    }
    const r: any = historicoNaTela(h, SPIN)
    expect(r.passagens).toHaveLength(1)
    expect(ehNotificacao(r.passagens[0])).toBe(true)
  })
})

describe('time window between notice and auction (review item 3)', () => {
  const notif = (pub: string, edital = '1/2020') => ({ fonte: 'detran_xx', fonte_tipo: 'detran', nivel: 'confirmado', situacao: 'notificado', detalhes: { tipo_registro: 'notificacao_leilao', data_publicacao: pub, edital_numero: edital } })
  const leilao = (data: string) => ({ fonte: 'detran_xx', fonte_tipo: 'detran', nivel: 'confirmado', lote: '7', data_leilao: data, detalhes: {} })

  it('window is 365 days, same as the auctions API', () => {
    expect(JANELA_NOTIFICACAO_DIAS).toBe(365)
  })

  it('auction years after the notice is another event: no join', () => {
    const r = juntarNotificacoes([notif('2020-02-01'), leilao('2026-03-10')])
    expect(r).toHaveLength(2)
    expect(r.some((p: any) => linhaNotificacao(p))).toBe(false)
  })

  it('exactly 365 days later still joins, 366 does not', () => {
    expect(juntarNotificacoes([notif('2025-01-01'), leilao('2026-01-01')])).toHaveLength(1)
    expect(juntarNotificacoes([notif('2025-01-01'), leilao('2026-01-02')])).toHaveLength(2)
  })
})

describe('notice already nested by the API plus the leftover passage (review item 4)', () => {
  const sobra = (pub: string, edital?: string) => ({ fonte: 'detran_xx', fonte_tipo: 'detran', nivel: 'confirmado', situacao: 'notificado', detalhes: { tipo_registro: 'notificacao_leilao', data_publicacao: pub, ...(edital ? { edital_numero: edital } : {}) } })
  const comAninhada = (n: any) => ({ fonte: 'detran_xx', fonte_tipo: 'detran', nivel: 'confirmado', lote: '7', data_leilao: '2026-05-20', detalhes: { notificacao: n } })

  it('compares by day, not raw text', () => {
    expect(juntarNotificacoes([sobra('2026-02-01'), comAninhada({ data_publicacao: '2026-02-01T00:00:00' })])).toHaveLength(1)
    expect(juntarNotificacoes([sobra('2026-02-01T00:00:00'), comAninhada({ data_publicacao: '2026-02-01' })])).toHaveLength(1)
  })

  it('nested notice without a date: decided by the edital number', () => {
    expect(juntarNotificacoes([sobra('2026-02-01', '12/2026'), comAninhada({ edital_numero: '12/2026' })])).toHaveLength(1)
    expect(juntarNotificacoes([sobra('2026-02-01', '13/2026'), comAninhada({ edital_numero: '12/2026' })])).toHaveLength(2)
  })
})

describe('recurrence goes with the timeline (review item 5)', () => {
  it('a passage removed from the screen drops recorrencia too', () => {
    const h = {
      resumo: { tem_indicio: true },
      passagens: [
        { fonte: 'casa_x', fonte_tipo: 'privado', nivel: 'confirmado', lote: '42', data_leilao: '2026-03-10' },
        { fonte: 'canhao:cdn.exemplo.net', fonte_tipo: 'privado', nivel: 'confirmado', lote: '42', data_leilao: '2026-03-10' },
      ],
      linha_do_tempo: [{ data: '2026-03-10', tipo: 'leilao', nPassagens: 2, fontes: ['Casa X'] }],
      recorrencia: { texto: 'Passou por leilão 2 vezes', intervalosMeses: [0] },
    }
    const r: any = historicoParaExibicao(h)
    expect(r.passagens).toHaveLength(1)
    expect(r.linha_do_tempo).toBeNull()
    expect(r.recorrencia).toBeNull()
  })
})

describe('lot zero and the closest notice (review item 6)', () => {
  it('lot "0" or "00" is not a valid lot to join on', () => {
    const direta = { fonte: 'casa_x', fonte_tipo: 'privado', nivel: 'confirmado', lote: '0', data_leilao: '2026-03-10' }
    expect(passagensSemCanhao([direta, { fonte: 'canhao:cdn.exemplo.net', nivel: 'confirmado', lote: '00', data_leilao: '2026-03-10' }])).toHaveLength(2)
    const det = { fonte: 'detran_mg', fonte_tipo: 'detran', nivel: 'confirmado', lote: '000' }
    expect(passagensSemCanhao([det, { fonte: 'canhao:leilao.detran.mg.gov.br', nivel: 'confirmado', lote: '0' }])).toHaveLength(2)
  })

  it('two notices before one auction: the one published closest to it joins, the other keeps its card', () => {
    const n = (pub: string, edital: string) => ({ fonte: 'detran_xx', fonte_tipo: 'detran', nivel: 'confirmado', situacao: 'notificado', detalhes: { tipo_registro: 'notificacao_leilao', data_publicacao: pub, edital_numero: edital } })
    const leilao = { fonte: 'detran_xx', fonte_tipo: 'detran', nivel: 'confirmado', lote: '7', data_leilao: '2026-05-20', detalhes: {} }
    const r: any[] = juntarNotificacoes([n('2026-01-10', '1/2026'), n('2026-04-01', '2/2026'), leilao])
    expect(r).toHaveLength(2)
    expect(linhaNotificacao(r.find((p) => p.lote === '7'))).toBe('Notificado em 01/04/2026 (edital 2/2026)')
    expect(r.find((p) => ehNotificacao(p))?.detalhes.edital_numero).toBe('1/2026')
  })
})

describe('a platform never shows as a house name (Lead, rule of 19/out)', () => {
  const PLATAFORMA = /vlance|soleon|leilotech|sishp/i
  it('vlance house: approved name, or the house slug without the platform', () => {
    expect(fonteExibicaoLeilao({ fonte: 'vlance_exclusivomultleiloes', fonte_tipo: 'privado' })).toBe('MultLeiloes')
    expect(fonteExibicaoLeilao({ fonte: 'vlance_multleiloes', fonte_tipo: 'privado' })).toBe('MultLeiloes')
    expect(fonteExibicaoLeilao({ fonte: 'vlance_cesvi', fonte_tipo: 'privado' })).toBe('Cesvi')
    expect(fonteExibicaoLeilao({ fonte: 'vlance_ajleiloes', fonte_tipo: 'privado', fonte_exibicao: 'Leiloeira particular' })).toBe('Ajleiloes')
  })

  it('approved name from the API wins; a label with the platform name is ignored', () => {
    expect(fonteExibicaoLeilao({ fonte: 'vlance_casaexemplo', fonte_tipo: 'privado', fonte_exibicao: 'Exemplo Leilões' })).toBe('Exemplo Leilões')
    expect(fonteExibicaoLeilao({ fonte: 'vlance_casaexemplo', fonte_tipo: 'privado', fonte_exibicao: 'Vlance Casaexemplo' })).toBe('Casaexemplo')
  })

  it('no readable house slug: "Leiloeira particular"', () => {
    expect(fonteExibicaoLeilao({ fonte: 'vlance_v3', fonte_tipo: 'privado' })).toBe('Leiloeira particular')
    expect(fonteExibicaoLeilao({ fonte: 'vlance_123', fonte_tipo: 'privado' })).toBe('Leiloeira particular')
    expect(fonteExibicaoLeilao({ fonte: 'leilotech', fonte_tipo: 'privado' })).toBe('Leiloeira particular')
  })

  it('host-based platforms show the house from the host, never the host itself', () => {
    expect(fonteExibicaoLeilao({ fonte: 'soleon_www.casaexemplo.com.br', fonte_tipo: 'privado' })).toBe('Casaexemplo')
    expect(fonteExibicaoLeilao({ fonte: 'sishp_casa-exemplo.com.br', fonte_tipo: 'privado' })).toBe('Casa Exemplo')
  })

  it('API timeline labels with a platform name show the house, never the platform', () => {
    const r: any = historicoParaExibicao({ passagens: [], linha_do_tempo: [{ data: '2026-03-10', tipo: 'leilao', nPassagens: 1, fontes: ['Vlance Cesvi', 'Vlance V3'] }] })
    expect(r.linha_do_tempo[0].fontes).toEqual(['Cesvi', 'Leiloeira particular'])
  })

  it('no platform key ever leaks the platform name', () => {
    for (const fonte of ['vlance_cesvi', 'vlance_v3', 'vlance_', 'soleon_x.com', 'soleon_casaexemplo.com.br', 'leilotech_topoexemplo', 'leilotech', 'sishp_1.2.3.4']) {
      const r = fonteExibicaoLeilao({ fonte, fonte_tipo: 'privado' })
      expect(r, fonte).not.toMatch(PLATAFORMA)
      expect(r, fonte).not.toMatch(/[a-z0-9]\.[a-z]{2,}(?![a-z])/i)
      expect(r, fonte).toBeTruthy()
    }
  })
})

describe('API card that absorbed a same-auction document (Lead item 8)', () => {
  const p = {
    fonte: 'detran_xx', fonte_tipo: 'detran', fonte_exibicao: 'Detran XX', nivel: 'confirmado', lote: '315', data_leilao: '2026-06-18',
    evidencias: ['placa completa igual', 'mesmo leilão também no documento da casa leiloeira (mesma data e lote)', 'mesmo leilao tambem em outro documento do Detran (mesmo lote)'],
    detalhes: { condicao: 'CONSERVADO', documentos_mesmo_evento: [{ casa: 'Exemplo Leilões', tipo_documento: 'edital' }, { casa: null, tipo_documento: 'catalogo' }] },
  }

  it('the new key never becomes a raw line in the card details', () => {
    const d = detalhesLegiveis(p.detalhes)
    expect(d).toEqual([{ rotulo: 'Condição', valor: 'Conservado' }])
    expect(JSON.stringify(d)).not.toMatch(/documentos_mesmo_evento|tipo_documento|\[object/)
  })

  it('evidence lines read as plain Portuguese', () => {
    expect(p.evidencias.map((e) => comAcentos(e))).toEqual([
      'placa completa igual',
      'mesmo leilão também no documento da casa leiloeira (mesma data e lote)',
      expect.stringMatching(/^mesmo leil[aã]o tamb[eé]m em outro documento do Detran \(mesmo lote\)$/),
    ])
  })

  it('display and privacy filters keep the passage intact', () => {
    const r: any = historicoNaTela({ resumo: {}, passagens: [p] }, SPIN)
    expect(r.passagens).toHaveLength(1)
    expect(fonteExibicaoLeilao(r.passagens[0])).toBe('Detran XX')
    expect(() => passagemLgpd(p)).not.toThrow()
    expect(passagemLgpd(p).detalhes.documentos_mesmo_evento).toHaveLength(2)
  })
})

describe('same auction in a strong direct and a canhao passage is one card (review 2 of PR #750)', () => {
  // Detran edital (provavel), the same Detran document found by the canhao on
  // the agency host (confirmado), and the agency notice published before.
  const h = {
    resumo: { tem_indicio: true, nivel_max: 'confirmado', n_confirmado: 2, n_provavel: 1, n_possivel: 0 },
    passagens: [
      { fonte: 'detran_xx', fonte_tipo: 'detran', fonte_exibicao: 'Detran XX', nivel: 'provavel', lote: '0315', data_leilao: '2026-06-18', detalhes: {} },
      { fonte: 'canhao:leilao.detran.xx.gov.br', fonte_tipo: 'privado', nivel: 'confirmado', lote: '315', data_leilao: '2026-06-18' },
      { fonte: 'detran_xx', fonte_tipo: 'detran', nivel: 'confirmado', situacao: 'notificado', detalhes: { tipo_registro: 'notificacao_leilao', data_publicacao: '2026-05-02', edital_numero: '7/2026' } },
    ],
    linha_do_tempo: null, recorrencia: null,
  }

  it('Detran case ends in one confirmado card with the notice line, count 1', () => {
    const r: any = historicoNaTela(h, SPIN)
    expect(r.passagens).toHaveLength(1)
    const card = r.passagens[0]
    expect(card.via_canhao).toBeUndefined()
    expect(card.fonte).toBe('detran_xx')
    expect(card.nivel).toBe('confirmado')
    expect(linhaNotificacao(card)).toBe('Notificado em 02/05/2026 (edital 7/2026)')
    expect(r.resumo).toMatchObject({ n_confirmado: 1, n_provavel: 0, n_possivel: 0, nivel_max: 'confirmado' })
  })

  it('same lot and date, general rule: the direct card takes the canhao level', () => {
    const r = passagensSemCanhao([
      { fonte: 'casa_x', fonte_tipo: 'privado', nivel: 'provavel', lote: '12', data_leilao: '2026-03-10' },
      { fonte: 'canhao:cdn.exemplo.net', fonte_tipo: 'privado', nivel: 'confirmado', lote: '012', data_leilao: '2026-03-10' },
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ fonte: 'casa_x', nivel: 'confirmado' })
  })

  it('a canhao passage of lower level never lowers the direct card', () => {
    const r = passagensSemCanhao([
      { fonte: 'casa_x', fonte_tipo: 'privado', nivel: 'confirmado', lote: '12', data_leilao: '2026-03-10' },
      { fonte: 'canhao:cdn.exemplo.net', fonte_tipo: 'privado', nivel: 'possivel', lote: '12', data_leilao: '2026-03-10' },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].nivel).toBe('confirmado')
  })

  it('a weak direct passage of another model still keeps the canhao card (first review case)', () => {
    const r: any = historicoNaTela({
      resumo: { tem_indicio: true },
      passagens: [
        { fonte: 'casa_x', fonte_tipo: 'privado', nivel: 'possivel', lote: '12', data_leilao: '2026-03-10', veiculo_na_fonte: ONIX_NA_FONTE },
        { fonte: 'canhao:cdn.exemplo.net', fonte_tipo: 'privado', nivel: 'confirmado', lote: '012', data_leilao: '2026-03-10' },
      ],
    }, SPIN)
    expect(r.passagens).toHaveLength(1)
    expect(r.passagens[0]).toMatchObject({ via_canhao: true, nivel: 'confirmado' })
  })
})

describe('small fixes of review 2 of PR #750', () => {
  it('empty or punctuation-only labels become "Leiloeira particular"', () => {
    expect(fonteExibicaoLeilao({ fonte: '---' })).toBe('Leiloeira particular')
    expect(fonteExibicaoLeilao({ fonte: '' })).toBe('Leiloeira particular')
    expect(fonteExibicaoLeilao({ fonte: 'casa_x', fonte_exibicao: '...' })).toBe('Casa X')
    expect(fonteExibicaoLeilao({ fonte: '---', fonte_exibicao: '...' })).toBe('Leiloeira particular')
    expect(fonteExibicaoLeilao({ fonte: 'canhao:cdn.exemplo.net', fonte_exibicao: '...' })).toBe('Leiloeira particular')
    expect(fonteExibicaoLeilao({ fonte: 'vlance_v3', fonte_exibicao: '---' })).toBe('Leiloeira particular')
  })

  it('API timeline labels go through the same function as the cards', () => {
    const h = {
      resumo: { tem_indicio: true },
      passagens: [{ fonte: 'vlance_cesvi', fonte_tipo: 'privado', fonte_exibicao: 'Vlance Cesvi', nivel: 'confirmado', lote: '3', data_leilao: '2026-02-02' }],
      linha_do_tempo: [{ data: '2026-02-02', dataFim: null, tipo: 'leilao', nPassagens: 1, fontes: ['Vlance Cesvi', 'Vlance_cesvi', 'Leiloeira', '...'] }],
    }
    const r: any = historicoParaExibicao(h)
    const card = fonteExibicaoLeilao(r.passagens[0])
    expect(card).toBe('Cesvi')
    expect(r.linha_do_tempo[0].fontes).toEqual(['Cesvi', 'Leiloeira particular'])
    expect(rotuloFonteLinhaDoTempo('Detran XX')).toBe('Detran XX')
    expect(rotuloFonteLinhaDoTempo('cdn.exemplo.net')).toBe('Leiloeira particular')
  })

  it('nested notice with only the agency plus the notice passage: only the notice card', () => {
    const lista = [
      { fonte: 'detran_xx', fonte_tipo: 'detran', nivel: 'confirmado', lote: '5', data_leilao: '2026-06-18', detalhes: { notificacao: { orgao: 'Detran XX' } } },
      { fonte: 'detran_xx', fonte_tipo: 'detran', nivel: 'confirmado', situacao: 'notificado', detalhes: { tipo_registro: 'notificacao_leilao', data_publicacao: '2026-05-02', edital_numero: '7/2026' } },
    ]
    const r = juntarNotificacoes(lista)
    expect(r).toHaveLength(2)
    expect(linhaNotificacao(r[0])).toBeNull()
    expect(ehNotificacao(r[1])).toBe(true)
    // Without the notice passage the nested line stays.
    expect(linhaNotificacao(juntarNotificacoes([lista[0]])[0])).toBe('Notificado para leilão')
  })
})
