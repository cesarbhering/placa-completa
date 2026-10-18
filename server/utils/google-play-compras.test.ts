import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'
import {
  concluirCompraPlay, rodarJobGooglePlay, normalizarPlaca, ordensBloqueadasDoEnv, decodificarRtdn, registrarCompra,
  PRECO_PLAY_PADRAO_CENTAVOS, GP_DESISTE_MS,
} from './google-play-compras'
import type { CompraGoogle } from './google-play'

// Os tres casos reais de 17 e 18/out/2026 viram teste aqui: compra consumida
// no celular (BAN0G13), Pix da Play pendente (BCY3E00) e compra de teste
// gravada como venda (QNA9303).

const AGORA = Date.parse('2026-10-18T21:00:00Z')
const MIN = 60_000

function compraGoogle(p: Partial<CompraGoogle> = {}): CompraGoogle {
  return {
    ok: true, motivo: null, estado: 'pago', orderId: 'GPA.1', purchaseState: 0, consumptionState: 0,
    acknowledgementState: 0, productId: 'consulta_completa', consumida: false, teste: false, contaExterna: null, ...p,
  }
}

let sb: ReturnType<typeof supabaseMemoria>
let google: CompraGoogle
const processar = vi.fn(async () => {})
const consumir = vi.fn(async () => ({ ok: true }))
const consultarPedido = vi.fn(async () => ({ valorCentavos: 3999, liquidoCentavos: 3399, estado: 'PROCESSED' } as any))
const alertar = vi.fn(async () => {})

const deps = (extra: any = {}) => ({
  supabase: sb,
  consultar: vi.fn(async () => google),
  consultarPedido,
  processar,
  consumir,
  ambienteDoPedido: () => 'producao',
  agora: AGORA,
  ...extra,
})
const entrada = (e: any = {}) => ({ purchaseToken: 'tok-1', productId: 'consulta_completa', orderId: 'GPA.1', placa: 'ABC1D23', origem: 'app' as const, ...e })
const pedidos = () => sb.tab('pedidos_premium')
const compras = () => sb.tab('google_play_compras')
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  sb = supabaseMemoria({ unicos: { pedidos_premium: ['google_play_purchase_token'], google_play_compras: ['purchase_token'] } })
  google = compraGoogle()
  processar.mockClear(); consumir.mockClear(); consultarPedido.mockClear(); alertar.mockClear()
  consultarPedido.mockImplementation(async () => ({ valorCentavos: 3999, liquidoCentavos: 3399, estado: 'PROCESSED' }))
})

describe('concluirCompraPlay', () => {
  it('compra paga vira pedido google_play com o preco da Play e grava o comprovante', async () => {
    const r = await concluirCompraPlay(entrada({ email: 'a@b.com', dadosApp: { origem_checkout: 'barra_fixa' } }), deps())
    expect(r.tipo).toBe('entregue')
    const p = pedidos()[0]
    expect(p).toMatchObject({ forma_pagamento: 'google_play', pix_provider: 'google_play', valor_centavos: 3999, ambiente: 'producao', status: 'pago', placa: 'ABC1D23', email: 'a@b.com', origem_checkout: 'barra_fixa' })
    expect(compras()[0]).toMatchObject({ purchase_token: 'tok-1', pedido_id: p.id, estado_google: 'pago', valor_centavos: 3999, liquido_centavos: 3399, origem: 'app', motivo: null })
    expect(processar).toHaveBeenCalledOnce()
    await flush(); await flush()
    expect(consumir).toHaveBeenCalledOnce()
  })

  it('BAN0G13: compra ja consumida no celular e sem pedido nosso e entregue (e nao consome de novo)', async () => {
    google = compraGoogle({ consumptionState: 1, consumida: true })
    const r = await concluirCompraPlay(entrada(), deps())
    expect(r.tipo).toBe('entregue')
    await flush(); await flush()
    expect(consumir).not.toHaveBeenCalled()
  })

  it('mesma compra de novo devolve o mesmo pedido, sem perguntar a Google', async () => {
    const d = deps()
    const r1: any = await concluirCompraPlay(entrada(), d)
    const r2: any = await concluirCompraPlay(entrada(), d)
    expect(r2).toEqual({ tipo: 'entregue', token_entrega: r1.token_entrega, repetido: true })
    expect(pedidos()).toHaveLength(1)
    expect(d.consultar).toHaveBeenCalledOnce()
  })

  it('BCY3E00: pendente fica registrada como pendente, sem pedido', async () => {
    google = compraGoogle({ ok: false, estado: 'pendente', motivo: 'pagamento pendente', purchaseState: 2 })
    const r = await concluirCompraPlay(entrada(), deps())
    expect(r).toEqual({ tipo: 'pendente' })
    expect(pedidos()).toHaveLength(0)
    expect(compras()[0]).toMatchObject({ estado_google: 'pendente', placa: 'ABC1D23', tentativas: 1 })
    expect(compras()[0].pedido_id ?? null).toBe(null)
  })

  it('compra recusada tambem deixa comprovante', async () => {
    google = compraGoogle({ ok: false, estado: 'cancelada', motivo: 'compra cancelada', purchaseState: 1 })
    const r = await concluirCompraPlay(entrada(), deps())
    expect(r).toMatchObject({ tipo: 'recusada', estado: 'cancelada' })
    expect(compras()[0]).toMatchObject({ estado_google: 'cancelada', motivo: 'compra cancelada' })
  })

  it('QNA9303: compra de teste da Play (purchaseType 0) vira pedido com ambiente teste', async () => {
    google = compraGoogle({ teste: true })
    await concluirCompraPlay(entrada(), deps())
    expect(pedidos()[0].ambiente).toBe('teste')
    expect(compras()[0].teste).toBe(true)
  })

  it('sem orders.get, usa o preco padrao da Play', async () => {
    consultarPedido.mockImplementation(async () => null)
    await concluirCompraPlay(entrada(), deps())
    expect(pedidos()[0].valor_centavos).toBe(PRECO_PLAY_PADRAO_CENTAVOS)
  })

  it('pedido estornado na Play nao vira pedido', async () => {
    consultarPedido.mockImplementation(async () => ({ valorCentavos: 3999, liquidoCentavos: null, estado: 'REFUNDED' }))
    const r = await concluirCompraPlay(entrada(), deps())
    expect(r).toMatchObject({ tipo: 'recusada', estado: 'estornada' })
    expect(pedidos()).toHaveLength(0)
  })

  it('order_id bloqueado (tratado a mao) nao vira pedido', async () => {
    const r = await concluirCompraPlay(entrada(), deps({ ordensBloqueadas: new Set(['GPA.1']) }))
    expect(r).toMatchObject({ tipo: 'recusada', estado: 'bloqueada' })
    expect(pedidos()).toHaveLength(0)
  })

  it('RTDN sem placa: usa o obfuscatedExternalAccountId; sem ele, sem_placa', async () => {
    google = compraGoogle({ contaExterna: 'xyz9a87' })
    const r = await concluirCompraPlay(entrada({ placa: null, origem: 'rtdn' }), deps())
    expect(r.tipo).toBe('entregue')
    expect(pedidos()[0].placa).toBe('XYZ9A87')

    google = compraGoogle({ contaExterna: null })
    const r2 = await concluirCompraPlay(entrada({ purchaseToken: 'tok-2', placa: null, origem: 'rtdn' }), deps())
    expect(r2).toEqual({ tipo: 'sem_placa' })
    expect(compras().find((c) => c.purchase_token === 'tok-2')).toMatchObject({ motivo: 'paga, sem placa' })
  })

  it('a placa e o resto do que o app mandou valem quando o job conclui depois', async () => {
    google = compraGoogle({ ok: false, estado: 'pendente', motivo: 'pagamento pendente', purchaseState: 2 })
    await concluirCompraPlay(entrada({ email: 'c@d.com', dadosApp: { origem_checkout: 'barra_fixa', preview: { a: 1 } } }), deps())
    google = compraGoogle()
    const r = await concluirCompraPlay({ purchaseToken: 'tok-1', productId: 'consulta_completa', origem: 'job' }, deps())
    expect(r.tipo).toBe('entregue')
    expect(pedidos()[0]).toMatchObject({ placa: 'ABC1D23', email: 'c@d.com', origem_checkout: 'barra_fixa', preview: { a: 1 } })
    expect(compras()[0].origem).toBe('app')
  })

  it('corrida (app e job ao mesmo tempo): o unique barra o segundo, que devolve o vencedor', async () => {
    const d = deps()
    // O "outro" caminho cria o pedido entre a checagem e o insert.
    d.consultar = vi.fn(async () => {
      pedidos().push({ id: 'p-outro', token_entrega: 'tok-vencedor', google_play_purchase_token: 'tok-1' })
      return google
    })
    const r = await concluirCompraPlay(entrada(), d)
    expect(r).toEqual({ tipo: 'entregue', token_entrega: 'tok-vencedor', repetido: true })
    expect(processar).not.toHaveBeenCalled()
    expect(compras()[0].pedido_id).toBe('p-outro')
  })
})

describe('registrarCompra', () => {
  it('RTDN depois do app nao apaga placa nem e-mail', async () => {
    await registrarCompra(sb, 'tok-1', { placa: 'ABC1D23', email: 'a@b.com' }, 'app', AGORA)
    await registrarCompra(sb, 'tok-1', { product_id: 'consulta_completa', placa: null }, 'rtdn', AGORA)
    expect(compras()).toHaveLength(1)
    expect(compras()[0]).toMatchObject({ placa: 'ABC1D23', email: 'a@b.com', origem: 'app', product_id: 'consulta_completa' })
  })
})

describe('job', () => {
  const linha = (p: any) => compras().push({ id: p.purchase_token, product_id: 'consulta_completa', tentativas: 0, ...p })
  const iso = (ms: number) => new Date(ms).toISOString()
  const job = (extra: any = {}) => rodarJobGooglePlay({ ...deps(), dono: 'c1', alertar, log: () => {}, ...extra })

  it('sem lock nao roda', async () => {
    sb = supabaseMemoria({ rpc: () => false })
    const r = await job()
    expect(r.rodou).toBe(false)
  })

  it('pendente que virou pago: cria o pedido pelo mesmo caminho', async () => {
    linha({ purchase_token: 'tok-p', placa: 'BCY3E00', estado_google: 'pendente', recebido_em: iso(AGORA - 3 * MIN) })
    const r = await job()
    expect(r.entregues).toBe(1)
    expect(pedidos()[0]).toMatchObject({ placa: 'BCY3E00', forma_pagamento: 'google_play' })
    expect(compras()[0].pedido_id).toBe(pedidos()[0].id)
  })

  it('cancelada: para de perguntar', async () => {
    google = compraGoogle({ ok: false, estado: 'cancelada', motivo: 'compra cancelada', purchaseState: 1 })
    linha({ purchase_token: 'tok-c', placa: 'ABC1D23', recebido_em: iso(AGORA - 3 * MIN) })
    await job()
    expect(compras()[0].desistiu_em).toBeTruthy()
  })

  it('token que a Google nao conhece: espera 1 h, desiste e nao alerta', async () => {
    google = compraGoogle({ ok: false, estado: 'nao_encontrada', motivo: 'compra nao encontrada', purchaseState: null })
    linha({ purchase_token: 'tok-n', recebido_em: iso(AGORA - 20 * MIN) })
    await job()
    expect(compras()[0].desistiu_em).toBeFalsy()
    expect(alertar).not.toHaveBeenCalled()
    compras()[0].recebido_em = iso(AGORA - 61 * MIN)
    await job()
    expect(compras()[0].desistiu_em).toBeTruthy()
    expect(alertar).not.toHaveBeenCalled()
  })

  it('alerta uma vez a compra sem pedido ha mais de 10 min, com order_id, placa e motivo', async () => {
    google = compraGoogle({ ok: false, estado: 'pendente', motivo: 'pagamento pendente', purchaseState: 2, orderId: 'GPA.9' })
    linha({ purchase_token: 'tok-a', order_id: 'GPA.9', placa: 'ABC1D23', recebido_em: iso(AGORA - 11 * MIN) })
    linha({ purchase_token: 'tok-b', placa: 'ABC1D24', recebido_em: iso(AGORA - 2 * MIN) })
    await job()
    expect(alertar).toHaveBeenCalledOnce()
    const [assunto, linhas] = alertar.mock.calls[0] as any
    expect(assunto).toMatch(/10 MIN \(1\)/)
    expect(linhas[0]).toMatch(/order_id=GPA\.9 \| placa=ABC1D23 \| estado_google=pendente \| motivo=pagamento pendente/)
    await job()
    expect(alertar).toHaveBeenCalledOnce()
  })

  it('compra paga sem placa (RTDN) alerta pra tratar a mao', async () => {
    linha({ purchase_token: 'tok-s', origem: 'rtdn', recebido_em: iso(AGORA - 11 * MIN) })
    await job()
    const [, linhas] = alertar.mock.calls[0] as any
    expect(linhas[0]).toMatch(/placa=sem placa .*motivo=paga, sem placa .*origem=rtdn/)
  })

  it('desiste em 72 h e alerta', async () => {
    linha({ purchase_token: 'tok-v', placa: 'ABC1D23', alerta_em: iso(AGORA - 70 * 60 * MIN), estado_google: 'pendente', recebido_em: iso(AGORA - GP_DESISTE_MS - MIN) })
    const r = await job()
    expect(r.desistencias).toBe(1)
    expect(compras()[0].desistiu_em).toBeTruthy()
    expect(alertar.mock.calls[0][0]).toMatch(/DESISTIMOS APOS 72 H/)
  })
})

describe('auxiliares', () => {
  it('placa', () => {
    expect(normalizarPlaca('abc-1d23')).toBe('ABC1D23')
    expect(normalizarPlaca('ABC1234')).toBe('ABC1234')
    expect(normalizarPlaca('usuario-123')).toBe(null)
    expect(normalizarPlaca(null)).toBe(null)
  })
  it('ordens bloqueadas do env', () => {
    expect([...ordensBloqueadasDoEnv(' GPA.1, GPA.2 ,')]).toEqual(['GPA.1', 'GPA.2'])
    expect(ordensBloqueadasDoEnv(undefined).size).toBe(0)
  })
  it('decodifica a mensagem do Pub/Sub', () => {
    const n = { packageName: 'br.com.placacompleta', oneTimeProductNotification: { notificationType: 1, purchaseToken: 't', sku: 'consulta_completa' } }
    expect(decodificarRtdn({ message: { data: Buffer.from(JSON.stringify(n)).toString('base64') } })).toEqual(n)
    expect(decodificarRtdn({ message: { data: '!!!' } })).toBe(null)
    expect(decodificarRtdn(null)).toBe(null)
  })
})
