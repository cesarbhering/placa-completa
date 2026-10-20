import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLANOS, precoDePromocao } from './planos'

// Precos de 20/out/2026 (Cesar): basica R$ 29,90, completa R$ 44,90, e a
// promocao "de 44,90 por 39,90" acabou (sem novo "de"). Se voltar a haver
// promocao, o "de" vem de planos.ts (precoDeCentavos) e e maior que o cobrado.
describe('precos e promocao', () => {
  it('basica 29,90 e completa 44,90, sem promocao', () => {
    expect(PLANOS.basica.valorCentavos).toBe(2990)
    expect(PLANOS.completa.valorCentavos).toBe(4490)
    expect(PLANOS.completa.precoDeCentavos).toBeUndefined()
    expect(precoDePromocao('completa')).toBeNull()
  })
  it('o "de" sempre maior que o "por"; sem isso, nao ha promocao', () => {
    for (const p of Object.values(PLANOS)) {
      const de = precoDePromocao(p.id)
      if (de != null) expect(de).toBeGreaterThan(p.valorCentavos)
    }
    expect(precoDePromocao('gratis')).toBeNull()
    expect(precoDePromocao('basica')).toBeNull()
  })
  it('nenhum preco escrito a mao nas telas de venda (tudo sai de planos.ts)', () => {
    for (const f of ['pages/index.vue', 'components/PaginaCompra.vue', 'components/PremiumInlineCheckout.vue', 'components/PrecoPromo.vue']) {
      // Comentario pode citar valor de exemplo; o que importa e o que vai pra tela.
      const codigo = readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\/.*$/gm, '')
      expect(codigo, f).not.toMatch(/R\$\s?\d+,\d{2}|\b(2990|3990|4490)\b/)
    }
  })
})
