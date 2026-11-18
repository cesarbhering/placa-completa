import { describe, it, expect } from 'vitest'
import { situacaoDasFontes, fonteConcluida, fonteNaoVemAgora, linhaEsperaFonte, ESPERA_FONTES_MS } from './fontes-relatorio'

const ENT = '2026-10-14T18:00:00Z'
const t0 = new Date(ENT).getTime()
const aplic = [{ fonte: 'detran' as const, rotulo: 'DETRAN-AL' }, { fonte: 'recall' as const, rotulo: 'Recall' }]

describe('estado das fontes lentas (Relatorio 2.0)', () => {
  it('dentro dos 5 min: o que falta esta consultando; o que chegou, ok', () => {
    const r = situacaoDasFontes({ entregueEm: ENT, agora: t0 + 60_000, aplicaveis: aplic, snapshot: { multas: { status: 'ok', fonte: 'detran_al' } } })
    expect(r.fontes.map((f) => f.estado)).toEqual(['ok', 'consultando'])
    expect(r.aguardarAte).toBe(t0 + ESPERA_FONTES_MS)
  })
  it('depois dos 5 min: com job na fila = chegando; sem job ou esgotado = indisponivel', () => {
    const base = { entregueEm: ENT, agora: t0 + ESPERA_FONTES_MS + 1, aplicaveis: aplic, snapshot: { multas: { status: 'indisponivel' } } }
    expect(situacaoDasFontes({ ...base, jobs: [{ fonte: 'detran', status: 'pendente' }, { fonte: 'recall', status: 'esgotado' }] }).fontes.map((f) => f.estado)).toEqual(['chegando', 'indisponivel'])
    expect(situacaoDasFontes(base).fontes.map((f) => f.estado)).toEqual(['indisponivel', 'indisponivel'])
  })
  it('DETRAN so conclui quando o IPVA da SEFAZ tambem chegou', () => {
    expect(fonteConcluida('detran', { multas: { status: 'ok', ipva_pendente_sefaz: true } })).toBe(false)
    expect(fonteConcluida('detran', { multas: { status: 'protegido' } })).toBe(true)
    expect(fonteConcluida('renajud', { renajudDetalhe: { status: 'indisponivel' } })).toBe(false)
  })
  it('vehicle history: done only with the block ok; failed or capped keeps waiting for the queue', () => {
    expect(fonteConcluida('historico_veicular', { historicoVeicular: { status: 'ok' } })).toBe(true)
    expect(fonteConcluida('historico_veicular', { historicoVeicular: { status: 'falhou' } })).toBe(false)
    expect(fonteConcluida('historico_veicular', { historicoVeicular: { status: 'teto' } })).toBe(false)
    expect(fonteConcluida('historico_veicular', {})).toBe(false)
    const aplicaveis = [{ fonte: 'historico_veicular' as const, rotulo: 'Donos, leilão e sinistro' }]
    expect(situacaoDasFontes({ entregueEm: ENT, agora: t0 + 60_000, aplicaveis, snapshot: {} }).fontes[0].estado).toBe('consultando')
    expect(situacaoDasFontes({ entregueEm: ENT, agora: t0 + ESPERA_FONTES_MS + 1, aplicaveis, snapshot: {}, jobs: [{ fonte: 'historico_veicular', status: 'pendente' }] }).fontes[0].estado).toBe('chegando')
  })
  it('vehicle history call failed or capped: no "consultando", whatever the failure (review 1, item 2)', () => {
    const aplicaveis = [{ fonte: 'historico_veicular' as const, rotulo: 'Donos, leilão e sinistro' }]
    const dentro = (historicoVeicular: any, jobs: any[] = []) => situacaoDasFontes({ entregueEm: ENT, agora: t0 + 60_000, aplicaveis, snapshot: { historicoVeicular }, jobs }).fontes[0].estado
    const casos = [
      { status: 'teto' },
      { status: 'falhou', motivo: 'saldo' },
      { status: 'falhou', motivo: 'autenticacao' },
      { status: 'falhou', motivo: 'erro' }, // timeout, 5xx, network
      { status: 'falhou' }, // block written before the failure kind existed
    ]
    const depois = (historicoVeicular: any, jobs: any[] = []) => situacaoDasFontes({ entregueEm: ENT, agora: t0 + ESPERA_FONTES_MS + 1, aplicaveis, snapshot: { historicoVeicular }, jobs }).fontes[0].estado
    for (const b of casos) {
      expect(fonteNaoVemAgora('historico_veicular', { historicoVeicular: b })).toBe(true)
      expect(fonteConcluida('historico_veicular', { historicoVeicular: b })).toBe(false) // the queue still tries
      expect(dentro(b, [{ fonte: 'historico_veicular', status: 'pendente' }])).toBe('chegando')
      // Inside the wait the queue job may not exist yet (review 2, item 4).
      expect(dentro(b)).toBe('chegando')
      // After the wait, only a job in the queue keeps it "chegando".
      expect(depois(b, [{ fonte: 'historico_veicular', status: 'pendente' }])).toBe('chegando')
      expect(depois(b)).toBe('indisponivel')
    }
    // Still out (no block yet): the screen waits for it.
    expect(dentro(undefined)).toBe('consultando')
    expect(fonteNaoVemAgora('detran', { historicoVeicular: { status: 'teto' } })).toBe(false)
  })
  it('waiting screen line: a tick only for what came (review 2, item 5)', () => {
    const r = 'Donos, leilão e sinistro'
    expect(linhaEsperaFonte({ rotulo: r, estado: 'consultando' })).toBe('Consultando Donos, leilão e sinistro…')
    expect(linhaEsperaFonte({ rotulo: r, estado: 'chegando' })).toBe('Donos, leilão e sinistro: chegando, avisamos por e-mail')
    expect(linhaEsperaFonte({ rotulo: r, estado: 'indisponivel' })).toBe('Donos, leilão e sinistro: indisponível agora')
    expect(linhaEsperaFonte({ rotulo: r, estado: 'ok' })).toBe('Donos, leilão e sinistro ✓')
    for (const estado of ['consultando', 'chegando', 'indisponivel']) expect(linhaEsperaFonte({ rotulo: r, estado })).not.toMatch(/✓|—/)
  })
  it('vehicle history for another VIN is a final answer: done, nothing to wait for', () => {
    expect(fonteConcluida('historico_veicular', { historicoVeicular: { status: 'divergente' } })).toBe(true)
  })
})

// Review of PR #762: a complement (SEFAZ IPVA, RJ fines) can stay pending for
// good (process down, final write lost). With the time it was marked, the mark
// holds 15 minutes; after that the DETRAN source is done and the screen says
// the value did not come.
describe('pending complement of the DETRAN block', () => {
  const agora = Date.parse('2026-11-18T15:00:00Z')
  const ha = (min: number) => new Date(agora - min * 60_000).toISOString()
  it('holds the source for 15 minutes, then no longer', () => {
    for (const marca of ['ipva_pendente_sefaz', 'nada_consta_pendente']) {
      expect(fonteConcluida('detran', { multas: { status: 'ok', [marca]: true, [`${marca}_em`]: ha(14) } }, agora)).toBe(false)
      expect(fonteConcluida('detran', { multas: { status: 'ok', [marca]: true, [`${marca}_em`]: ha(16) } }, agora)).toBe(true)
    }
    const aplicaveis = [{ fonte: 'detran' as const, rotulo: 'DETRAN-MG' }]
    const estado = (min: number) => situacaoDasFontes({ entregueEm: ha(20), agora, aplicaveis, snapshot: { multas: { status: 'ok', ipva_pendente_sefaz: true, ipva_pendente_sefaz_em: ha(min) } } }).fontes[0]!.estado
    expect(estado(16)).toBe('ok')
    expect(estado(1)).toBe('indisponivel')
  })
  it('without the time (AL and DF) the mark holds until it is cleared, as before', () => {
    expect(fonteConcluida('detran', { multas: { status: 'ok', ipva_pendente_sefaz: true } }, agora)).toBe(false)
  })
})
