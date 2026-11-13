import { reconciliarNfse } from '../../../utils/nfse'
import { assertAdminSecret } from '../../../utils/admin-secret'

// NFS-e reconciliation. Called by the host timer (pc-nfse-reconciliar, every
// 10 min) with x-admin-secret. 202 with the counters; missing/wrong secret or
// the feature flag off: 404.
export default defineEventHandler(async (event) => {
  assertAdminSecret(event)
  if ((useRuntimeConfig() as any).nfse !== 'on') throw createError({ statusCode: 404, message: 'Not Found' })

  const r = await reconciliarNfse(usePremiumSupabase())
  setResponseStatus(event, 202)
  return r
})
