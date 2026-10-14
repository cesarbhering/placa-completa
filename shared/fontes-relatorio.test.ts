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
})
