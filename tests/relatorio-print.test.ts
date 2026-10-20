import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Impressao do relatorio (20/out/2026): A4, so o laudo, cards que quebram e
// itens que nao quebram. Guarda contra alguem apagar as regras sem perceber.
const vue = readFileSync('pages/premium/[token].vue', 'utf8')
const bloco = vue.slice(vue.indexOf('@page { size: A4'), vue.indexOf('</style>', vue.indexOf('@page { size: A4')))

describe('impressao do relatorio', () => {
  it('A4 com margem pequena', () => {
    expect(bloco).toMatch(/@page \{ size: A4; margin: 11mm 10mm 13mm; \}/)
  })
  it('esconde acoes, e-mail, venda e botoes', () => {
    for (const c of ['.rel__acoes', '.rel__email', '.rel__card--up', '.rel__btn']) expect(bloco).toContain(c)
    expect(bloco).toMatch(/button \{ display: none !important; \}/)
  })
  it('checklist sai no papel como lista simples com caixa vazia, sem as caixinhas interativas', () => {
    expect(bloco).not.toMatch(/\.rel__card--up, \.rel__check,/)
    expect(bloco).toMatch(/\.rel__check-input, \.rel__check-cont, \.rel__check-erro, \.rel__check-tela \{ display: none !important; \}/)
    expect(bloco).toContain("content: '☐'")
    expect(vue).toContain('class="rel__check-sub rel__check-papel"')
  })
  it('cards quebram; titulos presos ao conteudo; itens nao partem', () => {
    expect(bloco).toMatch(/\.rel__card \{[^}]*break-inside: auto/)
    expect(bloco).toMatch(/\.rel__h2 \{ break-after: avoid/)
    expect(bloco).toContain('.rel__multas-item')
    expect(bloco).toContain('.rel__recall-item')
  })
  it('fotos ate 2 por linha; cor de fundo so no que e sinal', () => {
    expect(bloco).toMatch(/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
    expect(bloco).toMatch(/print-color-adjust: exact/)
  })
  it('rodape com pagina e endereco do relatorio; <details> abertos no papel', () => {
    expect(vue).toContain('counter(page) " de " counter(pages)')
    expect(vue).toContain("placacompleta.com.br/premium/${token}")
    expect(vue).toContain("addEventListener('beforeprint'")
    expect(bloco).toContain('details::details-content')
  })
  it('sem travessao no texto novo', () => {
    expect(bloco).not.toMatch(/—/)
  })
})
