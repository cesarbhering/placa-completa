import type { RouterConfig } from '@nuxt/schema'

// /placa/ABC1D23 renderiza a MESMA pagina da home.
//
// Foi feito com `alias` no definePageMeta antes, mas o Vue Router avisa a cada
// navegacao que um alias com parametro precisa dos mesmos parametros do
// registro original — e "/" nao tem nenhum. Registrar a rota aqui diz a mesma
// coisa sem o aviso.
export default <RouterConfig>{
  routes: (rotas) => {
    const home = rotas.find((r) => r.path === '/')
    if (!home) return rotas
    return [
      ...rotas,
      { ...home, path: '/placa/:placa', name: 'placa-consultada' },
    ]
  },
}
