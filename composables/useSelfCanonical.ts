// Override pontual do canonical padrao. O site.url (nuxt-site-config) fica
// SEMPRE placacompleta.com.br de proposito: toda pagina de funil (home,
// consulta, checkout, premium) herda esse canonical automaticamente nos 3
// dominios (olhonamoto/olhonocaminhao/placacompleta), sem precisar de
// nenhum codigo — e o que evita conteudo duplicado indexado.
//
// Paginas de CONTEUDO PROPRIO por dominio (ex.: o cluster "tabela fipe moto"
// que o @seo vai criar em olhonamoto.com.br) sao a EXCECAO: elas devem
// ranquear por conta propria, entao chamam isto pra apontar o canonical de
// volta pro proprio dominio em vez do default cross-domain.
//
// Uso: chamar dentro de <script setup> da pagina de conteudo proprio,
// SEM passar nada (usa a URL da propria requisicao) ou passando um path
// explicito se a pagina precisar de um canonical diferente do path atual.
export function useSelfCanonical(path?: string) {
  const requestUrl = useRequestURL()
  const route = useRoute()
  const href = `${requestUrl.origin}${path ?? route.path}`
  useHead({
    link: [{ rel: 'canonical', href }],
  })
}
