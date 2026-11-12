import crypto from 'node:crypto'
import { reconciliarNfse } from '../../../utils/nfse'

// NFS-e reconciliation. Called by the host timer (pc-nfse-reconciliar, every
// 10 min) with x-admin-secret. 202 with the counters; missing/wrong secret or
// the feature flag off: 404.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig() as any
  const segredo = String(config.adminSecret || '')
  if (!segredo) throw createError({ statusCode: 404, message: 'Not Found' })
  const enviado = String(getRequestHeader(event, 'x-admin-secret') || '')
  const ok = enviado.length === segredo.length && crypto.timingSafeEqual(Buffer.from(enviado), Buffer.from(segredo))
  if (!ok || config.nfse !== 'on') throw createError({ statusCode: 404, message: 'Not Found' })

  const r = await reconciliarNfse(usePremiumSupabase())
  setResponseStatus(event, 202)
  return r
})
