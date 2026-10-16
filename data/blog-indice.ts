import { blogPosts } from './blog-posts'
import { ibvPosts } from './ibv-posts'

// Indice unico do /blog (16/out/2026, decisao do Cesar): os posts do blog e os
// do IBV Auto (que antes viviam em /ibv) num lugar so, com tag. Cada post tem
// UMA tag: a categoria nos posts do blog, "IBV Auto" nos do IBV.

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
    slug: 'novidades',
    nome: 'Novidades',
    titulos: ['Novidades do PlacaCompleta: Produto e Bastidores no Blog', 'Novidades do PlacaCompleta no Blog'],
    description: 'Novidades do PlacaCompleta: o que mudou no produto, a base de leilões, os relatórios e os bastidores de uma empresa construída com agentes de IA.',
    lead: 'O que mudou no PlacaCompleta e os bastidores do produto.',
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
  tipo: 'blog' | 'ibv'
}

function tagPorNome(nome: string): TagBlog {
  const t = TAGS_BLOG.find((x) => x.nome.toLowerCase() === nome.toLowerCase())
  if (!t) throw new Error(`Tag de blog sem cadastro em TAGS_BLOG: ${nome}`)
  return t
}

export function tagPorSlug(slug: string): TagBlog | undefined {
  return TAGS_BLOG.find((t) => t.slug === slug)
}

/** Todos os posts, mais recente primeiro (empate: blog antes do IBV, ordem dos arquivos). */
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
].map((p, i) => ({ p, i }))
  .sort((a, b) => b.p.publishedAt.localeCompare(a.p.publishedAt) || a.i - b.i)
  .map(({ p }) => p)

/** Tags com ao menos um post (as que viram pagina e entram no sitemap). */
export const tagsComPost: TagBlog[] = TAGS_BLOG.filter((t) => postsDoBlog.some((p) => p.tag.slug === t.slug))

/** URLs do blog pro sitemap (indice, tags e posts). */
export function urlsDoBlog(): string[] {
  return ['/blog', ...tagsComPost.map((t) => `/blog/tag/${t.slug}`), ...postsDoBlog.map((p) => `/blog/${p.slug}`)]
}
