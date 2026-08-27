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
// dominios. Paginas de CONTEUDO PROPRIO (ex.: moto) que devem ranquear por
// conta propria usam useSelfCanonical() pra furar esse default.
// ============================================================

export type SiteVariant = 'moto' | 'caminhao' | 'default'

const HOST_VARIANTS: Record<string, SiteVariant> = {
  'olhonamoto.com.br': 'moto',
  'www.olhonamoto.com.br': 'moto',
  'olhonocaminhao.com.br': 'caminhao',
  'www.olhonocaminhao.com.br': 'caminhao',
}

export interface SiteVariantContent {
  variant: SiteVariant
  siteName: string
  eyebrow: string
  h1Line1: string
  h1Accent: string
  sub: string
  /** Ate as imagens definitivas chegarem, todos os variants usam o hero atual. */
  heroImage: string
  heroImageAlt: string
  metaTitle: string
  ogTitle: string
  ogDescription: string
}

const CONTENT: Record<SiteVariant, SiteVariantContent> = {
  default: {
    variant: 'default',
    siteName: 'PlacaCompleta',
    eyebrow: 'Consulta veicular por placa',
    h1Line1: 'O anúncio mostra o carro.',
    h1Accent: 'O relatório mostra o resto.',
    sub: 'Restrição, roubo, gravame, leilão, dívida. O que o vendedor não conta, a placa revela.',
    heroImage: '/carro-hero.webp',
    heroImageAlt: '',
    metaTitle: 'Consulta Placa Grátis: Marca, Modelo, Ano e Cor',
    ogTitle: 'PlacaCompleta · Relatório completo do veículo pela placa',
    ogDescription: 'Restrições, roubo/furto, gravame, leilão, recall, ficha completa, FIPE, seguro e custo em 5 anos. Pagamento único no Pix, resultado na hora. Consulta grátis sem cadastro.',
  },
  moto: {
    variant: 'moto',
    siteName: 'Olho na Moto',
    eyebrow: 'Consulta veicular por placa · moto',
    h1Line1: 'O anúncio mostra a moto.',
    h1Accent: 'O relatório mostra o resto.',
    sub: 'Restrição, roubo, gravame, leilão, dívida. O que o vendedor não conta, a placa revela.',
    // TODO(web): trocar pelo hero definitivo de moto quando o Cesar mandar
    // (tunel caiu). Placeholder = mesma imagem do default, so pra nao ter
    // <img> quebrada.
    heroImage: '/carro-hero.webp',
    heroImageAlt: '',
    metaTitle: 'Consulta Placa de Moto Grátis: Marca, Modelo, Ano e Cor',
    ogTitle: 'Olho na Moto · Relatório completo da moto pela placa',
    ogDescription: 'Restrições, roubo/furto, gravame, leilão, recall, ficha completa, FIPE, seguro e custo em 5 anos. Pagamento único no Pix, resultado na hora. Consulta grátis sem cadastro.',
  },
  caminhao: {
    variant: 'caminhao',
    siteName: 'Olho no Caminhão',
    eyebrow: 'Consulta veicular por placa · caminhão',
    h1Line1: 'O anúncio mostra o caminhão.',
    h1Accent: 'O relatório mostra o resto.',
    sub: 'Restrição, roubo, gravame, leilão, dívida. O que o vendedor não conta, a placa revela.',
    // TODO(web): idem — placeholder ate o hero definitivo de caminhao chegar.
    heroImage: '/carro-hero.webp',
    heroImageAlt: '',
    metaTitle: 'Consulta Placa de Caminhão Grátis: Marca, Modelo, Ano e Cor',
    ogTitle: 'Olho no Caminhão · Relatório completo do caminhão pela placa',
    ogDescription: 'Restrições, roubo/furto, gravame, leilão, recall, ficha completa, FIPE, seguro e custo em 5 anos. Pagamento único no Pix, resultado na hora. Consulta grátis sem cadastro.',
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
