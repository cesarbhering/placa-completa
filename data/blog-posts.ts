import { BASE_LEILAO_TEXTO } from '../shared/base-leilao'
import { postEconomicos } from './blog-post-economicos'
import { postRecallVwFreio, postRecallVolvoEx30 } from './blog-posts-recall'

// Posts do /blog. Mais recente primeiro. Regras de copy: sem travessao, sem
// citar a fonte de dados do registro, sem numeros de venda/receita.

export interface BlogSection {
  type: 'intro' | 'heading' | 'cta' | 'table' | 'faq'
  heading?: string
  text?: string
  ctaLabel?: string
  ctaTo?: string
  // type 'table': cabecalho, linhas e legenda (nota abaixo da tabela)
  columns?: string[]
  rows?: string[][]
  caption?: string
  // type 'faq': perguntas e respostas (viram FAQPage no schema)
  faq?: { q: string; a: string }[]
}

export interface BlogPost {
  slug: string
  title: string
  metaDescription: string
  seoTitles?: string[] // variantes de <title> (50 a 60 caracteres), da preferida pra curta
  publishedAt: string // ISO
  categoria: string
  capa: { src: string; og: string; alt: string; largura: number; altura: number }
  content: BlogSection[]
}

export const blogPosts: BlogPost[] = [
  postRecallVwFreio,
  postRecallVolvoEx30,
  postEconomicos,
  {
    slug: 'claude-for-startups',
    title: 'PlacaCompleta é aceito no Claude for Startups, da Anthropic',
    metaDescription: 'O PlacaCompleta entrou no Claude for Startups, da Anthropic. O programa acelera nossa base de leilões, a cobertura de DETRANs e relatórios mais completos.',
    publishedAt: '2026-10-08',
    categoria: 'Novidades',
    capa: {
      src: '/images/blog/claude-for-startups.png',
      og: '/images/blog/claude-for-startups-1200.png',
      alt: 'PlacaCompleta, aceitos no programa Claude for Startups. Construído com agentes de IA. Agora com mais fôlego para acelerar.',
      largura: 1600,
      altura: 836,
    },
    content: [
      {
        type: 'intro',
        text: 'Temos uma notícia que nos enche de orgulho: o **PlacaCompleta foi aceito no programa Claude for Startups, da Anthropic**. É uma honra fazer parte de um grupo de empresas que estão construindo produtos de verdade com inteligência artificial, e um sinal claro de que estamos no caminho certo.',
      },
      {
        type: 'heading',
        heading: 'Na vanguarda da era da IA',
        text: 'O PlacaCompleta é construído e operado com **agentes de IA trabalhando ao lado do nosso time**. Agentes baseados no Claude cuidam de engenharia, dados de leilão, infraestrutura e marketing, todos os dias, com o time definindo as prioridades e revisando o que vai para o ar.\n\nIsso não é um detalhe técnico. É o que nos permite entregar, com agilidade e cuidado, um relatório que antes exigiria uma operação muito maior.',
      },
      {
        type: 'heading',
        heading: 'O que o PlacaCompleta faz',
        text: 'Antes de comprar um carro usado, você digita a placa e vê o que o anúncio não conta:\n\n- histórico e registro de leilão\n- roubo e furto\n- gravame (financiamento)\n- bloqueio judicial (RENAJUD)\n- multas e débitos\n- recall pendente\n- valor FIPE e custo de propriedade',
      },
      {
        type: 'heading',
        heading: 'Nosso diferencial: a base de leilões',
        text: `Mantemos uma base própria com **${BASE_LEILAO_TEXTO}**, montada por agentes que leem editais públicos de órgãos de trânsito e catálogos de leiloeiras. Muitos leilões nunca aparecem no documento do veículo. Na nossa base, aparecem, e você vê isso antes de fechar negócio.`,
      },
      {
        type: 'heading',
        heading: 'O que o programa acelera',
        text: '- **Mais fontes de leilão**, com novas casas e editais entrando na base.\n- **Mais DETRANs integrados**, para trazer multas e débitos direto do órgão estadual.\n- **Relatórios mais completos**, com mais contexto para decidir a compra.',
      },
      {
        type: 'heading',
        heading: 'Obrigado, Anthropic',
        text: 'Agradecemos à Anthropic pela confiança e pelo apoio. Seguimos com o mesmo objetivo de sempre: que ninguém compre um carro usado no escuro.',
      },
      {
        type: 'cta',
        text: 'Vai comprar um usado? Consulte a placa antes de fechar negócio.',
        ctaLabel: 'Consultar placa',
        ctaTo: '/',
      },
    ],
  },
]

export function findBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug)
}
