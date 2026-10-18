import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

// A resposta da Google e a unica coisa entre uma compra e a entrega do
// relatorio. Cada caso aqui ja seria uma entrega indevida (ou uma venda
// perdida) se o parser lesse errado.
const config: any = { googlePlayServiceAccount: '' }
vi.stubGlobal('useRuntimeConfig', () => config)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))

const { interpretarCompra, interpretarPedidoGoogle, moneyParaCentavos, contaDeServico, montarAssertion, PRODUTO_COMPLETA } = await import('./google-play')

describe('interpretar a resposta da Google', () => {
  it('compra paga e nao consumida entrega', () => {
    const r = interpretarCompra({ purchaseState: 0, consumptionState: 0, orderId: 'GPA.1', productId: PRODUTO_COMPLETA })
    expect(r.ok).toBe(true)
    expect(r.orderId).toBe('GPA.1')
  })

  it('pagamento pendente nao entrega: o dinheiro ainda nao entrou', () => {
    const r = interpretarCompra({ purchaseState: 2, consumptionState: 0 })
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('pagamento pendente')
  })

  it('compra cancelada nao entrega', () => {
    const r = interpretarCompra({ purchaseState: 1, consumptionState: 0 })
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('compra cancelada')
  })

  it('compra paga e ja consumida no celular entrega (caso BAN0G13): o unique do token impede reuso', () => {
    const r = interpretarCompra({ purchaseState: 0, consumptionState: 1 })
    expect(r.ok).toBe(true)
    expect(r.estado).toBe('pago')
    expect(r.consumida).toBe(true)
  })

  it('pendente e cancelada viram estado proprio', () => {
    expect(interpretarCompra({ purchaseState: 2 }).estado).toBe('pendente')
    expect(interpretarCompra({ purchaseState: 1 }).estado).toBe('cancelada')
  })

  it('purchaseType 0 e compra de teste; ausente e compra real', () => {
    expect(interpretarCompra({ purchaseState: 0, purchaseType: 0 }).teste).toBe(true)
    expect(interpretarCompra({ purchaseState: 0 }).teste).toBe(false)
    expect(interpretarCompra({ purchaseState: 0, purchaseType: 1 }).teste).toBe(false)
  })

  it('le a placa do obfuscatedExternalAccountId', () => {
    expect(interpretarCompra({ purchaseState: 0, obfuscatedExternalAccountId: 'ABC1D23' }).contaExterna).toBe('ABC1D23')
    expect(interpretarCompra({ purchaseState: 0 }).contaExterna).toBe(null)
  })

  it('resposta vazia ou sem estado falha fechada', () => {
    expect(interpretarCompra(null).ok).toBe(false)
    expect(interpretarCompra({}).ok).toBe(false)
    expect(interpretarCompra({}).motivo).toBe('compra sem estado')
  })

  it('productId vem da resposta, e cai no consultado quando ela nao traz', () => {
    expect(interpretarCompra({ purchaseState: 0, consumptionState: 0 }, 'consulta_completa').productId).toBe('consulta_completa')
    expect(interpretarCompra({ purchaseState: 0, consumptionState: 0, productId: 'outro' }, 'consulta_completa').productId).toBe('outro')
  })
})

describe('preco do pedido na Play (orders.get)', () => {
  it('Money em centavos', () => {
    expect(moneyParaCentavos({ currencyCode: 'BRL', units: '39', nanos: 990000000 })).toBe(3999)
    expect(moneyParaCentavos({ currencyCode: 'BRL', units: '33', nanos: 990000000 })).toBe(3399)
    expect(moneyParaCentavos({ currencyCode: 'BRL', units: '40' })).toBe(4000)
    expect(moneyParaCentavos({ currencyCode: 'BRL' })).toBe(null)
    expect(moneyParaCentavos({ currencyCode: 'USD', units: '8' })).toBe(null)
    expect(moneyParaCentavos(null)).toBe(null)
  })

  it('total e liquido do pedido real (formato da resposta de 18/out)', () => {
    const r = interpretarPedidoGoogle({
      state: 'PROCESSED',
      total: { currencyCode: 'BRL', units: '39', nanos: 990000000 },
      developerRevenueInBuyerCurrency: { currencyCode: 'BRL', units: '33', nanos: 990000000 },
    })
    expect(r).toEqual({ valorCentavos: 3999, liquidoCentavos: 3399, estado: 'PROCESSED' })
  })
})

describe('conta de servico', () => {
  beforeEach(() => { config.googlePlayServiceAccount = '' })

  it('sem env, o endpoint do app fica fora do ar em vez de entregar sem conferir', () => {
    expect(() => contaDeServico()).toThrow()
  })

  it('base64 quebrado nao passa por conta de servico valida', () => {
    config.googlePlayServiceAccount = Buffer.from('{ isto nao e json').toString('base64')
    expect(() => contaDeServico()).toThrow()
  })

  it('JSON sem chave privada e recusado', () => {
    config.googlePlayServiceAccount = Buffer.from(JSON.stringify({ client_email: 'a@b.com' })).toString('base64')
    expect(() => contaDeServico()).toThrow()
  })

  it('assina um JWT que a chave publica correspondente verifica', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    config.googlePlayServiceAccount = Buffer.from(JSON.stringify({
      client_email: 'robo@placacompleta.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    })).toString('base64')

    const jwt = montarAssertion(contaDeServico(), 1_700_000_000)
    const [h, c, sig] = jwt.split('.')
    const ok = crypto.createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, 'base64url'))
    expect(ok).toBe(true)

    const claims = JSON.parse(Buffer.from(c, 'base64url').toString('utf8'))
    expect(claims.scope).toBe('https://www.googleapis.com/auth/androidpublisher')
    expect(claims.exp - claims.iat).toBe(3600)
  })
})
