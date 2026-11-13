import { depsReais } from '../../utils/suporte/servidor'
import { rodarFilaN1 } from '../../utils/suporte/fluxo'
import { assertAdminSecret } from '../../utils/admin-secret'

// POST /api/suporte/fila (x-admin-secret): roda a fila N1 na hora (repassa ao
// cliente as respostas gravadas em suporte_tarefas). O plugin tambem roda a
// cada minuto; isto e so pra nao esperar.
// Operator-only, like the other x-admin-secret routes: 404 without the secret.
export default defineEventHandler(async (event) => {
  assertAdminSecret(event)
  const config = useRuntimeConfig()
  const deps = depsReais(config, usePremiumSupabase())
  if (!deps) throw createError({ statusCode: 503, message: 'suporte desligado neste ambiente' })
  return rodarFilaN1(deps)
})
