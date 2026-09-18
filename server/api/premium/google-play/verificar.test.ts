import { describe, it, expect, vi, beforeEach } from 'vitest'

// O purchaseToken e a unica coisa que impede a MESMA compra de virar dois
// pedidos: duas consultas pagas no SENATRAN e duas entregas por um pagamento
// so. Este arquivo cobre os dois caminhos de reenvio (o detectado antes e o
// que so o unique do banco pega) e a recusa de compra nao confirmada.

const compra = { ok: true, motivo: null as string | null, orderId: 'GPA.1', purchaseState: 0, consumptionState: 0, acknowledgementState: 1, productId: 'consulta_completa' }
const consultarCompra = vi.fn(async () => compra)
const consumirCompra = vi.fn(async () => ({ ok: true, error: null }))
vi.mock('../../../utils/google-play', () => ({
  PRODUTO_COMPLETA: 'consulta_completa',
  consultarCompra: (...a: any[]) => consultarCompra(...(a as [])),
  consumirCompra: (...a: any[]) => consumirCompra(...(a as [])),
}))

let handler: any
let body: any
let existente: { token_entrega: string } | null = null
let insertFalha = false
const inserido: any[] = []
const processar = vi.fn(async () => {})

function fakeSupabase() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: existente }) }),
      }),
      insert: (linha: any) => {
        inserido.push(linha)
        return {
          select: () => ({
            single: async () => insertFalha
              ? { data: null, error: { code: '23505' } }
              : { data: { id: 'p1', ...linha }, error: null },
          }),
        }
      },
    }),
  }
}

vi.stubGlobal('defineEventHandler', (fn: any) => { handler = fn; return fn })
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
vi.stubGlobal('assertPremiumGate', () => {})
vi.stubGlobal('usePremiumSupabase', () => fakeSupabase())
vi.stubGlobal('useRuntimeConfig', () => ({ public: { homolog: false } }))
vi.stubGlobal('getClientIp', () => '1.2.3.4')
vi.stubGlobal('getDispositivo', () => ({ dispositivo: 'celular', sistema: 'Android' }))
vi.stubGlobal('processarPedidoPago', processar)

await import('./verificar.post')

const pedidoValido = () => ({
  placa: 'ABC1D23', productId: 'consulta_completa', purchaseToken: 'tok-abc', orderId: 'GPA.1',
})

describe('compra pelo Google Play', () => {
  beforeEach(() => {
    body = pedidoValido()
    existente = null
    insertFalha = false
    inserido.length = 0
    compra.ok = true
    compra.motivo = null
    consultarCompra.mockClear()
    processar.mockClear()
  })

  it('cria o pedido pago com o preco da tabela, nunca o que o app mandou', async () => {
    body.valor = 1
    const r = await handler({})
    expect(r.token_entrega).toBeTruthy()
    expect(inserido[0].valor_centavos).toBe(3990)
    expect(inserido[0].plano).toBe('completa')
    expect(inserido[0].status).toBe('pago')
    expect(inserido[0].pix_provider).toBe('google_play')
    expect(processar).toHaveBeenCalledOnce()
  })

  it('reenvio do mesmo comprovante devolve o pedido antigo, sem consultar a Google de novo', async () => {
    existente = { token_entrega: 'tok-entrega-1' }
    const r = await handler({})
    expect(r).toEqual({ token_entrega: 'tok-entrega-1', repetido: true })
    expect(consultarCompra).not.toHaveBeenCalled()
    expect(inserido).toHaveLength(0)
    expect(processar).not.toHaveBeenCalled()
  })

  it('corrida entre dois envios: o unique do banco barra o segundo e ele devolve o pedido que venceu', async () => {
    insertFalha = true
    const supabaseComCorrida = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: chamadas++ === 0 ? null : { token_entrega: 'tok-vencedor' } }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: '23505' } }) }) }),
      }),
    }
    let chamadas = 0
    vi.stubGlobal('usePremiumSupabase', () => supabaseComCorrida)
    const r = await handler({})
    expect(r).toEqual({ token_entrega: 'tok-vencedor', repetido: true })
    expect(processar).not.toHaveBeenCalled()
    vi.stubGlobal('usePremiumSupabase', () => fakeSupabase())
  })

  it('compra nao confirmada pela Google devolve 402 e nao cria pedido', async () => {
    compra.ok = false
    compra.motivo = 'pagamento pendente'
    await expect(handler({})).rejects.toMatchObject({ statusCode: 402 })
    expect(inserido).toHaveLength(0)
  })

  it('produto diferente do unico que o app vende e recusado', async () => {
    body.productId = 'consulta_barata'
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
    expect(consultarCompra).not.toHaveBeenCalled()
  })

  it('compra sem comprovante nao chega a perguntar nada pra Google', async () => {
    body.purchaseToken = ''
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
    expect(consultarCompra).not.toHaveBeenCalled()
  })
})
