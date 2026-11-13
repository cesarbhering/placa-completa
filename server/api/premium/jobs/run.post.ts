import { rodarLote, loteRodandoDesde } from '../../../utils/premium-jobs'
import { estaEncerrando, quantasEmVoo } from '../../../utils/tarefas-em-voo'
import { assertAdminSecret } from '../../../utils/admin-secret'

// Fila premium_jobs (Relatorio 2.0, item 7). Chamado pelo timer do host
// (pc-premium-jobs.timer, 1 min) com x-admin-secret. Contrato com o infra:
// 202 {reivindicados, ids, em_voo} e processa em background (em voo);
// 409 {rodando, desde} se ja ha lote neste container; 503 {encerrando} apos
// o SIGTERM (o container novo pega). Sem segredo ou errado: 404.
export default defineEventHandler(async (event) => {
  assertAdminSecret(event)

  if (estaEncerrando()) { setResponseStatus(event, 503); return { encerrando: true } }
  const desde = loteRodandoDesde()
  if (desde) { setResponseStatus(event, 409); return { rodando: true, desde: new Date(desde).toISOString() } }
  const body = await readBody(event).catch(() => ({}))
  const limite = Math.max(1, Math.min(5, Number(body?.limite) || 5))
  const ids = await rodarLote(usePremiumSupabase(), limite)
  setResponseStatus(event, 202)
  return { reivindicados: ids.length, ids, em_voo: quantasEmVoo() }
})
