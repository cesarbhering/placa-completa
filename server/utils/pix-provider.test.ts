import { describe, it, expect, vi, beforeEach } from 'vitest'

// A escolha de provedor decide onde o dinheiro entra e a quem pedir estorno.
// Errar aqui e cobrar num lugar e procurar no outro.
const config = { pixProvider: 'abacatepay', wooviRecebedor: '' }
vi.stubGlobal('useRuntimeConfig', () => config)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o?.message || 'erro'), o))

// Adaptadores mockados: o failover so precisa saber se cada um respondeu ou
// falhou. .nome e .nomeDoRecebedor sao definidos no proprio pix-provider, nao
// vem dos adaptadores, entao mockar os modulos nao afeta os outros testes.
vi.mock('./abacatepay', () => ({
  criarPixTransparente: vi.fn(), checarPix: vi.fn(), reembolsarPix: vi.fn(), simularPagamento: vi.fn(),
}))
vi.mock('./woovi', () => ({
  criarPixTransparente: vi.fn(), checarPix: vi.fn(), reembolsarPix: vi.fn(), simularPagamento: vi.fn(),
}))

const abacate = await import('./abacatepay')
const woovi = await import('./woovi')
const { provedorPix, provedorDoPedido, criarPixComFallback } = await import('./pix-provider')

const CHARGE = { id: 'x', amount: 4490, status: 'ACTIVE', brCode: 'br', brCodeBase64: 'b64', expiresAt: null }
const OPTS = { amountCentavos: 4490, pedidoId: 'ped1' }

describe('escolha do provedor', () => {
  beforeEach(() => { config.pixProvider = 'abacatepay' })

  it('sem env, e a AbacatePay: producao nao muda por descuido', () => {
    config.pixProvider = ''
    expect(provedorPix().nome).toBe('abacatepay')
  })

  it('env woovi troca o provedor', () => {
    config.pixProvider = 'woovi'
    expect(provedorPix().nome).toBe('woovi')
  })

  it('env escrita de qualquer jeito ainda resolve', () => {
    config.pixProvider = 'WOOVI'
    expect(provedorPix().nome).toBe('woovi')
  })

  it('env com nome errado cai na AbacatePay, nao quebra o checkout', () => {
    config.pixProvider = 'stripe'
    expect(provedorPix().nome).toBe('abacatepay')
  })
})

describe('provedor de um pedido ja criado', () => {
  it('segue o que esta gravado no pedido, nao a env de agora', () => {
    config.pixProvider = 'woovi'
    // Pedido antigo, criado quando ainda era AbacatePay: status e estorno tem
    // que continuar batendo la.
    expect(provedorDoPedido('abacatepay').nome).toBe('abacatepay')
    expect(provedorDoPedido('woovi').nome).toBe('woovi')
  })

  it('pedido sem provedor gravado e AbacatePay (todos os antigos sao)', () => {
    expect(provedorDoPedido(null).nome).toBe('abacatepay')
    expect(provedorDoPedido(undefined).nome).toBe('abacatepay')
    expect(provedorDoPedido('').nome).toBe('abacatepay')
  })
})

describe('nome do recebedor', () => {
  beforeEach(() => { config.wooviRecebedor = '' })

  it('Woovi sem WOOVI_RECEBEDOR: nao promete nome que nao conferimos', () => {
    expect(provedorDoPedido('woovi').nomeDoRecebedor()).toBeNull()
  })

  it('Woovi com WOOVI_RECEBEDOR: mostra a string conferida no Pix real', () => {
    config.wooviRecebedor = 'PLACA COMPLETA'
    expect(provedorDoPedido('woovi').nomeDoRecebedor()).toBe('PLACA COMPLETA')
  })

  it('AbacatePay nao promete nome: quando cai nela e de salva-vidas, "Haste" so confundiria', () => {
    expect(provedorDoPedido('abacatepay').nomeDoRecebedor()).toBeNull()
  })
})

describe('failover na criacao (Woovi preferencial, AbacatePay salva-vidas)', () => {
  beforeEach(() => {
    config.pixProvider = 'woovi'
    vi.mocked(woovi.criarPixTransparente).mockReset()
    vi.mocked(abacate.criarPixTransparente).mockReset()
  })

  it('Woovi responde: usa Woovi e nem toca na AbacatePay', async () => {
    vi.mocked(woovi.criarPixTransparente).mockResolvedValue({ ...CHARGE, id: 'w1' })
    const { charge, provedor } = await criarPixComFallback(OPTS)
    expect(provedor.nome).toBe('woovi')
    expect(charge.id).toBe('w1')
    expect(abacate.criarPixTransparente).not.toHaveBeenCalled()
  })

  it('Woovi cai: AbacatePay assume e a venda nao se perde', async () => {
    vi.mocked(woovi.criarPixTransparente).mockRejectedValue(new Error('woovi fora do ar'))
    vi.mocked(abacate.criarPixTransparente).mockResolvedValue({ ...CHARGE, id: 'a1' })
    const { charge, provedor } = await criarPixComFallback(OPTS)
    expect(provedor.nome).toBe('abacatepay')
    expect(charge.id).toBe('a1')
  })

  it('AbacatePay primaria NAO cai na Woovi (rollback limpo)', async () => {
    config.pixProvider = 'abacatepay'
    vi.mocked(abacate.criarPixTransparente).mockRejectedValue(new Error('abacate fora'))
    await expect(criarPixComFallback(OPTS)).rejects.toThrow('abacate fora')
    expect(woovi.criarPixTransparente).not.toHaveBeenCalled()
  })

  it('os dois caem: propaga o erro pro checkout devolver 5xx', async () => {
    vi.mocked(woovi.criarPixTransparente).mockRejectedValue(new Error('woovi fora'))
    vi.mocked(abacate.criarPixTransparente).mockRejectedValue(new Error('abacate fora tambem'))
    await expect(criarPixComFallback(OPTS)).rejects.toThrow('abacate fora tambem')
  })
})
