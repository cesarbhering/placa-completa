import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseMemoria } from '../../../../tests/helpers/supabase-memoria'

// "Cade meu relatorio" do app: acha o pedido pelo comprovante da Play, mesmo
// com a compra concluida (e consumida) pelo servidor sem o app saber. So o
// token de entrega sai daqui.

const enviarRelatorioEmail = vi.fn(async () => true)
const sendErrorEmail = vi.fn(async () => {})
vi.mock('../../../utils/cupom-recompra', () => ({ cupomRecompraDoPedido: async () => null }))

let get: any
let post: any
let body: any
let query: any
let status: number | undefined
let sb: ReturnType<typeof supabaseMemoria>
const gate = vi.fn()

vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('getQuery', () => query)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
vi.stubGlobal('assertPremiumGate', gate)
vi.stubGlobal('usePremiumSupabase', () => sb)
vi.stubGlobal('setResponseStatus', (_e: any, s: number) => { status = s })
vi.stubGlobal('enviarRelatorioEmail', enviarRelatorioEmail)
vi.stubGlobal('sendErrorEmail', sendErrorEmail)
vi.stubGlobal('defineEventHandler', (fn: any) => fn)
get = (await import('./pedido.get')).default
post = (await import('./pedido.post')).default

const pedidos = () => sb.tab('pedidos_premium')
const compras = () => sb.tab('google_play_compras')

function comPedido(extra: Record<string, any> = {}) {
  pedidos().push({ id: 'p1', token_entrega: 'entrega-1', status: 'entregue', placa: 'ABC1D23', email: null, email_enviado_em: null, plano: 'completa', google_play_purchase_token: 'tok-abc', ...extra })
}

describe('GET /api/premium/google-play/pedido', () => {
  beforeEach(() => {
    sb = supabaseMemoria()
    query = { purchaseToken: 'tok-abc' }
    status = undefined
    gate.mockClear()
    enviarRelatorioEmail.mockClear()
  })

  it('pedido pelo purchaseToken: devolve so token, status e placa', async () => {
    comPedido({ preview: { segredo: 1 } })
    const r = await get({})
    expect(r).toEqual({ token_entrega: 'entrega-1', status: 'entregue', placa: 'ABC1D23' })
    expect(status).toBeUndefined()
    expect(gate).toHaveBeenCalledOnce()
  })

  it('acha pela compra quando o pedido nao guardou o comprovante', async () => {
    pedidos().push({ id: 'p9', token_entrega: 'entrega-9', status: 'pago', placa: 'XYZ9A88' })
    compras().push({ id: 'c1', purchase_token: 'tok-abc', pedido_id: 'p9' })
    expect(await get({})).toEqual({ token_entrega: 'entrega-9', status: 'pago', placa: 'XYZ9A88' })
  })

  it('compra registrada sem pedido: 202 pendente', async () => {
    compras().push({ id: 'c1', purchase_token: 'tok-abc', pedido_id: null, estado_google: 'pendente' })
    expect(await get({})).toEqual({ pendente: true })
    expect(status).toBe(202)
  })

  it('compra cancelada na Play: 410, o app para de perguntar', async () => {
    compras().push({ id: 'c1', purchase_token: 'tok-abc', pedido_id: null, estado_google: 'cancelada' })
    expect(await get({})).toEqual({ cancelada: true })
    expect(status).toBe(410)
  })

  it('comprovante desconhecido: 404', async () => {
    await expect(get({})).rejects.toMatchObject({ statusCode: 404 })
  })

  it('sem comprovante: 400', async () => {
    query = {}
    await expect(get({})).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('POST /api/premium/google-play/pedido', () => {
  beforeEach(() => {
    sb = supabaseMemoria()
    body = { purchaseToken: 'tok-abc', email: 'Ana@Ex.com ' }
    status = undefined
    enviarRelatorioEmail.mockClear()
  })

  it('pedido da RTDN sem e-mail: grava e envia o relatorio na hora', async () => {
    comPedido()
    const r = await post({})
    expect(r).toMatchObject({ token_entrega: 'entrega-1', email_gravado: true })
    expect(pedidos()[0].email).toBe('ana@ex.com')
    expect(pedidos()[0].email_enviado_em).toBeTruthy()
    expect(enviarRelatorioEmail).toHaveBeenCalledOnce()
    expect(enviarRelatorioEmail.mock.calls[0]).toMatchObject([{ email: 'ana@ex.com', token: 'entrega-1', placa: 'ABC1D23' }])
  })

  it('idempotente: segunda chamada nao reenvia', async () => {
    comPedido()
    await post({})
    const r = await post({})
    expect(r.email_gravado).toBe(false)
    expect(enviarRelatorioEmail).toHaveBeenCalledOnce()
  })

  it('pedido que ja tem e-mail: nao troca nem reenvia', async () => {
    comPedido({ email: 'dono@ex.com' })
    const r = await post({})
    expect(r.email_gravado).toBe(false)
    expect(pedidos()[0].email).toBe('dono@ex.com')
    expect(enviarRelatorioEmail).not.toHaveBeenCalled()
  })

  it('compra ainda sem pedido: e-mail fica na compra (o pedido nasce com ele)', async () => {
    compras().push({ id: 'c1', purchase_token: 'tok-abc', pedido_id: null, email: null })
    const r = await post({})
    expect(r).toEqual({ pendente: true, email_gravado: true })
    expect(status).toBe(202)
    expect(compras()[0].email).toBe('ana@ex.com')
    expect(enviarRelatorioEmail).not.toHaveBeenCalled()
  })

  it('sem e-mail funciona como o GET', async () => {
    comPedido()
    body = { purchaseToken: 'tok-abc' }
    expect(await post({})).toEqual({ token_entrega: 'entrega-1', status: 'entregue', placa: 'ABC1D23' })
    expect(pedidos()[0].email).toBeNull()
  })

  it('e-mail invalido: 400, nada gravado', async () => {
    comPedido()
    body.email = 'ana'
    await expect(post({})).rejects.toMatchObject({ statusCode: 400 })
    expect(pedidos()[0].email).toBeNull()
  })

  it('falha no envio solta a trava pra proxima tentativa', async () => {
    comPedido()
    enviarRelatorioEmail.mockResolvedValueOnce(false)
    await post({})
    expect(pedidos()[0].email_enviado_em).toBeNull()
    expect(sendErrorEmail).toHaveBeenCalled()
  })
})
