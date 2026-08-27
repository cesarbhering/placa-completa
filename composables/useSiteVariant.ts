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

// A home ("/") e PRERENDERIZADA (routeRules `{ "/": { prerender: true } }`):
// gerada UMA vez no build, sem Host de requisicao nenhum pra detectar —
// servir a mesma pagina estatica pra todo mundo era o bug (dominio tematico
// mostrando hero de carro). Fix: /variante-moto e /variante-caminhao sao a
// MESMA pagina (pages/index.vue, clonada em app/router.options.ts),
// prerenderizadas cada uma com sua variante FORCADA pelo path — o
// server/middleware/00.host-theme-rewrite.ts reescreve "/" pra uma dessas
// ANTES do Nitro resolver a rota, conforme o Host. No SSR desse rewrite,
// route.path e "/variante-moto" (o override abaixo pega). No client, a URL
// na barra continua "/" (o rewrite e so interno) — a hidratacao cai no
// fallback por Host mesmo, que da o MESMO resultado (o browser esta
// realmente em olhonamoto.com.br), entao nunca ha mismatch de hidratacao.
const PATH_VARIANT_OVERRIDE: Record<string, SiteVariant> = {
  '/variante-moto': 'moto',
  '/variante-caminhao': 'caminhao',
}

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
    // Honda CB600F Hornet, fundo transparente (recorte do Cesar).
    heroImage: '/hero-moto.webp',
    heroImageAlt: 'Honda CB600F Hornet vista de lado',
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
    // Volvo FH, fundo transparente (recorte do Cesar).
    heroImage: '/hero-caminhao.webp',
    heroImageAlt: 'Caminhão Volvo FH visto de lado',
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
  const route = useRoute()
  const porPath = route?.path ? PATH_VARIANT_OVERRIDE[route.path] : undefined
  if (porPath) return porPath
  const { hostname } = useRequestURL()
  return HOST_VARIANTS[hostname] || 'default'
}

/** Conteudo do hero/meta pro variant atual. */
export function useSiteVariantContent(): SiteVariantContent {
  return CONTENT[useSiteVariant()]
}
