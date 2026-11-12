import { describe, it, expect } from 'vitest'
import { blocoNfse, colunasNfseRelatorio } from './nfse-bloco'

const base = {
  nfse_status: 'emitida', nfse_numero: '42', nfse_serie: '1',
  nfse_emitida_em: '2026-11-12T20:00:00Z', nfse_cancelada_em: null, valor_centavos: 1990,
}

describe('blocoNfse', () => {
  it('returns the block for an issued note with the flag on', () => {
    expect(blocoNfse(base, 'tok12345', { nfse: 'on' })).toEqual({
      status: 'emitida', numero: '42', serie: '1',
      emitida_em: '2026-11-12T20:00:00Z', cancelada_em: null, valor_centavos: 1990,
      pdf: '/api/premium/nfse/tok12345/pdf',
    })
  })
  it('returns the block for a cancelled note', () => {
    const b = blocoNfse({ ...base, nfse_status: 'cancelada', nfse_cancelada_em: '2026-11-13T10:00:00Z' }, 't', { nfse: 'on' })
    expect(b?.status).toBe('cancelada')
    expect(b?.cancelada_em).toBe('2026-11-13T10:00:00Z')
  })
  it.each(['enfileirada', 'a_enfileirar', 'rejeitada', 'falhou', 'fora_escopo', null, undefined])('null for status %s', (s) => {
    expect(blocoNfse({ ...base, nfse_status: s as any }, 't', { nfse: 'on' })).toBeNull()
  })
  it('null when the flag is off or missing', () => {
    expect(blocoNfse(base, 't', { nfse: '' })).toBeNull()
    expect(blocoNfse(base, 't', {})).toBeNull()
  })
})

describe('colunasNfseRelatorio', () => {
  it('adds no nfse_ column with the flag off, empty or missing', () => {
    expect(colunasNfseRelatorio({ nfse: 'off' })).toBe('')
    expect(colunasNfseRelatorio({ nfse: '' })).toBe('')
    expect(colunasNfseRelatorio({})).toBe('')
    expect(colunasNfseRelatorio(undefined)).toBe('')
  })
  it('adds the nfse_ columns blocoNfse needs with the flag on', () => {
    const c = colunasNfseRelatorio({ nfse: 'on' })
    expect(c.startsWith(',')).toBe(true)
    for (const k of ['nfse_status', 'nfse_numero', 'nfse_serie', 'nfse_emitida_em', 'nfse_cancelada_em', 'nfse_id']) expect(c).toContain(k)
  })
})
