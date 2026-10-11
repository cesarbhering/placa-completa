import { depsReais } from '../../utils/suporte/servidor'
import { rodarFilaN1 } from '../../utils/suporte/fluxo'

// POST /api/suporte/fila (x-admin-secret): roda a fila N1 na hora (repassa ao
// cliente as respostas gravadas em suporte_tarefas). O plugin tambem roda a
// cada minuto; isto e so pra nao esperar.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!config.adminSecret || getHeader(event, 'x-admin-secret') !== config.adminSecret) throw createError({ statusCode: 401 })
  const deps = depsReais(config, usePremiumSupabase())
  if (!deps) throw createError({ statusCode: 503, message: 'suporte desligado neste ambiente' })
  return rodarFilaN1(deps)
})
