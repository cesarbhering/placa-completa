import { describe, it, expect } from 'vitest'
import { ehNotificacao, tituloNotificacao, contarPassagens, GRAVIDADE_NOTIFICADO } from './leilao-notificacao'

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

  it('titulo com orgao e data, sem travessao', () => {
    expect(tituloNotificacao(rj)).toBe('Notificado para leilão pelo DETRAN-RJ (leilão previsto para 09/06/2010)')
    expect(tituloNotificacao({ ...rj, data_leilao: null })).toBe('Notificado para leilão pelo DETRAN-RJ')
    expect(tituloNotificacao({ fonte_uf: null, data_leilao: 'lixo' })).toBe('Notificado para leilão pelo DETRAN')
    expect(tituloNotificacao(rj)).not.toContain('—')
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
