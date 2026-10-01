// ============================================================
// Theming por dominio (hibrido de dominios, ago/2026): olhonamoto.com.br e
// olhonocaminhao.com.br servem a MESMA aplicacao (mesmo backend, mesmo
// checkout/consulta), so trocando hero/copy conforme o Host da requisicao.
// placacompleta.com.br continua o default, sem nenhuma mudanca.
//
// Escopo do theming e SO apresentacao (hero, titulo, OG). O `site.url` do
// nuxt-site-config NAO e sobrescrito por dominio de proposito: o canonical
// de toda pagina de funil (consulta/checkout/premium, home) continua
// apontando pra placacompleta.com.br automaticamente (o comportamento ja
// existente, sem codigo novo) — evita conteudo duplicado indexado nos 3
// dominios. Paginas de CONTEUDO PROPRIO (ex.: moto, cluster "tabela fipe
// moto") que devem ranquear por conta propria sao self-canonical — a regra
// completa (prefixos de rota alinhados com o @seo) mora em
// useDomainCanonical(), chamada uma vez em app.vue.
// ============================================================

export type SiteVariant = 'moto' | 'caminhao' | 'default'

const HOST_VARIANTS: Record<string, SiteVariant> = {
  'olhonamoto.com.br': 'moto',
  'www.olhonamoto.com.br': 'moto',
  'olhonocaminhao.com.br': 'caminhao',
  'www.olhonocaminhao.com.br': 'caminhao',
}

// A home ("/") de proposito NAO tem routeRule de cache nenhum (nem
// prerender, nem swr): so assim cada request roda SSR de verdade e le o
// Host correto sempre. Ja tentamos prerender + rewrite interno por Host
// (ver historico do PR) — o Nitro serve rota prerenderizada como asset
// ESTATICO, por um caminho que roda ANTES de qualquer server middleware, e
// o rewrite nunca chegava a executar em build de producao real. swr tambem
// nao serve: o cache dele e por PATH, nao por Host, e "/" e um path so pros
// 3 dominios — serviria a variante que "ganhou" a corrida de quem pediu
// primeiro pra todo mundo, mesmo bug preenchido em runtime. Custo aceito:
// TTFB da home sobe (sem cache de borda no HTML).

export interface SiteVariantContent {
  variant: SiteVariant
  siteName: string
  eyebrow: string
  h1Line1: string
  h1Accent: string
  sub: string
  heroImage: string
  heroImageAlt: string
  metaTitle: string
  ogTitle: string
  /**
   * Copy do compartilhamento social. Sem a palavra "gratis": no card que
   * circula em grupo de WhatsApp e rede social, o produto que a gente quer
   * anunciar e o relatorio pago. O "gratis" segue vivo no title do Google,
   * onde ele ganha o clique.
   */
  ogDescription: string
}

const CONTENT: Record<SiteVariant, SiteVariantContent> = {
  default: {
    variant: 'default',
    siteName: 'PlacaCompleta',
    eyebrow: 'Consulta veicular por placa',
    h1Line1: 'O anúncio mostra o carro.',
    h1Accent: 'O relatório mostra o resto.',
    sub: 'Restrição, roubo, gravame, registro de leilão, dívida. O que o vendedor não conta, a placa revela.',
    heroImage: '/carro-hero.webp',
    heroImageAlt: '',
    // Sem sufixo de marca aqui: o modulo de SEO ja anexa " | PlacaCompleta"
    // sozinho, a partir de site.name no nuxt.config. Escrever a marca no
    // texto fazia o titulo sair duplicado em producao.
    // 01/out (Cesar): distanciar do "gratis" nas superficies que Google/IA leem.
    metaTitle: 'PlacaCompleta: Consulta de Placa, Leilão, Gravame, Roubo e Débitos',
    ogTitle: 'PlacaCompleta: Consulta de Placa, Leilão, Gravame, Roubo e Débitos',
    ogDescription: 'Antes de fechar negócio, veja o que o vendedor não conta: registro de leilão, roubo, gravame, multas e recall pendente. Consulta pela placa e relatório completo na hora.',
  },
  moto: {
    variant: 'moto',
    siteName: 'Olho na Moto',
    eyebrow: 'Consulta veicular por placa · moto',
    h1Line1: 'O anúncio mostra a moto.',
    h1Accent: 'O relatório mostra o resto.',
    sub: 'Restrição, roubo, gravame, registro de leilão, dívida. O que o vendedor não conta, a placa revela.',
    // Honda CB600F Hornet, fundo transparente (recorte do Cesar).
    heroImage: '/hero-moto.webp',
    heroImageAlt: 'Honda CB600F Hornet vista de lado',
    metaTitle: 'Consulta Placa de Moto: Leilão, Gravame, Roubo e Débitos',
    ogTitle: 'Olho na Moto · Relatório completo da moto pela placa',
    ogDescription: 'O que o anúncio não conta sobre a moto: restrição, roubo e furto, gravame, recall, valor FIPE e o histórico de leilão, com base de mais de 1 milhão de veículos. Pagamento único no Pix, sem assinatura.',
  },
  caminhao: {
    variant: 'caminhao',
    siteName: 'Olho no Caminhão',
    eyebrow: 'Consulta veicular por placa · caminhão',
    h1Line1: 'O anúncio mostra o caminhão.',
    h1Accent: 'O relatório mostra o resto.',
    sub: 'Restrição, roubo, gravame, registro de leilão, dívida. O que o vendedor não conta, a placa revela.',
    // Volvo FH, fundo transparente (recorte do Cesar).
    heroImage: '/hero-caminhao.webp',
    heroImageAlt: 'Caminhão Volvo FH visto de lado',
    metaTitle: 'Consulta Placa de Caminhão: Leilão, Gravame, Roubo e Débitos',
    ogTitle: 'Olho no Caminhão · Relatório completo do caminhão pela placa',
    ogDescription: 'O que o anúncio não conta sobre o caminhão: restrição, roubo e furto, gravame, recall, valor FIPE e o histórico de leilão, com base de mais de 1 milhão de veículos. Pagamento único no Pix, sem assinatura.',
  },
}

/**
 * Detecta o dominio da requisicao (SSR via useRequestURL, que le o Host real
 * do request; client via window.location — mesma API, universal) e devolve
 * o variant. 'default' cobre placacompleta.com.br E qualquer host nao
 * mapeado (staging, preview, localhost) — nunca quebra por host desconhecido.
 */
export function useSiteVariant(): SiteVariant {
  const { hostname } = useRequestURL()
  return HOST_VARIANTS[hostname] || 'default'
}

/** Conteudo do hero/meta pro variant atual. */
export function useSiteVariantContent(): SiteVariantContent {
  return CONTENT[useSiteVariant()]
}
