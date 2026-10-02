import { describe, it, expect } from 'vitest'
import { PAGINAS_COMPRA, COMPLETA_NAO_TRAZ } from './cluster-compra'

describe('cluster de compra', () => {
  it('4 rotas', () => {
    expect(PAGINAS_COMPRA.map((p) => p.rota)).toEqual(['/laudo-cautelar', '/historico-veicular', '/consulta-veicular-completa', '/consulta-leilao-veiculo'])
  })
  it('honestidade: diz que nao e vistoria', () => {
    expect(COMPLETA_NAO_TRAZ.join(' ')).toMatch(/Vistoria física/)
    expect(PAGINAS_COMPRA[0].faq[0].resposta).toMatch(/^Não\./)
  })
  for (const p of PAGINAS_COMPRA) {
    it(`${p.rota}: title/description e regras`, () => {
      expect((p.title + ' | PlacaCompleta').length).toBeLessThanOrEqual(75)
      expect(p.title).not.toMatch(/gr[aá]tis/i)
      expect(p.description.length).toBeLessThanOrEqual(160)
      expect(JSON.stringify(p)).not.toMatch(/—|infosimples|wdapi|apiplacas|R\$\s*\d/i)
    })
  }
})
