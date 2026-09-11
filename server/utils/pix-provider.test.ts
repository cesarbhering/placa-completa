import { describe, it, expect, vi, beforeEach } from 'vitest'

// A escolha de provedor decide onde o dinheiro entra e a quem pedir estorno.
// Errar aqui e cobrar num lugar e procurar no outro.
const config = { pixProvider: 'abacatepay' }
vi.stubGlobal('useRuntimeConfig', () => config)

const { provedorPix, provedorDoPedido } = await import('./pix-provider')

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
  it('AbacatePay tem nome confirmado no BR Code real', () => {
    expect(provedorDoPedido('abacatepay').nomeDoRecebedor()).toBe('Haste Technologies')
  })

  it('Woovi ainda nao: a tela nao promete nome que nao conferimos', () => {
    expect(provedorDoPedido('woovi').nomeDoRecebedor()).toBeNull()
  })
})
