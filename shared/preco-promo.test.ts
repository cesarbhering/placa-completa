import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLANOS, precoDePromocao } from './planos'

// "Promo: de R$ 44,90 por R$ 39,90" (anuncios do Google, 09/out). O "de" vem
// de planos.ts (precoDeCentavos) e e sempre maior que o cobrado.
describe('preco riscado da completa', () => {
  it('de R$ 44,90 por R$ 39,90, os dois de planos.ts', () => {
    expect(PLANOS.completa.precoDeCentavos).toBe(4490)
    expect(PLANOS.completa.valorCentavos).toBe(3990)
    expect(precoDePromocao('completa')).toBe(4490)
  })
  it('o "de" sempre maior que o "por"; sem isso, nao ha promocao', () => {
    for (const p of Object.values(PLANOS)) {
      const de = precoDePromocao(p.id)
      if (de != null) expect(de).toBeGreaterThan(p.valorCentavos)
    }
    expect(precoDePromocao('gratis')).toBeNull()
    expect(precoDePromocao('basica')).toBeNull()
  })
  it('nenhum lugar escreve 44,90 a mao', () => {
    for (const f of ['pages/index.vue', 'components/PaginaCompra.vue', 'components/PremiumInlineCheckout.vue', 'components/PrecoPromo.vue']) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/44[,.]90|4490/)
    }
  })
})
