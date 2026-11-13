import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mensagemDoLimite } from '../shared/mensagem-limite'
import { cupomSeguraCompra, decidirValorCartao } from '../shared/checkout-cupom'

// Inline checkout under the coupon attempt limit: the pure decisions of
// shared/checkout-cupom.ts, plus source checks that the component calls them
// where it must. The card flow is exercised with the component mounted in
// PremiumInlineCheckout.cartao.test.ts.
const fonte = readFileSync('components/PremiumInlineCheckout.vue', 'utf8')
const reais = (c: number) => 'R$ ' + (c / 100).toFixed(2).replace('.', ',')

describe('coupon holding the purchase (validarCheckout)', () => {
  it('a coupon that passed never holds', () => {
    expect(cupomSeguraCompra(true, false, false)).toBe(false)
    expect(cupomSeguraCompra(true, true, true)).toBe(false)
  })
  it('an invalid coupon holds (buyer must see the full price)', () => {
    expect(cupomSeguraCompra(false, false, false)).toBe(true)
  })
  it('first refusal by the limit holds once, so the message is seen', () => {
    expect(cupomSeguraCompra(false, false, true)).toBe(true)
  })
  it('refused by the limit before this click and still now: the purchase goes on without it', () => {
    expect(cupomSeguraCompra(false, true, true)).toBe(false)
  })
  it('was blocked before but now invalid for another reason: holds', () => {
    expect(cupomSeguraCompra(false, true, false)).toBe(true)
  })
})

describe('card amount from the server vs the screen', () => {
  it('same amount: confirm', () => {
    expect(decidirValorCartao(4041, 4041, reais, true)).toEqual({ acao: 'confirmar' })
  })
  it('different amount with a typed coupon: hold, blaming the coupon', () => {
    const d = decidirValorCartao(4490, 4041, reais, true)
    expect(d).toEqual({ acao: 'segurar', valor: 4490, mensagem: 'O cupom não pôde ser aplicado. O valor do pagamento é R$ 44,90. Toque em pagar de novo para confirmar.' })
  })
  it('different amount without a coupon: hold with a neutral message', () => {
    expect(decidirValorCartao(3990, 4490, reais, false)).toEqual({ acao: 'segurar', valor: 3990, mensagem: 'O valor do pagamento é R$ 39,90. Toque em pagar de novo para confirmar.' })
  })
  it('amount equal to the screen but above the price at the click: hold with the neutral text', () => {
    expect(decidirValorCartao(4390, 4390, reais, true, 4041)).toEqual({ acao: 'segurar', valor: 4390, mensagem: 'O valor do pagamento é R$ 43,90. Toque em pagar de novo para confirmar.' })
    expect(decidirValorCartao(3590, 3590, reais, true, 4041)).toEqual({ acao: 'confirmar' })
  })
  it('no numeric amount: error, never confirm', () => {
    for (const v of [undefined, null, '4490', NaN]) expect(decidirValorCartao(v, 4490, reais, true).acao).toBe('erro')
  })
  it('no message has an em dash', () => {
    for (const d of [decidirValorCartao(1, 2, reais, true), decidirValorCartao(1, 2, reais, false), decidirValorCartao(undefined, 2, reais, false)]) {
      expect('mensagem' in d && d.mensagem).not.toContain('\u2014')
    }
  })
})

describe('component wiring', () => {
  it('the coupon validation sends the plate', () => {
    const i = fonte.indexOf("$fetch('/api/premium/coupon'")
    expect(fonte.slice(i, fonte.indexOf('\n    })', i))).toMatch(/placa:\s*placaClean\.value/)
  })
  it('the marked 429 message goes to the coupon field', () => {
    expect(fonte).toMatch(/const limite = mensagemDoLimite\(e\)\s*\n\s*cupomBloqueado\.value = !!limite\s*\n\s*cupomMsg\.value = limite \|\|/)
  })
  it('both coupon checks of validarCheckout go through cupomSeguraCompra', () => {
    expect(fonte.match(/cupomSeguraCompra\(/g)).toHaveLength(2)
  })
  it('a blocked coupon is not sent with the order', () => {
    // Pix body inline; the card body sends `cupomEnviado`, built the same way.
    expect(fonte.match(/cupom: cupomBloqueado\.value \? undefined : \(cupomCodigo\.value\.trim\(\) \|\| undefined\)/g)).toHaveLength(1)
    expect(fonte).toMatch(/const cupomEnviado = cupomBloqueado\.value \? undefined : \(cupomCodigo\.value\.trim\(\) \|\| undefined\)/)
    expect(fonte).toMatch(/\n\s+cupom: cupomEnviado,/)
  })
  it('the shared helper echoes the server message for the coupon 429', () => {
    const msg = 'Muitas tentativas de cupom para esta placa. Tente de novo mais tarde.'
    expect(mensagemDoLimite({ statusCode: 429, data: { message: msg, data: { limite: true, motivo: 'cupom_placa' } } })).toBe(msg)
    expect(mensagemDoLimite({ statusCode: 429, data: { message: 'x' } })).toBeNull()
  })
})
