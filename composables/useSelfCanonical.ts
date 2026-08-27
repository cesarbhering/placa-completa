// Override pontual do canonical padrao. O site.url (nuxt-site-config) fica
// SEMPRE placacompleta.com.br de proposito: toda pagina de funil (home,
// consulta, checkout, premium) herda esse canonical automaticamente nos 3
// dominios (olhonamoto/olhonocaminhao/placacompleta), sem precisar de
// nenhum codigo — e o que evita conteudo duplicado indexado.
//
// Uso direto (raro): chamar dentro do <script setup> de uma pagina especifica
// que precisa forcar self-canonical fora da regra generica abaixo. Na
// pratica, use useDomainCanonical() — ela ja decide quando chamar isto.
export function useSelfCanonical(path?: string) {
  const requestUrl = useRequestURL()
  const route = useRoute()
  const href = `${requestUrl.origin}${path ?? route.path}`
  useHead({
    link: [{ rel: 'canonical', href }],
  })
}

// Prefixos de rota que sao CONTEUDO PROPRIO do olhonamoto (o @seo vai criar
// essas paginas em PRs separados) — devem ranquear por conta propria, entao
// ficam self-canonical em vez do default cross-domain pro placacompleta.
// Alinhado com o @seo em 27/ago/2026; se o padrao de rota mudar antes de
// publicar, o @seo avisa e este array atualiza junto.
const AUTO_SELF_CANONICAL_MOTO_PREFIXES = [
  '/tabela-fipe-moto',
  '/consulta-placa-moto',
  '/blog',
]

/**
 * Regra global de canonical por dominio+rota. Chamar UMA VEZ em app.vue (nao
 * em cada pagina) — assim toda pagina nova de conteudo proprio de moto que o
 * @seo publicar sob um dos prefixos acima ja sai self-canonical
 * automaticamente, sem precisar lembrar de chamar nada por pagina.
 *
 * Regra:
 * - olhonocaminhao.com.br: SEMPRE canonical pro placacompleta (sem excecao —
 *   nao tem conteudo proprio ainda). Nao faz nada aqui, o default do
 *   site.url ja cobre.
 * - olhonamoto.com.br + path comeca com um dos prefixos: self-canonical.
 * - Qualquer outro caso (default, ou olhonamoto fora dos prefixos — home,
 *   consulta, checkout, premium): nao faz nada, usa o default (placacompleta).
 */
export function useDomainCanonical() {
  const variant = useSiteVariant()
  const requestUrl = useRequestURL()
  const route = useRoute()
  // useHead com funcao = reativo: reavalia a cada navegacao client-side (o
  // app.vue so monta uma vez, entao sem isto o canonical ficaria congelado
  // na primeira rota visitada).
  useHead(() => {
    if (variant !== 'moto') return {}
    const isConteudoProprio = AUTO_SELF_CANONICAL_MOTO_PREFIXES.some(
      (prefix) => route.path === prefix || route.path.startsWith(`${prefix}/`),
    )
    if (!isConteudoProprio) return {}
    return { link: [{ rel: 'canonical', href: `${requestUrl.origin}${route.path}` }] }
  })
}
