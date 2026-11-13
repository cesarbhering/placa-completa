import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mensagemDoLimite } from '../shared/mensagem-limite'
import { cupomSeguraCompra, avisoValorCartao } from '../shared/checkout-cupom'

// Inline checkout under the coupon attempt limit and the card amount check.
// The decisions run in shared/checkout-cupom.ts and are exercised here; the
// component checks below only confirm the component calls them where it must
// (the component itself is not mounted).
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
    expect(avisoValorCartao(4041, 4041, reais)).toBeNull()
  })
  it('different amount (any cause): hold with a short message carrying the amount', () => {
    const m = avisoValorCartao(4490, 4041, reais)
    expect(m).toBe('O cupom não pôde ser aplicado. O valor do pagamento é R$ 44,90. Toque em pagar de novo para confirmar.')
    expect(m).not.toContain('\u2014')
    expect(avisoValorCartao(3990, 4490, reais)).toContain('R$ 39,90')
  })
  it('no amount in the answer: does not hold', () => {
    expect(avisoValorCartao(undefined, 4490, reais)).toBeNull()
    expect(avisoValorCartao('4490', 4490, reais)).toBeNull()
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
    expect(fonte.match(/cupom: cupomBloqueado\.value \? undefined : \(cupomCodigo\.value\.trim\(\) \|\| undefined\)/g)).toHaveLength(2)
  })
  it('the card is confirmed only after the amount check', () => {
    const i = fonte.indexOf('async function pagarComCartao')
    const corpo = fonte.slice(i, fonte.indexOf('\n}\n', i))
    const aviso = corpo.indexOf('avisoValorCartao(r.valor, precoExibidoCentavos.value, reais)')
    expect(aviso).toBeGreaterThan(-1)
    expect(corpo.indexOf('confirmCardPayment')).toBeGreaterThan(aviso)
    expect(corpo).toMatch(/if \(aviso\) \{[\s\S]*?valorCartaoServidor\.value = r\.valor[\s\S]*?cartaoPendente\.value = r[\s\S]*?return/)
  })
  it('the shared helper echoes the server message for the coupon 429', () => {
    const msg = 'Muitas tentativas de cupom para esta placa. Tente de novo mais tarde.'
    expect(mensagemDoLimite({ statusCode: 429, data: { message: msg, data: { limite: true, motivo: 'cupom_placa' } } })).toBe(msg)
    expect(mensagemDoLimite({ statusCode: 429, data: { message: 'x' } })).toBeNull()
  })
})
