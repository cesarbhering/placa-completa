// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { chaveDedupWoovi, primeiraVez, montarEmailFinanceiro, encaminharWebhookFinanceiro, pagadorWoovi, DESTINO_FINANCEIRO } from './woovi-financeiro'

const PAYLOAD = {
  event: 'OPENPIX:CHARGE_COMPLETED',
  charge: { value: 3990, status: 'COMPLETED', correlationID: 'ped-1', identifier: 'idf1', paidAt: '2026-10-08T12:00:00Z', payer: { name: 'FULANO DE TAL', taxID: { taxID: '12345678909', type: 'BR:CPF' } } },
  pix: { endToEndId: 'E123', time: '2026-10-08T12:00:00Z', value: 3990 },
}
const RAW = JSON.stringify(PAYLOAD)

afterEach(() => vi.unstubAllGlobals())

describe('e-mail pro financeiro', () => {
  it('resumo legivel no topo + JSON bruto embaixo, com nome e CPF', () => {
    const e = montarEmailFinanceiro(PAYLOAD, RAW, { id: 'ped-1', placa: 'ABC1D23', token_entrega: 'tok' })
    expect(e.subject).toBe('Woovi: OPENPIX:CHARGE_COMPLETED R$ 39,90 ABC1D23')
    expect(e.text).toContain('Valor: R$ 39,90')
    expect(e.text).toContain('endToEndId: E123')
    expect(e.text).toContain('Pagador: FULANO DE TAL')
    expect(e.text).toContain('CPF/CNPJ do pagador: 12345678909')
    expect(e.text).toContain('https://placacompleta.com.br/premium/tok')
    expect(e.text).toContain('"endToEndId": "E123"')
    expect(e.text).not.toContain('—')
  })
  it('pagador por payer, customer ou pix.payer', () => {
    expect(pagadorWoovi({ charge: { customer: { name: 'A', taxID: { taxID: '1' } } } })).toEqual({ nome: 'A', documento: '1' })
    expect(pagadorWoovi({ pix: { payer: { name: 'B', taxID: '2' } } })).toEqual({ nome: 'B', documento: '2' })
  })
  it('dedup: a 2a entrega do mesmo evento nao manda de novo', () => {
    const m = new Map<string, number>()
    const k = chaveDedupWoovi(PAYLOAD)
    expect(primeiraVez(k, 1000, m)).toBe(true)
    expect(primeiraVez(k, 31_000, m)).toBe(false)
    expect(primeiraVez(k, 1000 + 16 * 60_000, m)).toBe(true)
  })
  it('envia pela Resend, de contato@ pra financeiro@, uma vez so', async () => {
    const envios: any[] = []
    vi.stubGlobal('useRuntimeConfig', () => ({ resendApiKey: 're_x', public: {} }))
    vi.stubGlobal('$fetch', vi.fn(async (_u: string, o: any) => { envios.push(o.body); return {} }))
    const sb = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'ped-9', placa: 'XYZ9A99', token_entrega: 't9' } }) }) }) }) }
    const p = { ...PAYLOAD, charge: { ...PAYLOAD.charge, identifier: 'unico-1' } }
    expect(await encaminharWebhookFinanceiro(sb, p, JSON.stringify(p), 'ped-9', 'unico-1')).toBe(true)
    expect(await encaminharWebhookFinanceiro(sb, p, JSON.stringify(p), 'ped-9', 'unico-1')).toBe(false)
    expect(envios).toHaveLength(1)
    expect(envios[0].to).toEqual([DESTINO_FINANCEIRO])
    expect(envios[0].from).toBe('PlacaCompleta <contato@placacompleta.com.br>')
    expect(envios[0].subject).toContain('XYZ9A99')
  })
  it('fail-open: Resend fora nao lanca', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ resendApiKey: 're_x', public: {} }))
    vi.stubGlobal('$fetch', vi.fn(async () => { throw new Error('fora') }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sb = { from: () => { throw new Error('sem banco') } }
    const p = { ...PAYLOAD, charge: { ...PAYLOAD.charge, identifier: 'unico-2' } }
    await expect(encaminharWebhookFinanceiro(sb, p, JSON.stringify(p), '', 'unico-2')).resolves.toBe(false)
    // falhou: a 2a entrega tenta de novo
    vi.stubGlobal('$fetch', vi.fn(async () => ({})))
    await expect(encaminharWebhookFinanceiro(sb, p, JSON.stringify(p), '', 'unico-2')).resolves.toBe(true)
  })
})
