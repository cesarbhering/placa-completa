import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { COLUNAS_RODAPE } from '../shared/rodape-links'

const destinos = COLUNAS_RODAPE.flatMap((c) => c.links.map((l) => l.to))
const app = readFileSync('app.vue', 'utf8')

describe('rodape em colunas', () => {
  it('4 colunas na ordem pedida', () => {
    expect(COLUNAS_RODAPE.map((c) => c.titulo)).toEqual(['Consultas', 'Preços e FIPE', 'Aprenda', 'Empresa'])
  })
  it('nenhum link do rodape antigo some (SEO)', () => {
    for (const to of ['/consultar-placa', '/tabela-fipe', '/tabela-fipe-por-placa', '/como-consultar-placa', '/carro-de-leilao/como-saber', '/ibv', '/estudos', '/blog', '/sobre', 'mailto:contato@placacompleta.com.br']) {
      expect(destinos).toContain(to)
    }
    for (const t of ['/termos-de-uso', '/politica-de-privacidade', 'play.google.com', 'linkedin.com/company/placacompleta', 'x.com/PlacaCompleta', 'CNPJ 62.569.152/0001-67', '<LogosPagamento']) {
      expect(app).toContain(t)
    }
  })
  it('nunca /premium bare; sem travessao', () => {
    expect(destinos.some((d) => /^\/premium\/?$/.test(d))).toBe(false)
    expect(JSON.stringify(COLUNAS_RODAPE)).not.toContain('—')
  })
  it('sanfona acessivel: details/summary', () => {
    expect(app).toMatch(/<details[^>]*class="footer__col"[\s\S]*<summary/)
  })
})
