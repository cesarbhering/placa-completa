import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { jsonLdProdutos, produtoConsulta, offersOrfaos, planosDaPagina, semProdutoNaPagina } from '../shared/jsonld-produto'
import { PLANOS } from '../shared/planos'

const RAIZ = join(__dirname, '..')

describe('Product da consulta (JSON-LD)', () => {
  it('Completa: name, image, description, brand, sku e offer completo', () => {
    const p = produtoConsulta('completa', 'https://placacompleta.com.br/tabela-fipe')
    expect(p).toMatchObject({
      '@type': 'Product',
      name: 'Consulta Completa PlacaCompleta',
      sku: 'consulta-completa',
      image: 'https://placacompleta.com.br/og-home.png',
      brand: { '@type': 'Brand', name: 'PlacaCompleta' },
      offers: {
        '@type': 'Offer',
        price: (PLANOS.completa.valorCentavos / 100).toFixed(2),
        priceCurrency: 'BRL',
        availability: 'https://schema.org/InStock',
        url: 'https://placacompleta.com.br/tabela-fipe',
        seller: { '@type': 'Organization', name: 'PlacaCompleta' },
      },
    })
    expect(p.offers.price).toBe('44.90')
    expect(p.description.length).toBeGreaterThan(20)
    expect(p).not.toHaveProperty('aggregateRating')
    expect(p).not.toHaveProperty('review')
  })
  it('Basica 29.90 so onde e ofertada (home)', () => {
    expect(planosDaPagina('/')).toEqual(['basica', 'completa'])
    expect(planosDaPagina('/tabela-fipe/toyota')).toEqual(['completa'])
    expect(produtoConsulta('basica', 'https://placacompleta.com.br/').offers.price).toBe('29.90')
  })
  it('url da oferta e a da pagina; area paga e telas internas ficam sem', () => {
    const g = jsonLdProdutos('/seguro/carro-eletrico/sp')['@graph']
    expect(g[0].offers.url).toBe('https://placacompleta.com.br/seguro/carro-eletrico/sp')
    expect(semProdutoNaPagina('/premium/abc')).toBe(true)
    expect(semProdutoNaPagina('/admin')).toBe(true)
    expect(semProdutoNaPagina('/tabela-fipe')).toBe(false)
  })
  it('offersOrfaos: acha Offer solto, aceita dentro de Product', () => {
    expect(offersOrfaos({ '@type': 'WebApplication', offers: { '@type': 'Offer', price: '1' } })).toEqual(['$.offers'])
    expect(offersOrfaos(jsonLdProdutos('/'))).toEqual([])
  })
})

// Todo Offer do site sai do builder (dentro de Product). Varre o codigo que
// emite JSON-LD: pagina, componente, app.vue, nuxt.config e server.
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const c = join(dir, n)
    if (n === 'node_modules' || n.startsWith('.')) return []
    return statSync(c).isDirectory() ? arquivos(c) : /\.(vue|ts|js|mjs)$/.test(n) && !/\.test\./.test(n) ? [c] : []
  })
}

describe('todo Offer emitido no site esta dentro de Product', () => {
  it('nenhum Offer/AggregateOffer fora de shared/jsonld-produto.ts', () => {
    const lista = [...['pages', 'components', 'composables', 'server', 'shared', 'layouts', 'plugins'].flatMap((d) => { try { return arquivos(join(RAIZ, d)) } catch { return [] } }), join(RAIZ, 'app.vue'), join(RAIZ, 'nuxt.config.ts')]
    const RE = /['"]@type['"]\s*:\s*['"](Offer|AggregateOffer)['"]|\bdefine(Offer|AggregateOffer)\s*\(/
    const culpados = lista.filter((f) => !f.endsWith(join('shared', 'jsonld-produto.ts')) && RE.test(readFileSync(f, 'utf8'))).map((f) => relative(RAIZ, f))
    expect(culpados).toEqual([])
  })
  it('o WebApplication global nao tem mais offers', () => {
    const cfg = readFileSync(join(RAIZ, 'nuxt.config.ts'), 'utf8')
    const bloco = cfg.slice(cfg.indexOf('"@type": "WebApplication"'), cfg.indexOf('}),', cfg.indexOf('"@type": "WebApplication"')))
    expect(bloco).not.toMatch(/offers\s*:/)
  })
  it('veiculo da tabela FIPE nao vira Product nem Vehicle', () => {
    const slug = readFileSync(join(RAIZ, 'pages/tabela-fipe/[slug].vue'), 'utf8')
    expect(slug).not.toMatch(/['"]@type['"]\s*:\s*['"](Product|Vehicle)['"]/)
  })
})
