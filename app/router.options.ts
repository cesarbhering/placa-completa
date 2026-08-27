import type { RouterConfig } from '@nuxt/schema'

// /placa/ABC1D23 renderiza a MESMA pagina da home.
//
// Foi feito com `alias` no definePageMeta antes, mas o Vue Router avisa a cada
// navegacao que um alias com parametro precisa dos mesmos parametros do
// registro original — e "/" nao tem nenhum. Registrar a rota aqui diz a mesma
// coisa sem o aviso.
//
// /variante-moto e /variante-caminhao: mesma pagina tambem, destino do
// rewrite por Host (ver server/middleware/00.host-theme-rewrite.ts +
// nuxt.config.ts). useSiteVariant() forca a variante certa quando a rota
// ATIVA e uma dessas — sem precisar tocar em pages/index.vue.
export default <RouterConfig>{
  routes: (rotas) => {
    const home = rotas.find((r) => r.path === '/')
    if (!home) return rotas
    return [
      ...rotas,
      { ...home, path: '/placa/:placa', name: 'placa-consultada' },
      { ...home, path: '/variante-moto', name: 'variante-moto' },
      { ...home, path: '/variante-caminhao', name: 'variante-caminhao' },
    ]
  },
}
