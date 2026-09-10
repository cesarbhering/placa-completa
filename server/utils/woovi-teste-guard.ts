// A pagina de teste da Woovi so existe em UM lugar: homolog, com o provedor
// woovi ligado. Em producao ela nao pode existir de jeito nenhum, porque cria
// cobranca de verdade e expoe resposta crua do adquirente.
//
// A regra fica aqui, e nao espalhada em cada arquivo, pra pagina e endpoints
// nunca discordarem sobre quem pode ver o que.
export function testeWooviLiberado(): boolean {
  const c = useRuntimeConfig()
  const ehHomolog = !!c.public?.homolog
  const provedorWoovi = String(c.pixProvider || '').toLowerCase() === 'woovi'
  return ehHomolog && provedorWoovi
}

/** Em vez de 403: quem nao pode ver nem descobre que a rota existe. */
export function exigirTesteWooviLiberado() {
  if (!testeWooviLiberado()) {
    throw createError({ statusCode: 404, statusMessage: 'Página não encontrada' })
  }
}
