import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Price A/B test: the arm must travel in every request whose answer decides
// the price (Pix checkout, embedded card, coupon validation), otherwise the
// server would fall back to arm A while the screen shows arm B.
function corpoDoFetch(fonte: string, rota: string): string {
  const i = fonte.indexOf(`$fetch('${rota}'`)
  expect(i, rota).toBeGreaterThan(-1)
  const fim = fonte.indexOf('\n    })', i)
  return fonte.slice(i, fim > i ? fim : i + 3000)
}

describe('inline checkout sends ab_preco', () => {
  const fonte = readFileSync('components/PremiumInlineCheckout.vue', 'utf8')
  for (const rota of ['/api/premium/checkout', '/api/premium/cartao-intent', '/api/premium/coupon']) {
    it(rota, () => {
      expect(corpoDoFetch(fonte, rota)).toMatch(/ab_preco:\s*abPrecoCheckout\.value/)
    })
  }
  it('the arm comes from the visitor draw and the app stays out', () => {
    expect(fonte).toMatch(/abPrecoCheckout = computed\(\(\) => \(isCapacitor\.value \? null : bracoAtual\(\)\)\)/)
  })
})

describe('/premium page sends ab_preco', () => {
  it('/api/premium/checkout', () => {
    const fonte = readFileSync('pages/premium/index.vue', 'utf8')
    expect(corpoDoFetch(fonte, '/api/premium/checkout')).toMatch(/ab_preco:\s*bracoAtual\(\)/)
  })
})
