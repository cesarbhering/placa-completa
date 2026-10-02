import { describe, it, expect, vi, beforeEach } from 'vitest'

// Os dois sinais da consulta gratis usam o chassi do SERVIDOR (placa_cache),
// nunca o do body; o chassi nao volta na resposta; teto por IP e cache por
// placa seguem valendo.

let cachePlaca: Record<string, any> = {}
vi.mock('../utils/placa-lookup', () => ({ lerPlacaCacheFresca: async (p: string) => cachePlaca[p] ?? null }))
const recall = vi.fn(async () => ({ matches: [{ nivel: 'firme' }] }))
vi.mock('../utils/recall-toyota', () => ({ consultarRecallToyota: (...a: any[]) => recall(...(a as [])) }))

let handlerLeilao: any, handlerRecall: any, ultimo: any
let body: any
let ip = '9.9.9.9'
const historico = vi.fn(async () => ({ passagens: [] }))
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('consultarHistoricoLeilao', (...a: any[]) => historico(...(a as [])))
vi.stubGlobal('defineEventHandler', (fn: any) => { ultimo = fn; return fn })
vi.mock('../utils/client-ip', () => ({ getClientIp: () => ip }))

await import('./leilao-sinal.post'); handlerLeilao = ultimo
await import('./recall-sinal.post'); handlerRecall = ultimo
const { _limparTetoDeSinal } = await import('../utils/sinal-leilao')

const COMPLETO = 'LJ11KAAB9KE000139'
beforeEach(() => {
  historico.mockClear(); recall.mockClear(); _limparTetoDeSinal()
  cachePlaca = {
    EUA9I10: { extra: { chassi: COMPLETO }, chassi: '*****00139' },
    GSZ6753: { extra: null, chassi: '*****55388' },
    CCC1C11: { extra: null, chassi: '*****11111' },
  }
})

describe('/api/leilao-sinal', () => {
  it('usa o chassi COMPLETO do placa_cache e ignora o do body', async () => {
    body = { placa: 'EUA9I10', chassi: 'XXXXX*****', marca: 'JAC' }
    const r = await handlerLeilao({})
    expect(historico.mock.calls[0][0]).toMatchObject({ placa: 'EUA9I10', chassi: COMPLETO })
    expect(JSON.stringify(r)).not.toContain('000139')
    expect(Object.keys(r).sort()).toEqual(['positivo', 'quantidade'])
  })
  it('sem extra: manda o sufixo mascarado', async () => {
    body = { placa: 'GSZ6753' }
    await handlerLeilao({})
    expect(historico.mock.calls[0][0].chassi).toBe('*****55388')
  })
  it('placa fora do cache: sem chassi (nem o do body)', async () => {
    body = { placa: 'AAA0A00', chassi: '9BWZZZ377VT004251' }
    await handlerLeilao({})
    expect(historico.mock.calls[0][0].chassi).toBeNull()
  })
  it('cache por placa segue valendo', async () => {
    body = { placa: 'CCC1C11' }
    await handlerLeilao({}); await handlerLeilao({})
    expect(historico).toHaveBeenCalledTimes(1)
  })
})

describe('/api/recall-sinal', () => {
  it('chassi completo do servidor vai pro recall (firme); body ignorado', async () => {
    body = { placa: 'EUA9I10', marca: 'TOYOTA', chassi: 'LIXO' }
    const r = await handlerRecall({})
    expect(recall.mock.calls[0][0]).toMatchObject({ chassi: COMPLETO })
    expect(r).toEqual({ consta: true, nivel: 'firme' })
  })
  it('so sufixo: recall vai sem chassi (casa por VIN cheio)', async () => {
    body = { placa: 'GSZ6753', marca: 'TOYOTA' }
    await handlerRecall({})
    expect(recall.mock.calls[0][0].chassi).toBeNull()
  })
})
