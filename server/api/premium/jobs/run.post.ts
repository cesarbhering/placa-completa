import crypto from 'node:crypto'
import { rodarLote, loteRodandoDesde } from '../../../utils/premium-jobs'
import { estaEncerrando, quantasEmVoo } from '../../../utils/tarefas-em-voo'

// Fila premium_jobs (Relatorio 2.0, item 7). Chamado pelo timer do host
// (pc-premium-jobs.timer, 1 min) com x-admin-secret. Contrato com o infra:
// 202 {reivindicados, ids, em_voo} e processa em background (em voo);
// 409 {rodando, desde} se ja ha lote neste container; 503 {encerrando} apos
// o SIGTERM (o container novo pega). Sem segredo ou errado: 404.
export default defineEventHandler(async (event) => {
  const segredo = String(useRuntimeConfig().adminSecret || '')
  if (!segredo) throw createError({ statusCode: 404, message: 'Not Found' })
  const enviado = String(getRequestHeader(event, 'x-admin-secret') || '')
  const ok = enviado.length === segredo.length && crypto.timingSafeEqual(Buffer.from(enviado), Buffer.from(segredo))
  if (!ok) throw createError({ statusCode: 404, message: 'Not Found' })

  if (estaEncerrando()) { setResponseStatus(event, 503); return { encerrando: true } }
  const desde = loteRodandoDesde()
  if (desde) { setResponseStatus(event, 409); return { rodando: true, desde: new Date(desde).toISOString() } }
  const body = await readBody(event).catch(() => ({}))
  const limite = Math.max(1, Math.min(5, Number(body?.limite) || 5))
  const ids = await rodarLote(usePremiumSupabase(), limite)
  setResponseStatus(event, 202)
  return { reivindicados: ids.length, ids, em_voo: quantasEmVoo() }
})
