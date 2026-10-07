// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { extrairChavesPublicas, pedidoDaCorrelacao, cobrancaPorCorrelacao, criarPixTransparente } from './woovi'
import { deveChecarWooviOriginal } from './status-pagamento'

// 07/out, RBF5A06: Pix Woovi pago, webhook nunca chegou (chaves publicas lidas
// do campo errado => todo webhook real 401), e a renovacao repetiu o
// correlationID, a Woovi recusou e a cobranca caiu na AbacatePay por cima.

afterEach(() => vi.unstubAllGlobals())
const PEM = '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC\n-----END PUBLIC KEY-----'

describe('chaves publicas da Woovi', () => {
  it('le o formato real (public_keys[].key)', () => {
    expect(extrairChavesPublicas({ public_keys: [{ key_identifier: 'x', is_current: true, key: PEM }] })).toEqual([PEM])
  })
  it('formatos antigos continuam', () => {
    expect(extrairChavesPublicas({ publicKeys: [{ publicKey: PEM }] })).toEqual([PEM])
    expect(extrairChavesPublicas([PEM])).toEqual([PEM])
    expect(extrairChavesPublicas({})).toEqual([])
  })
})

describe('correlationID', () => {
  it('renovacao <pedido>-r<sufixo> volta pro pedido; uuid puro fica igual', () => {
    const id = '4c9107f5-2a92-4450-a749-1ced717e73b0'
    expect(pedidoDaCorrelacao(id)).toBe(id)
    expect(pedidoDaCorrelacao(`${id}-rmgf0abc`)).toBe(id)
    expect(pedidoDaCorrelacao(null)).toBe('')
  })
  it('criar usa a correlacao nova quando vem (renovacao)', async () => {
    const bodies: any[] = []
    vi.stubGlobal('useRuntimeConfig', () => ({ wooviAppId: 'app', wooviBase: 'https://w' }))
    vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
    vi.stubGlobal('$fetch', vi.fn(async (_u: string, o: any) => { bodies.push(o.body); return { charge: { identifier: 'i1', brCode: '000201x', status: 'ACTIVE' } } }))
    await criarPixTransparente({ amountCentavos: 3990, pedidoId: 'p1', correlacao: 'p1-rabc' })
    await criarPixTransparente({ amountCentavos: 3990, pedidoId: 'p1' })
    expect(bodies.map((b) => b.correlationID)).toEqual(['p1-rabc', 'p1'])
  })
  it('cobrancaPorCorrelacao: COMPLETED vira PAID com o identifier; erro vira null', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ wooviAppId: 'app' }))
    vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
    vi.stubGlobal('$fetch', vi.fn(async () => ({ charge: { status: 'COMPLETED', identifier: '25d4' } })))
    expect(await cobrancaPorCorrelacao('p1')).toEqual({ status: 'PAID', identifier: '25d4' })
    vi.stubGlobal('$fetch', vi.fn(async () => { throw new Error('404') }))
    expect(await cobrancaPorCorrelacao('p1')).toBeNull()
  })
})

describe('rede de seguranca do status', () => {
  const agora = Date.parse('2026-10-07T12:00:00Z')
  it('pedido apontando pra AbacatePay: olha a Woovi original', () => {
    expect(deveChecarWooviOriginal({ pix_provider: 'abacatepay', expira_em: '2026-10-07T13:00:00Z' }, agora)).toBe(true)
  })
  it('Woovi com Pix vencido: olha; Woovi em dia: nao (o checarPix normal ja cobre)', () => {
    expect(deveChecarWooviOriginal({ pix_provider: 'woovi', expira_em: '2026-10-07T11:00:00Z' }, agora)).toBe(true)
    expect(deveChecarWooviOriginal({ pix_provider: 'woovi', expira_em: '2026-10-07T13:00:00Z' }, agora)).toBe(false)
  })
  it('cartao nunca', () => {
    expect(deveChecarWooviOriginal({ forma_pagamento: 'cartao', pix_provider: 'abacatepay' }, agora)).toBe(false)
  })
})
