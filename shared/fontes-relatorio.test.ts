import { describe, it, expect } from 'vitest'
import { situacaoDasFontes, fonteConcluida, ESPERA_FONTES_MS } from './fontes-relatorio'

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
})
