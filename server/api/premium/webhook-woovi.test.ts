// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { lerPayloadWoovi, ehPingWoovi } from '../../utils/woovi-webhook-payload'

// 06/out: registro do webhook recusado. Payload EXATO do teste da Woovi:
const TESTE_WOOVI = '"{\\"data_criacao\\":\\"2026-10-06T20:47:17.290Z\\",\\"evento\\":\\"teste_webhook\\",\\"event\\":\\"OPENPIX:CHARGE_COMPLETED\\"}"'

const verificar = vi.fn(() => false)
vi.mock('../../utils/woovi', () => ({ chavesPublicas: async () => ['k'], verificarAssinatura: (...a: any[]) => verificar(...a) }))
vi.mock('../../utils/pagador-hash', () => ({ gravarPagadorHash: vi.fn(), sanearPayloadWebhook: (p: any) => p }))

let raw = ''; let headers: Record<string, string> = {}
const processar = vi.fn(); const supa = vi.fn()
beforeEach(() => {
  verificar.mockReset(); verificar.mockReturnValue(false); processar.mockReset(); supa.mockReset()
  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('readRawBody', async () => raw)
  vi.stubGlobal('getRequestHeader', (_e: any, h: string) => headers[h])
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
  vi.stubGlobal('usePremiumSupabase', () => { supa(); throw new Error('nao devia tocar no banco') })
  vi.stubGlobal('processarPedidoPago', processar)
})
afterEach(() => vi.unstubAllGlobals())

async function chamar(corpo: string, assinatura?: string) {
  raw = corpo; headers = assinatura ? { 'x-webhook-signature': assinatura } : {}
  const { default: h } = await import('./webhook-woovi')
  return h({ method: 'POST' } as any)
}

describe('payload da Woovi', () => {
  it('parse duplo do JSON string', () => {
    expect(lerPayloadWoovi(TESTE_WOOVI)).toEqual({ data_criacao: '2026-10-06T20:47:17.290Z', evento: 'teste_webhook', event: 'OPENPIX:CHARGE_COMPLETED' })
    expect(lerPayloadWoovi('{"event":"x"}')).toEqual({ event: 'x' })
    expect(lerPayloadWoovi('lixo')).toEqual({})
    expect(lerPayloadWoovi('')).toEqual({})
  })
  it('ping se evento OU event disser teste', () => {
    expect(ehPingWoovi({ evento: 'teste_webhook', event: 'OPENPIX:CHARGE_COMPLETED' })).toBe(true)
    expect(ehPingWoovi({ event: 'OPENPIX:CHARGE_COMPLETED' })).toBe(false)
  })
})

describe('handler', () => {
  it('teste da Woovi SEM assinatura: 200, nada processado', async () => {
    expect(await chamar(TESTE_WOOVI)).toEqual({ ok: true, ping: true })
    expect(processar).not.toHaveBeenCalled(); expect(supa).not.toHaveBeenCalled()
  })
  it('teste da Woovi COM assinatura (mesmo invalida): 200, nada processado', async () => {
    expect(await chamar(TESTE_WOOVI, 'assinatura-qualquer')).toEqual({ ok: true, ping: true })
    expect(verificar).not.toHaveBeenCalled(); expect(processar).not.toHaveBeenCalled(); expect(supa).not.toHaveBeenCalled()
  })
  it('evento real com assinatura invalida: 401', async () => {
    const real = JSON.stringify({ event: 'OPENPIX:CHARGE_COMPLETED', charge: { correlationID: 'p1', status: 'COMPLETED' } })
    await expect(chamar(real, 'falsa')).rejects.toMatchObject({ statusCode: 401 })
    expect(processar).not.toHaveBeenCalled(); expect(supa).not.toHaveBeenCalled()
  })
  it('evento real duplamente codificado com assinatura invalida: 401', async () => {
    const real = JSON.stringify(JSON.stringify({ event: 'OPENPIX:CHARGE_COMPLETED', charge: { correlationID: 'p1' } }))
    await expect(chamar(real, 'falsa')).rejects.toMatchObject({ statusCode: 401 })
  })
})
