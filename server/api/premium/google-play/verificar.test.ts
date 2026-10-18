import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseMemoria } from '../../../../tests/helpers/supabase-memoria'

// O /verificar e a porta do app: confere com a Google, cria o pedido pago e
// grava o comprovante em google_play_compras em TODA chamada. A logica fica em
// server/utils/google-play-compras.ts (testada la); aqui, o contrato HTTP.

const compra: any = {}
const resetCompra = () => Object.assign(compra, {
  ok: true, motivo: null, estado: 'pago', orderId: 'GPA.1', purchaseState: 0, consumptionState: 0,
  acknowledgementState: 1, productId: 'consulta_completa', consumida: false, teste: false, contaExterna: null,
})
const consultarCompra = vi.fn(async () => ({ ...compra }))
const consumirCompra = vi.fn(async () => ({ ok: true, error: null }))
vi.mock('../../../utils/google-play', () => ({
  PRODUTO_COMPLETA: 'consulta_completa',
  consultarCompra: (...a: any[]) => consultarCompra(...(a as [])),
  consultarPedidoGoogle: async () => ({ valorCentavos: 3999, liquidoCentavos: 3399, estado: 'PROCESSED' }),
  consumirCompra: (...a: any[]) => consumirCompra(...(a as [])),
}))

let handler: any
let body: any
let sb: ReturnType<typeof supabaseMemoria>
let status: number | undefined
const processar = vi.fn(async () => {})

vi.stubGlobal('defineEventHandler', (fn: any) => { handler = fn; return fn })
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
vi.stubGlobal('assertPremiumGate', () => {})
vi.stubGlobal('usePremiumSupabase', () => sb)
vi.stubGlobal('useRuntimeConfig', () => ({ public: { homolog: false } }))
vi.stubGlobal('getClientIp', () => '1.2.3.4')
vi.stubGlobal('getDispositivo', () => ({ dispositivo: 'celular', sistema: 'Android' }))
vi.stubGlobal('setResponseStatus', (_e: any, s: number) => { status = s })
vi.stubGlobal('processarPedidoPago', processar)

await import('./verificar.post')

const pedidoValido = () => ({ placa: 'ABC1D23', productId: 'consulta_completa', purchaseToken: 'tok-abc', orderId: 'GPA.1' })
const pedidos = () => sb.tab('pedidos_premium')
const compras = () => sb.tab('google_play_compras')

describe('POST /api/premium/google-play/verificar', () => {
  beforeEach(() => {
    sb = supabaseMemoria({ unicos: { pedidos_premium: ['google_play_purchase_token'], google_play_compras: ['purchase_token'] } })
    body = pedidoValido()
    status = undefined
    resetCompra()
    consultarCompra.mockClear()
    processar.mockClear()
  })

  it('cria o pedido google_play com o preco da Play, nunca o que o app mandou', async () => {
    body.valor = 1
    const r = await handler({})
    expect(r.token_entrega).toBeTruthy()
    expect(r.valor_centavos).toBe(3999)
    expect(pedidos()[0]).toMatchObject({ valor_centavos: 3999, plano: 'completa', status: 'pago', pix_provider: 'google_play', forma_pagamento: 'google_play', ip_address: '1.2.3.4', dispositivo: 'celular' })
    expect(compras()[0]).toMatchObject({ purchase_token: 'tok-abc', pedido_id: pedidos()[0].id, origem: 'app' })
    expect(processar).toHaveBeenCalledOnce()
  })

  it('grava a porta de entrada do checkout (so o enum)', async () => {
    body.origem_checkout = 'barra_fixa'
    await handler({})
    expect(pedidos()[0].origem_checkout).toBe('barra_fixa')
    body = { ...pedidoValido(), purchaseToken: 'tok-2', origem_checkout: 'lixo' }
    await handler({})
    expect(pedidos()[1].origem_checkout).toBeNull()
  })

  it('reenvio do mesmo comprovante devolve o pedido antigo, sem consultar a Google de novo', async () => {
    const r1 = await handler({})
    consultarCompra.mockClear()
    const r2 = await handler({})
    expect(r2).toEqual({ token_entrega: r1.token_entrega, repetido: true })
    expect(consultarCompra).not.toHaveBeenCalled()
    expect(pedidos()).toHaveLength(1)
  })

  it('compra ja consumida no celular e sem pedido (BAN0G13) e entregue', async () => {
    Object.assign(compra, { consumptionState: 1, consumida: true })
    const r = await handler({})
    expect(r.token_entrega).toBeTruthy()
    expect(pedidos()).toHaveLength(1)
  })

  it('pagamento pendente responde 202 {pendente: true} e guarda a compra', async () => {
    Object.assign(compra, { ok: false, estado: 'pendente', motivo: 'pagamento pendente', purchaseState: 2 })
    const r = await handler({})
    expect(status).toBe(202)
    expect(r.pendente).toBe(true)
    expect(r.message).not.toMatch(/—/)
    expect(pedidos()).toHaveLength(0)
    expect(compras()[0]).toMatchObject({ estado_google: 'pendente', placa: 'ABC1D23' })
  })

  it('compra cancelada devolve 402, sem pedido, mas com comprovante', async () => {
    Object.assign(compra, { ok: false, estado: 'cancelada', motivo: 'compra cancelada', purchaseState: 1 })
    await expect(handler({})).rejects.toMatchObject({ statusCode: 402 })
    expect(pedidos()).toHaveLength(0)
    expect(compras()[0].estado_google).toBe('cancelada')
  })

  it('compra de teste da Play vira pedido com ambiente teste', async () => {
    compra.teste = true
    await handler({})
    expect(pedidos()[0].ambiente).toBe('teste')
  })

  it('produto diferente do unico que o app vende e recusado', async () => {
    body.productId = 'consulta_barata'
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
    expect(consultarCompra).not.toHaveBeenCalled()
    expect(compras()).toHaveLength(0)
  })

  it('compra sem comprovante nao chega a perguntar nada pra Google', async () => {
    body.purchaseToken = ''
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
    expect(consultarCompra).not.toHaveBeenCalled()
  })
})
