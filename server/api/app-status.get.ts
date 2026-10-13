import { estaEncerrando } from '../utils/tarefas-em-voo'

// Status leve pro app decidir se mostra o empurrao de atualizacao. A flag e
// server-side (runtime), entao liga/desliga por env sem rebuild. Publico e
// barato: so um booleano, sem dado sensivel.
//
// Tambem e o healthcheck do container (Dockerfile e Coolify): depois do
// SIGTERM responde 503 pra o Traefik tirar este container do balanceamento,
// enquanto ele termina as buscas em voo (server/plugins/aguardar-em-voo.ts).
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (estaEncerrando()) setResponseStatus(event, 503)
  return { forceUpdate: !!useRuntimeConfig().forceAppUpdate, ...(estaEncerrando() ? { encerrando: true } : {}) }
})
