import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Regra do Cesar (02/out): nenhum valor de leilao em R$ (venda, lance,
// avaliacao, media de arremate) em lugar nenhum do site.
describe('sem valor de leilao nas telas', () => {
  for (const f of ['pages/carro-de-leilao/como-saber.vue', 'shared/guia-como-saber-leilao.ts', 'pages/carro-de-leilao/[slug].vue', 'shared/fipe-enriquecimento.ts', 'components/ResultadoLayoutA.vue', 'pages/index.vue']) {
    it(f, () => {
      const s = readFileSync(f, 'utf8')
      expect(s).not.toMatch(/arremate[^\n]{0,80}R\$|Valor de venda'|lance (inicial|m[ií]nimo)/i)
    })
  }
})
