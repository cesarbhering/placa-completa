import { blogPosts } from './blog-posts'
import { ibvPosts } from './ibv-posts'
import { DESCRICOES } from '../shared/seo-meta'

// Indice unico do /blog (16/out/2026, decisao do Cesar): os posts do blog e os
// do IBV Auto (que antes viviam em /ibv) num lugar so, com tag. Cada post tem
// UMA tag: a categoria nos posts do blog, "IBV Auto" nos do IBV. Desde
// 26/nov/2026 a listagem tambem mostra paginas que moram fora do /blog
// (paginasNoBlog), cada uma com o seu href.

export interface TagBlog {
  slug: string
  nome: string
  /** <title> final (50 a 60 caracteres; shared/seo-titulo.ts). */
  titulos: string[]
  description: string
  /** Texto curto no topo da pagina da tag. */
  lead: string
}

export const TAGS_BLOG: TagBlog[] = [
  {
    slug: 'ibv-auto',
    nome: 'IBV Auto',
    // Mesmos title/description da antiga /ibv (o que ja ranqueava).
    titulos: ['IBV Auto: Índice de Inflação de Carros Usados', 'IBV Auto: Inflação de Carros Usados'],
    description: 'Acompanhe o Índice BV Auto (IBV), referência mensal de inflação de automóveis usados no Brasil. Dados por modelo, estado e tipo de combustível.',
    lead: 'O Índice BV Auto (IBV) é a referência mensal de inflação de automóveis usados no Brasil, publicado pelo banco BV. Aqui ficam as nossas análises de cada mês, por modelo, estado e tipo de combustível.',
  },
  {
    slug: 'estudos',
    nome: 'Estudos',
    titulos: ['Estudos do PlacaCompleta: Dados de Carros Usados no Blog', 'Estudos do PlacaCompleta: Dados de Carros Usados'],
    description: 'Estudos do PlacaCompleta no blog: consumo, preço e mercado de carros usados no Brasil, com dados abertos e metodologia explicada em cada post.',
    lead: 'Levantamentos com dados abertos sobre carros usados: consumo, preço e mercado.',
  },
  {
    slug: 'recall',
    nome: 'Recall',
    titulos: ['Recall de Carros: Campanhas e o que o Dono Deve Fazer', 'Recall de Carros: Campanhas e Orientação ao Dono'],
    description: 'Recalls de carros e motos no Brasil explicados em linguagem simples: modelos, defeito, risco e o que o dono deve fazer. Veja se consta recall para a sua placa.',
    lead: 'Chamados de recall explicados em linguagem simples: quais modelos, qual o defeito e o que fazer. Consulte a placa para ver se o carro consta em campanha.',
  },
  {
    slug: 'novidades',
    nome: 'Novidades',
    titulos: ['Novidades do PlacaCompleta: Produto e Bastidores no Blog', 'Novidades do PlacaCompleta no Blog'],
    description: 'Novidades do PlacaCompleta: o que mudou no produto, a base de leilões, os relatórios e os bastidores de uma empresa construída com agentes de IA.',
    lead: 'O que mudou no PlacaCompleta e os bastidores do produto.',
  },
  {
    slug: 'para-empresas',
    nome: 'Para empresas',
    titulos: ['Consulta Veicular para Empresas: Lojistas e Despachantes', 'Consulta Veicular para Empresas no Blog'],
    description: 'Consulta veicular para lojistas, garagens, despachantes e financeiras: como consultar toda placa antes de fechar negócio e o pacote com desconto por volume.',
    lead: 'Conteúdo para quem compra, vende e transfere carros todos os dias: lojistas, garagens, despachantes e pequenas financeiras.',
  },
]

export interface EntradaBlog {
  slug: string
  title: string
  metaDescription: string
  publishedAt: string
  tag: TagBlog
  /** Imagem do card na listagem (pode faltar). */
  imagem: { src: string; alt: string } | null
  tipo: 'blog' | 'ibv' | 'pagina'
  /**
   * Caminho proprio, so para pagina que mora fora do /blog (ex.: /ipva-2027).
   * Sem ele, o post fica em /blog/<slug>. Use sempre linkDoPost/urlAbsolutaDoPost.
   */
  href?: string
}

function tagPorNome(nome: string): TagBlog {
  const t = TAGS_BLOG.find((x) => x.nome.toLowerCase() === nome.toLowerCase())
  if (!t) throw new Error(`Tag de blog sem cadastro em TAGS_BLOG: ${nome}`)
  return t
}

export function tagPorSlug(slug: string): TagBlog | undefined {
  return TAGS_BLOG.find((t) => t.slug === slug)
}

/**
 * Paginas fora do /blog que tambem entram na listagem (26/nov/2026, pedido do
 * Cesar). Cada uma tem href proprio: nunca vira /blog/<slug> (seria 404) e fica
 * fora de urlsDoBlog, porque a pagina ja esta no sitemap pelo nuxt.config.ts.
 */
export const paginasNoBlog: EntradaBlog[] = [
  {
    slug: 'ipva-2027',
    href: '/ipva-2027',
    // Mesmos title (og:title) e description da pagina (pages/ipva-2027.vue).
    title: 'IPVA 2027: estimativa do valor pela placa e calendário',
    metaDescription: DESCRICOES.ipva2027,
    publishedAt: '2026-11-26',
    tag: tagPorNome('Estudos'),
    imagem: {
      src: '/images/blog/ipva-2027-1200.png',
      alt: 'IPVA 2027: em 9 estados, o IPVA do carro depende da potência, da cilindrada ou do valor. Alíquota de carro de passeio: São Paulo 4%, Minas Gerais 4%, Rio Grande do Sul 3%, Pernambuco 2,4% e Paraná 1,9%.',
    },
    tipo: 'pagina',
  },
]

/** Todos os posts, mais recente primeiro (empate: blog, IBV e paginas, na ordem dos arquivos). */
export const postsDoBlog: EntradaBlog[] = [
  ...blogPosts.map((p) => ({
    slug: p.slug, title: p.title, metaDescription: p.metaDescription, publishedAt: p.publishedAt,
    tag: tagPorNome(p.categoria), imagem: { src: p.capa.og, alt: p.capa.alt }, tipo: 'blog' as const,
  })),
  ...ibvPosts.map((p) => {
    const img = p.content.find((s) => s.type === 'image' && s.src)
    return {
      slug: p.slug, title: p.title, metaDescription: p.metaDescription, publishedAt: p.publishedAt,
      tag: tagPorNome('IBV Auto'), imagem: img ? { src: img.src!, alt: img.alt || p.title } : null, tipo: 'ibv' as const,
    }
  }),
  ...paginasNoBlog,
].map((p, i) => ({ p, i }))
  .sort((a, b) => b.p.publishedAt.localeCompare(a.p.publishedAt) || a.i - b.i)
  .map(({ p }) => p)

/** Tags com ao menos um post (as que viram pagina e entram no sitemap). */
export const tagsComPost: TagBlog[] = TAGS_BLOG.filter((t) => postsDoBlog.some((p) => p.tag.slug === t.slug))

const URL_SITE = 'https://placacompleta.com.br'

/** Caminho do post no site: o href proprio (pagina fora do /blog) ou /blog/<slug>. */
export function linkDoPost(p: EntradaBlog): string {
  return p.href ?? `/blog/${p.slug}`
}

/** URL absoluta do post (JSON-LD, feeds e afins). */
export function urlAbsolutaDoPost(p: EntradaBlog): string {
  return `${URL_SITE}${linkDoPost(p)}`
}

/**
 * URLs do blog pro sitemap (indice, tags e posts). Entrada com href proprio
 * fica de fora: a pagina dela ja esta no sitemap.
 */
export function urlsDoBlog(): string[] {
  return ['/blog', ...tagsComPost.map((t) => `/blog/tag/${t.slug}`), ...postsDoBlog.filter((p) => !p.href).map(linkDoPost)]
}
