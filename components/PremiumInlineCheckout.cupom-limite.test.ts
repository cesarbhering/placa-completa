import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mensagemDoLimite } from '../shared/mensagem-limite'

// Coupon attempt limit on the inline checkout: the 429 message shows in the
// coupon field and the purchase is not held by it.
const fonte = readFileSync('components/PremiumInlineCheckout.vue', 'utf8')

describe('inline checkout: coupon attempt limit', () => {
  it('the coupon validation sends the plate', () => {
    const i = fonte.indexOf("$fetch('/api/premium/coupon'")
    expect(fonte.slice(i, fonte.indexOf('\n    })', i))).toMatch(/placa:\s*placaClean\.value/)
  })

  it('the marked 429 message goes to the coupon field', () => {
    expect(fonte).toMatch(/const limite = mensagemDoLimite\(e\)\s*\n\s*cupomBloqueado\.value = !!limite\s*\n\s*cupomMsg\.value = limite \|\|/)
  })

  it('a blocked coupon is not sent with the order', () => {
    const envios = fonte.match(/cupom: cupomBloqueado\.value \? undefined : \(cupomCodigo\.value\.trim\(\) \|\| undefined\)/g) || []
    expect(envios).toHaveLength(2)
    expect(fonte).not.toMatch(/\n\s*cupom: cupomCodigo\.value\.trim\(\) \|\| undefined,/)
  })

  it('the shared helper echoes the server message for the coupon 429', () => {
    const msg = 'Muitas tentativas de cupom para esta placa. Tente de novo mais tarde.'
    expect(mensagemDoLimite({ statusCode: 429, data: { message: msg, data: { limite: true, motivo: 'cupom_placa' } } })).toBe(msg)
    expect(mensagemDoLimite({ statusCode: 429, data: { message: 'x' } })).toBeNull()
  })
})
