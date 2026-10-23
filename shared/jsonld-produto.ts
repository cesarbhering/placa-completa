// JSON-LD do NOSSO produto (Cesar, 21/out/2026). O Ahrefs marcava ~170 paginas
// (tabela FIPE, seguro por UF) como "Listing > Product" sem Product: o site
// emitia um Offer solto dentro do WebApplication. Agora toda oferta sai dentro
// de um Product de verdade (a consulta), num template unico (app.vue). Veiculo
// da tabela FIPE nunca vira Product: nao vendemos carros. Sem aggregateRating:
// nao temos avaliacoes agregadas de verdade, nao inventar.
import { PLANOS, type PlanoId } from './planos'

export const SITE_URL = 'https://placacompleta.com.br'
export const IMAGEM_PRODUTO = `${SITE_URL}/og-home.png`

const NOMES: Record<'basica' | 'completa', { nome: string; sku: string }> = {
  completa: { nome: 'Consulta Completa PlacaCompleta', sku: 'consulta-completa' },
  basica: { nome: 'Consulta Básica PlacaCompleta', sku: 'consulta-basica' },
}

export function produtoConsulta(plano: 'basica' | 'completa', url: string) {
  const p = PLANOS[plano as PlanoId]
  return {
    '@type': 'Product',
    '@id': `${SITE_URL}/#${NOMES[plano].sku}`,
    name: NOMES[plano].nome,
    sku: NOMES[plano].sku,
    image: IMAGEM_PRODUTO,
    // Uma frase do shared/planos: "Relatório completo de veículo por placa: tudo da básica, ..."
    description: `${p.nome} de veículo por placa: ${p.chamada.charAt(0).toLowerCase()}${p.chamada.slice(1)}`,
    brand: { '@type': 'Brand', name: 'PlacaCompleta' },
    offers: {
      '@type': 'Offer',
      price: (p.valorCentavos / 100).toFixed(2),
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      url,
      seller: { '@type': 'Organization', name: 'PlacaCompleta', url: SITE_URL },
    },
  }
}

/** Planos ofertados na pagina: a home mostra a basica e a completa; o resto, a completa. */
export function planosDaPagina(path: string): Array<'basica' | 'completa'> {
  return path === '/' ? ['basica', 'completa'] : ['completa']
}

/** Paginas que nao levam o JSON-LD do produto (area paga, telas internas). */
export function semProdutoNaPagina(path: string): boolean {
  return /^\/(premium|admin|dash|woovi-teste)(\/|$)/.test(path)
}

/** Bloco JSON-LD (um @graph) com os Products da pagina. */
export function jsonLdProdutos(path: string, origem = SITE_URL) {
  const url = `${origem.replace(/\/+$/, '')}${path || '/'}`
  return {
    '@context': 'https://schema.org',
    '@graph': planosDaPagina(path).map((pl) => produtoConsulta(pl, url)),
  }
}

const TIPOS_PRODUTO = new Set(['Product', 'Vehicle', 'Car', 'Motorcycle', 'IndividualProduct', 'ProductModel'])
const tipos = (n: any): string[] => (Array.isArray(n?.['@type']) ? n['@type'] : [n?.['@type']]).map(String)

/**
 * Caminhos de Offer/AggregateOffer que NAO estao dentro de um Product, num
 * JSON-LD qualquer. Vazio = ok. Usado no teste que varre o HTML renderizado.
 */
export function offersOrfaos(no: any, dentroDeProduto = false, caminho = '$'): string[] {
  if (Array.isArray(no)) return no.flatMap((x, i) => offersOrfaos(x, dentroDeProduto, `${caminho}[${i}]`))
  if (!no || typeof no !== 'object') return []
  const t = tipos(no)
  const out: string[] = []
  if (t.some((x) => x === 'Offer' || x === 'AggregateOffer') && !dentroDeProduto) out.push(caminho)
  const produto = dentroDeProduto || t.some((x) => TIPOS_PRODUTO.has(x))
  for (const [k, v] of Object.entries(no)) out.push(...offersOrfaos(v, produto, `${caminho}.${k}`))
  return out
}
