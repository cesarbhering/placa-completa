// Homolog e staging nunca podem ser indexados.
//
// O problema real (achado com curl em homolog.placacompleta.com.br): o
// subdominio respondia "x-robots-tag: index, follow" e servia robots.txt
// permissivo, entao o Google era CONVIDADO a indexar uma copia inteira do site
// e competir com producao por conteudo duplicado. O muro de senha nao cobre
// isso: ele e um overlay client-side, invisivel pra crawler.
//
// Por que plugin com hook de resposta, e nao middleware: o @nuxtjs/robots
// escreve o X-Robots-Tag durante o render, DEPOIS de qualquer middleware, e
// sobrescreveria um header cru (o mesmo motivo ja documentado no routeRules do
// nuxt.config). No `beforeResponse` a gente fala por ultimo.
//
// Sobre a flag: `public.gated` e derivada em tempo de BUILD (nuxt.config le
// NUXT_PUBLIC_HOMOLOG/NUXT_PUBLIC_STAGING pra montar o runtime config). Se um
// container protegido subir de uma imagem construida sem essas envs, gated
// chega false e a protecao sumiria sem ninguem perceber. Por isso a checagem
// tambem olha o ambiente do processo: aqui, errar pra mais custa nada (uma
// pagina de teste fora do indice) e errar pra menos custa o site duplicado no
// Google. Em producao nenhuma das tres existe e este arquivo nao muda nada.
function ambienteProtegido(gated: unknown): boolean {
  return gated === true
    || process.env.NUXT_PUBLIC_GATED === 'true'
    || process.env.NUXT_PUBLIC_HOMOLOG === 'true'
    || process.env.NUXT_PUBLIC_STAGING === 'true'
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event, resposta) => {
    const config = useRuntimeConfig(event)
    if (!ambienteProtegido(config.public.gated)) return

    setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow, noarchive')

    // O crawler que so le o robots.txt tambem precisa ouvir "nao entre".
    if (getRequestURL(event).pathname === '/robots.txt') {
      setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
      resposta.body = 'User-agent: *\nDisallow: /\n'
    }
  })
})
