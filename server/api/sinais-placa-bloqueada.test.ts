import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { montarSinais } from '../../tests/helpers/sinais-harness'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'

// A plate blocked at the owner's request (NUXT_BLOCKLIST_PLACAS) is refused by
// the free lookup and by the checkout. The routes below also take a plate (or
// a handle to data stored for one) and now honour the same block.
const BLOQUEADA = 'TST1A23'
const BLOQUEADA_FORMATO_ANTIGO = 'TST1023' // same vehicle, pre-Mercosul format
const LIVRE = 'TST9Z99'

beforeEach(() => { vi.stubEnv('NUXT_BLOCKLIST_PLACAS', BLOQUEADA) })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('auction signal: blocked plate', () => {
  it('answers the same as "no signal" and never reaches the base', async () => {
    const h = await montarSinais()
    expect(await h.leilao({ placa: BLOQUEADA, marca: 'MARCA', modelo: 'MODELO' })).toEqual({ positivo: null, quantidade: 0 })
    expect(h.estado.leilao).toHaveLength(0)
  })

  it('the answer is exactly what an unblocked plate gets when the base is unavailable', async () => {
    const fora = await montarSinais({ historico: () => null })
    const semSinal = await fora.leilao({ placa: LIVRE })
    const h = await montarSinais()
    expect(await h.leilao({ placa: BLOQUEADA })).toEqual(semSinal)
  })

  it('the other format of the same plate is blocked too', async () => {
    const h = await montarSinais()
    expect(await h.leilao({ placa: BLOQUEADA_FORMATO_ANTIGO })).toEqual({ positivo: null, quantidade: 0 })
    expect(await h.leilao({ placa: 'tst-1a23' })).toEqual({ positivo: null, quantidade: 0 })
    expect(h.estado.leilao).toHaveLength(0)
  })

  it('records the attempt like the other blocked routes do', async () => {
    const h = await montarSinais()
    await h.leilao({ placa: BLOQUEADA })
    expect(h.sb.tab('blocked_requests')).toHaveLength(1)
    expect(h.sb.tab('blocked_requests')[0]).toMatchObject({ reason: 'placa_bloqueada', placa: BLOQUEADA, ip_address: '203.0.113.10' })
  })

  it('an unblocked plate is answered from the base, as before', async () => {
    const h = await montarSinais()
    expect(await h.leilao({ placa: LIVRE })).toMatchObject({ positivo: true, quantidade: 1 })
    expect(h.estado.leilao).toHaveLength(1)
    expect(h.sb.tab('blocked_requests')).toHaveLength(0)
  })
})

describe('recall signal: blocked plate', () => {
  it('answers the same as "no signal" and never reaches the base', async () => {
    const h = await montarSinais()
    expect(await h.recall({ placa: BLOQUEADA, marca: 'TOYOTA', modelo: 'COROLLA' })).toEqual({ consta: null, nivel: null })
    expect(await h.recall({ placa: BLOQUEADA_FORMATO_ANTIGO, marca: 'TOYOTA', modelo: 'COROLLA' })).toEqual({ consta: null, nivel: null })
    expect(h.estado.recall).toHaveLength(0)
    expect(h.sb.tab('blocked_requests').map((l) => l.reason)).toEqual(['placa_bloqueada', 'placa_bloqueada'])
  })

  it('an unblocked plate is answered from the base, as before', async () => {
    const h = await montarSinais()
    expect(await h.recall({ placa: LIVRE, marca: 'TOYOTA', modelo: 'COROLLA' })).toEqual({ consta: true, nivel: 'suave' })
    expect(h.estado.recall).toHaveLength(1)
  })
})

describe('quote page data (GET /api/cotacao-info): blocked plate', () => {
  async function montar() {
    vi.resetModules()
    const sb = supabaseMemoria()
    const consulta = (id: string, placa: string) => ({
      id, placa, created_at: new Date().toISOString(), email: 'pessoa@example.com', phone: null, channel: 'email',
      geo_region_code: null, api_response: { MARCA: 'MARCA', MODELO: 'MODELO TESTE', anoModelo: '2021' },
    })
    sb.tab('consultas').push(consulta('11111111-1111-4111-8111-111111111111', BLOQUEADA))
    sb.tab('consultas').push(consulta('22222222-2222-4222-8222-222222222222', LIVRE))
    vi.stubGlobal('defineEventHandler', (fn: any) => fn)
    vi.stubGlobal('getQuery', (event: any) => event.query)
    vi.stubGlobal('useSupabaseServer', () => sb)
    vi.doMock('~/server/utils/seguro-estimate', () => ({ getSeguroEstimado: async () => null }))
    return (await import('./cotacao-info.get')).default as (event: any) => Promise<any>
  }
  afterEach(() => vi.doUnmock('~/server/utils/seguro-estimate'))

  it('a stored lookup of a blocked plate falls back to the generic page', async () => {
    const handler = await montar()
    expect(await handler({ query: { c: '11111111-1111-4111-8111-111111111111' } })).toEqual({ generic: true })
  })

  it('a stored lookup of another plate is served as before', async () => {
    const handler = await montar()
    const r = await handler({ query: { c: '22222222-2222-4222-8222-222222222222' } })
    expect(r).toMatchObject({ generic: false, veiculo: { placa: LIVRE, marca: 'MARCA', modelo: 'MODELO TESTE', ano: 2021 } })
  })
})

describe('renewing the Pix of an unpaid order (POST /api/premium/renovar-pix): blocked plate', () => {
  let provedor = 0
  async function montar() {
    vi.resetModules()
    provedor = 0
    const premium = supabaseMemoria()
    const pedido = (token: string, placa: string, extra: Record<string, any> = {}) => ({
      id: `pedido-${token}`, token_entrega: token, placa, status: 'aguardando_pagamento', valor_centavos: 4490,
      expira_em: new Date(Date.now() - 60_000).toISOString(), abacatepay_id: null, pix_provider: 'woovi', plano: 'completa',
      forma_pagamento: 'pix', ...extra,
    })
    premium.tab('pedidos_premium').push(pedido('tokenFicticioBloq01', BLOQUEADA))
    premium.tab('pedidos_premium').push(pedido('tokenFicticioLivre1', LIVRE, { forma_pagamento: 'cartao' }))
    vi.stubGlobal('defineEventHandler', (fn: any) => fn)
    vi.stubGlobal('readBody', async (event: any) => event.corpo)
    vi.stubGlobal('getRequestHeaders', (event: any) => event.cabecalhos || {})
    vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
    vi.stubGlobal('usePremiumSupabase', () => premium)
    vi.stubGlobal('provedorDoPedido', () => { provedor++; return { checarPix: async () => null } })
    vi.doMock('~/server/utils/supabase', () => ({ useSupabaseServer: () => supabaseMemoria() }))
    vi.doMock('~/server/utils/woovi', () => ({ cobrancaPorCorrelacao: async () => { provedor++; return null } }))
    return (await import('./premium/renovar-pix.post')).default as (event: any) => Promise<any>
  }
  afterEach(() => { vi.doUnmock('~/server/utils/supabase'); vi.doUnmock('~/server/utils/woovi') })

  it('is refused with the same message as the checkout, before any provider call', async () => {
    const handler = await montar()
    await expect(handler({ corpo: { token: 'tokenFicticioBloq01' }, cabecalhos: {} })).rejects.toMatchObject({
      statusCode: 403,
      message: 'A pedido do proprietário, a consulta desta placa está bloqueada em nossa base.',
    })
    expect(provedor).toBe(0)
  })

  it('an order for another plate goes on to the usual checks', async () => {
    const handler = await montar()
    await expect(handler({ corpo: { token: 'tokenFicticioLivre1' }, cabecalhos: {} })).rejects.toMatchObject({ statusCode: 409 })
  })
})
