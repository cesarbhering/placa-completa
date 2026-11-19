import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { ehNotificacao, notificacaoCoberta, eventoNotificadoCoberto, tituloNotificacao, camposNotificacao, lerEditalNotificacao, contarPassagens, GRAVIDADE_NOTIFICADO } from './leilao-notificacao'

// Linha real do indice (AIC2103, DETRAN-RJ), como a /v1 devolve hoje.
const rj = {
  nivel: 'confirmado', fonte_uf: 'RJ', situacao: 'notificado', data_leilao: '2010-06-09',
  ref: 'NOT:leilão_D.O._07.05.2010', detalhes: { situacao: 'notificado', tipo_registro: 'notificacao_leilao' },
  gravidade: { nivel: 'patio', cor: 'amarelo', rotulo: 'Leilão de pátio (DETRAN)' },
}

describe('notificacao para leilao', () => {
  it('reconhece pela situacao, pelo tipo_registro ou pela gravidade nova', () => {
    expect(ehNotificacao(rj)).toBe(true)
    expect(ehNotificacao({ situacao: 'NOTIFICADO' })).toBe(true)
    expect(ehNotificacao({ detalhes: { tipo_registro: 'notificacao_leilao' } })).toBe(true)
    expect(ehNotificacao({ gravidade: { nivel: 'notificado' } })).toBe(true)
  })

  it('leilao realizado nao e notificacao, mesmo com sucata no texto', () => {
    expect(ehNotificacao({ situacao: 'SUCATA', detalhes: { tipo_registro: 'edital_leilao' } })).toBe(false)
    expect(ehNotificacao(null)).toBe(false)
    expect(ehNotificacao({ detalhes: [] })).toBe(false)
  })

  it('titulo com leilao previsto so quando a data e mesmo a do leilao', () => {
    expect(tituloNotificacao(rj)).toBe('Notificado para leilão pelo DETRAN-RJ (leilão previsto para 09/06/2010)')
    // data do indice = publicacao do D.O.: nao e data de leilao
    expect(tituloNotificacao({ ...rj, ref: 'NOT:leilão_D.O._01.11.2011', data_leilao: '2011-11-01' }))
      .toBe('Notificado para leilão pelo DETRAN-RJ')
    expect(tituloNotificacao({ fonte_uf: null })).toBe('Notificado para leilão pelo DETRAN')
    expect(camposNotificacao(rj, { semPrevista: true }).map((c) => c.rotulo)).toEqual(['Órgão', 'Publicação'])
  })

  it('campos do edital do RJ: publicacao do D.O. e leilao previsto, nunca o nome do arquivo', () => {
    const c = camposNotificacao(rj)
    expect(c).toEqual([
      { rotulo: 'Órgão', valor: 'DETRAN-RJ' },
      { rotulo: 'Publicação', valor: '07/05/2010' },
      { rotulo: 'Leilão previsto para', valor: '09/06/2010' },
    ])
    expect(JSON.stringify(c)).not.toMatch(/NOT:|D\.O\._|\.pdf|http|—/)
  })

  it('data do indice igual a publicacao nao vira "leilao previsto"', () => {
    const c = camposNotificacao({ ...rj, ref: 'NOT:leilão_D.O._01.11.2011', data_leilao: '2011-11-01' })
    expect(c.map((x) => x.rotulo)).toEqual(['Órgão', 'Publicação'])
  })

  it('serie, tipo e retificacao saem legiveis; sucata_prensada vira tipo', () => {
    const c = camposNotificacao({ ...rj, ref: 'NOT:edital_convocacao_04_2013_sucata_prensada', data_leilao: null })
    expect(c).toContainEqual({ rotulo: 'Edital', valor: '04/2013' })
    expect(c).toContainEqual({ rotulo: 'Tipo', valor: 'Inservível (sucata)' })
    expect(JSON.stringify(c)).not.toMatch(/prensada|convocacao/)
    expect(lerEditalNotificacao('NOT:edital_de_notificação_leilao_LD05_2015_recuperavel'))
      .toEqual({ numero: 'LD 05/2015', publicacao: null, tipo: 'Recuperável', retificacao: false })
    expect(lerEditalNotificacao('NOT:DO_LD001_2014').numero).toBe('LD 001/2014')
    expect(lerEditalNotificacao('NOT:edital_detrarj_001_2017').numero).toBe('001/2017')
    expect(lerEditalNotificacao('NOT:RETIFICACAO_edital_notificacao_retirada_japeri'))
      .toEqual({ numero: null, publicacao: null, tipo: 'Retirada', retificacao: true })
    expect(lerEditalNotificacao('arquivo_qualquer_sem_forma').numero).toBeNull()
  })

  it('campos do contrato em detalhes vencem a leitura do ref; URL nunca aparece', () => {
    const c = camposNotificacao({
      fonte_uf: 'MT', ref: 'x', lote: '12',
      detalhes: {
        tipo_registro: 'notificacao_leilao', edital_numero: '003/2026', data_publicacao: '2026-08-01',
        data_prevista_leilao: '2026-09-15', patio: 'Pátio Cuiabá', tipo_notificacao: 'Recolhimento',
        url: 'https://x/edital.pdf',
      },
    })
    expect(c).toEqual([
      { rotulo: 'Edital', valor: '003/2026' },
      { rotulo: 'Órgão', valor: 'DETRAN-MT' },
      { rotulo: 'Publicação', valor: '01/08/2026' },
      { rotulo: 'Leilão previsto para', valor: '15/09/2026' },
      { rotulo: 'Pátio', valor: 'Pátio Cuiabá' },
      { rotulo: 'Lote', valor: '12' },
      { rotulo: 'Tipo', valor: 'Recolhimento' },
    ])
  })

  it('contagem tira notificacao de confirmado, e ignora notificacao fraca', () => {
    const c = contarPassagens([
      rj, { ...rj, nivel: 'provavel' }, { ...rj, nivel: 'possivel' },
      { nivel: 'confirmado', situacao: 'ARREMATADO' }, { nivel: 'possivel' },
    ])
    expect(c).toEqual({ confirmado: 1, provavel: 0, possivel: 1, notificado: 2 })
    expect(contarPassagens(null)).toEqual({ confirmado: 0, provavel: 0, possivel: 0, notificado: 0 })
  })

  it('gravidade fixa e cinza', () => {
    expect(GRAVIDADE_NOTIFICADO.cor).toBe('cinza')
    expect(GRAVIDADE_NOTIFICADO.nivel).toBe('notificado')
  })
})

describe('notice hidden only by a confirmed auction of the same agency (Cesar, 19/11/2026)', () => {
  // Real case (DETRAN-DF 01/2026): the notice comes with nivel 'confirmado' and
  // situacao 'notificado'; the catalog lot comes as an auction notice of the same source.
  const notificacao = { nivel: 'confirmado', situacao: 'notificado', fonte: 'detran_df', fonte_exibicao: 'DETRAN-DF', ref: '01/2026', lote: null, detalhes: { tipo_registro: 'notificacao_leilao' } }
  const loteNoCatalogo = { nivel: 'confirmado', situacao: null, fonte: 'detran_df', fonte_exibicao: 'DETRAN-DF', ref: '01/2026', lote: '0563', detalhes: { tipo_registro: 'edital_leilao' } }
  const outroOrgao = { ...loteNoCatalogo, fonte: 'copart', fonte_exibicao: 'Copart', lote: '9' }

  it('a confirmed auction of the same agency covers the notice', () => {
    expect(notificacaoCoberta(notificacao, [notificacao, loteNoCatalogo])).toBe(true)
    expect(notificacaoCoberta({ ...notificacao, fonte: ' DETRAN_DF ' }, [loteNoCatalogo])).toBe(true)
  })

  it('a confirmed auction of another agency does not cover it', () => {
    expect(notificacaoCoberta(notificacao, [notificacao, outroOrgao])).toBe(false)
  })

  it('the notice alone, or a possible/probable auction, does not cover it', () => {
    expect(notificacaoCoberta(notificacao, [notificacao])).toBe(false)
    expect(notificacaoCoberta(notificacao, [{ ...loteNoCatalogo, nivel: 'possivel' }])).toBe(false)
    expect(notificacaoCoberta(notificacao, [{ ...loteNoCatalogo, nivel: 'provavel' }])).toBe(false)
  })

  it('without a source on either side it shows (in doubt, show)', () => {
    expect(notificacaoCoberta({ ...notificacao, fonte: '' }, [loteNoCatalogo])).toBe(false)
    expect(notificacaoCoberta(notificacao, [{ ...loteNoCatalogo, fonte: null }])).toBe(false)
  })

  it('only notices are covered, and bad input does not break', () => {
    expect(notificacaoCoberta(loteNoCatalogo, [loteNoCatalogo])).toBe(false)
    expect(notificacaoCoberta(notificacao, undefined)).toBe(false)
    expect(notificacaoCoberta(null, [loteNoCatalogo])).toBe(false)
    expect(notificacaoCoberta(notificacao, [null, 1, 'x'])).toBe(false)
  })

  it('API timeline: a notice event goes away only when all its sources are covered', () => {
    const passagens = [notificacao, loteNoCatalogo]
    expect(eventoNotificadoCoberto({ tipo: 'notificado', fontes: ['DETRAN-DF'] }, passagens)).toBe(true)
    // Another agency's notice stays: its event keeps showing.
    const rj = { ...notificacao, fonte: 'detran_rj', fonte_exibicao: 'DETRAN-RJ' }
    expect(eventoNotificadoCoberto({ tipo: 'notificado', fontes: ['DETRAN-RJ'] }, [...passagens, rj])).toBe(false)
    expect(eventoNotificadoCoberto({ tipo: 'notificado', fontes: ['DETRAN-DF', 'DETRAN-RJ'] }, [...passagens, rj])).toBe(false)
    // No sources, or not a notice event: stays.
    expect(eventoNotificadoCoberto({ tipo: 'notificado', fontes: [] }, passagens)).toBe(false)
    expect(eventoNotificadoCoberto({ tipo: 'leilao', fontes: ['DETRAN-DF'] }, passagens)).toBe(false)
    expect(eventoNotificadoCoberto({ tipo: 'notificado', fontes: ['DETRAN-DF'] }, null)).toBe(false)
  })
})

describe('report page wiring of the same-agency rule', () => {
  const fonte = readFileSync(resolve(__dirname, '../pages/premium/[token].vue'), 'utf8')
  it('notice cards and both timeline paths use the same-agency rule', () => {
    expect(fonte).toContain('notificacaoCoberta: notificacaoCoberta(p, lista)')
    expect(fonte).toMatch(/p\.nivel === 'possivel' \|\| p\.notificacaoCoberta\) return false/)
    expect(fonte).toContain(': !notificacaoCoberta(p, passagens)))')
    expect(fonte).toContain('api.filter((e: any) => !eventoNotificadoCoberto(e, passagens))')
    expect(fonte).not.toContain('haLeilaoConfirmado')
  })
})

