import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gerarTokenCupomTela, segredoCupomTela } from '../../utils/cupom-tela'

// Checkout Pix com o cupom de tela: o servidor confere o token (assinatura,
// placa e janela de 30 min), aplica 5% e marca o pedido; com cupom de e-mail
// maior, vale o cupom e nada acumula.
vi.mock('../../utils/compra-repetida', () => ({ respostaCompraRepetida: async () => null }))
vi.mock('../../utils/blocklist', () => ({ barrarPlacaBloqueada: () => {} }))
let handler: any
let body: any
let inserido: any
let cupomResposta: any
const usos: any[] = []
const CONFIG = { public: { homolog: false }, premiumSupabaseKey: 'chave-de-teste' }
const SEG = segredoCupomTela(CONFIG)
vi.stubGlobal('defineEventHandler', (fn: any) => { handler = fn; return fn })
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
vi.stubGlobal('assertPremiumGate', () => {})
vi.stubGlobal('useRuntimeConfig', () => CONFIG)
vi.stubGlobal('getClientIp', () => '1.2.3.4')
vi.stubGlobal('getCookie', () => undefined)
vi.stubGlobal('getDispositivo', () => ({ dispositivo: 'celular', sistema: 'Android', canal: 'web', app_versao: null }))
vi.stubGlobal('provedorPix', () => ({ nome: 'woovi' }))
vi.stubGlobal('criarOuObterCliente', async () => null)
vi.stubGlobal('criarPixComFallback', async (o: any) => ({ charge: { id: 'px', brCode: 'br', brCodeBase64: 'b64', expiresAt: null, valor: o.amountCentavos }, provedor: { nome: 'woovi', nomeDoRecebedor: () => 'PLACA COMPLETA' } }))
vi.stubGlobal('validarCupom', async () => cupomResposta)
vi.stubGlobal('reivindicarUsoCupomGratis', async () => false)
vi.stubGlobal('liberarUsoCupomGratis', async () => {})
vi.stubGlobal('registrarUsoCupom', async (_sb: any, o: any) => { usos.push(o) })
vi.stubGlobal('usePremiumSupabase', () => ({
  from: () => ({
    insert: (row: any) => { inserido = row; return { select: () => ({ single: async () => ({ data: { id: 'p1' }, error: null }) }) } },
    update: () => ({ eq: async () => ({}) }),
  }),
}))

await import('./checkout.post')

const PLACA = 'AAA0A00'
describe('checkout Pix: cupom de tela', () => {
  beforeEach(() => { inserido = null; cupomResposta = null; usos.length = 0 })

  it('token valido: 5% na completa e pedido marcado', async () => {
    body = { placa: PLACA, plano: 'completa', cupom_tela: gerarTokenCupomTela(SEG, PLACA, Date.now() - 60_000), origem_checkout: 'cupom_tela' }
    const r = await handler({})
    expect(r.valor).toBe(4265)
    expect(inserido).toMatchObject({ valor_centavos: 4265, cupom_origem: 'cupom_tela', origem_checkout: 'cupom_tela' })
    expect(r.cupomAplicado).toEqual({ descontoCentavos: 225, tela: true })
  })

  it('token vencido (31 min): preco cheio, sem marca', async () => {
    body = { placa: PLACA, plano: 'completa', cupom_tela: gerarTokenCupomTela(SEG, PLACA, Date.now() - 31 * 60_000) }
    const r = await handler({})
    expect(r.valor).toBe(4490)
    expect(inserido.cupom_origem).toBeUndefined()
  })

  it('token de outra placa nao vale', async () => {
    body = { placa: 'BBB0B00', plano: 'completa', cupom_tela: gerarTokenCupomTela(SEG, PLACA, Date.now()) }
    expect((await handler({})).valor).toBe(4490)
  })

  it('cupom de e-mail maior (15%) vence e nao acumula', async () => {
    cupomResposta = { ok: true, cupomId: 'c1', precoBrutoCentavos: 4490, descontoCentavos: 674, precoLiquidoCentavos: 3816 }
    body = { placa: PLACA, plano: 'completa', email: 'x@y.z', cupom: 'CARRO15', cupom_tela: gerarTokenCupomTela(SEG, PLACA, Date.now()) }
    const r = await handler({})
    expect(r.valor).toBe(3816)
    expect(inserido.cupom_origem).toBeUndefined()
    expect(usos).toHaveLength(1)
  })

  it('cupom menor (3%) perde pro de tela e nao registra uso', async () => {
    cupomResposta = { ok: true, cupomId: 'c2', precoBrutoCentavos: 4490, descontoCentavos: 135, precoLiquidoCentavos: 4355 }
    body = { placa: PLACA, plano: 'completa', email: 'x@y.z', cupom: 'TRES', cupom_tela: gerarTokenCupomTela(SEG, PLACA, Date.now()) }
    const r = await handler({})
    expect(r.valor).toBe(4265)
    expect(inserido.cupom_origem).toBe('cupom_tela')
    expect(usos).toHaveLength(0)
  })
})
