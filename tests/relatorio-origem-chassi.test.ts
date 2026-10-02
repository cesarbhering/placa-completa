import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Pedido do Cesar (02/out): o card "Origem do chassi" nao tem mais a
// frase-resumo "Fabricado pela X em Y." (nenhuma variante); so a ficha.
describe('card Origem do chassi', () => {
  const src = readFileSync('pages/premium/[token].vue', 'utf8')
  it('sem frase "Fabricado(a) pela/em"', () => {
    expect(src).not.toMatch(/`\$\{verbo\}|Fabricad[oa] (pela|em) \$\{/)
    expect(src).not.toMatch(/frasePlanta/)
    expect(src).toContain("titulo: 'Origem do chassi', linhas: fichaChassiOrigem.value, nota: null")
  })
  it('ficha continua com Fabricante e Pais de fabricacao', () => {
    expect(src).toContain("linha('Fabricante'")
    expect(src).toContain("linha('País de fabricação'")
  })
})
