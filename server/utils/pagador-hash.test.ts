import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { digitosDoc, hmacPagador, hashDoPagador, sanearPayloadWebhook, gravarPagadorHash } from './pagador-hash'

const CPF = '123.456.789-09'
const SEG = 'segredo-de-teste'

function fakeSb() {
  const updates: any[] = []
  return { updates, from: () => ({ update: (row: any) => ({ eq: async (_c: string, id: string) => { updates.push({ id, row }); return { error: null } } }) }) }
}

describe('identificador pseudonimizado do pagador', () => {
  afterEach(() => vi.restoreAllMocks())

  it('normaliza pra digitos; so CPF (11) ou CNPJ (14)', () => {
    expect(digitosDoc(CPF)).toBe('12345678909')
    expect(digitosDoc('12.345.678/0001-95')).toBe('12345678000195')
    expect(digitosDoc('123')).toBeNull()
    expect(digitosDoc(null)).toBeNull()
  })
  it('HMAC estavel e igual pra formatos diferentes do mesmo CPF', () => {
    const esperado = createHmac('sha256', SEG).update('12345678909').digest('hex')
    expect(hmacPagador('12345678909', SEG)).toBe(esperado)
    expect(hashDoPagador(CPF, SEG)).toBe(esperado)
    expect(hashDoPagador('12345678909', SEG)).toBe(esperado)
    expect(hashDoPagador(CPF, 'outro')).not.toBe(esperado)
  })
  it('sem segredo: nao calcula', () => {
    expect(hashDoPagador(CPF, '')).toBeNull()
    expect(hashDoPagador(CPF, null)).toBeNull()
  })
  it('grava so o hash; CPF e nome nunca vao pro banco nem pro log', async () => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const sb = fakeSb()
    await gravarPagadorHash(sb, { id: 'p1', pix_provider: 'woovi', abacatepay_id: 'ch1', forma_pagamento: 'pix' }, { segredo: SEG, documentoWoovi: async () => CPF })
    expect(sb.updates).toEqual([{ id: 'p1', row: { pagador_hash: hashDoPagador(CPF, SEG) } }])
    const tudo = JSON.stringify([sb.updates, log.mock.calls, info.mock.calls])
    expect(tudo).not.toContain('12345678909')
    expect(tudo).not.toContain(CPF)
  })
  it('erro no provedor: nao lanca e o log nao tem dado do pagador', async () => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sb = fakeSb()
    await gravarPagadorHash(sb, { id: 'p1', pix_provider: 'woovi', abacatepay_id: 'ch1' }, { segredo: SEG, documentoWoovi: async () => { throw new Error(`falhou ${CPF}`) } })
    expect(sb.updates).toHaveLength(0)
    expect(JSON.stringify(log.mock.calls)).not.toContain('123.456')
  })
  it('cartao: fingerprint opaco da Stripe', async () => {
    const sb = fakeSb()
    await gravarPagadorHash(sb, { id: 'p2', forma_pagamento: 'cartao', stripe_session_id: 'pi_123' }, { segredo: SEG, fingerprintStripe: async () => 'Xt5EWLLDS7FJjR1c' })
    expect(sb.updates).toEqual([{ id: 'p2', row: { pagador_hash_cartao: 'Xt5EWLLDS7FJjR1c' } }])
  })
  it('payload de webhook sem dados do pagador', () => {
    const p = { event: 'OPENPIX:CHARGE_COMPLETED', charge: { correlationID: 'x', value: 3990, payer: { name: 'Fulano', taxID: { taxID: '12345678909' } }, customer: { name: 'Fulano' } }, pix: { payer: { taxID: { taxID: '12345678909' } } }, data: { object: { billing_details: { name: 'Fulano', email: 'a@b.c' } } } }
    const s = sanearPayloadWebhook(p)
    expect(JSON.stringify(s)).not.toMatch(/Fulano|12345678909|a@b\.c/)
    expect(s.charge.correlationID).toBe('x')
    expect(s.charge.value).toBe(3990)
    expect(p.charge.payer.name).toBe('Fulano') // original intacto (o handler ainda usa)
  })
})
