// Rewrite INTERNO da home por Host (theming por dominio). A home ("/") e
// prerenderizada — gerada uma vez no build, servida igual pra todo mundo —
// entao useSiteVariant() nunca via o Host de verdade na hora do prerender.
// Fix: /variante-moto e /variante-caminhao sao a mesma pagina prerenderizada
// com a variante certa cada uma (ver nuxt.config.ts + app/router.options.ts
// + composables/useSiteVariant.ts). Este middleware reescreve "/" pra uma
// dessas ANTES do Nitro resolver a rota/servir o HTML estatico, conforme o
// Host da requisicao — a URL na barra do navegador NUNCA muda, continua "/".
//
// 00. no nome do arquivo: Nitro carrega server/middleware/* em ordem
// alfabetica: isso PRECISA rodar antes de qualquer coisa que sirva a
// resposta (incluindo o handler de asset estatico do preset).
//
// xForwardedHost:true e obrigatorio aqui: o app roda atras de Traefik (proxy
// reverso na VPS), entao o Host da conexao TCP direta e interno — o Host
// real do dominio publico vem no header X-Forwarded-Host.
const HOST_REWRITE: Record<string, string> = {
  'olhonamoto.com.br': '/variante-moto',
  'www.olhonamoto.com.br': '/variante-moto',
  'olhonocaminhao.com.br': '/variante-caminhao',
  'www.olhonocaminhao.com.br': '/variante-caminhao',
}

export default defineEventHandler((event) => {
  const rawUrl = event.node.req.url || '/'
  const [pathname, search] = rawUrl.split('?')
  // So a home tem theming hoje — qualquer outra rota segue normal.
  if (pathname !== '/') return

  const host = getRequestHost(event, { xForwardedHost: true })
  const target = HOST_REWRITE[host]
  if (!target) return

  event.node.req.url = search ? `${target}?${search}` : target
})
