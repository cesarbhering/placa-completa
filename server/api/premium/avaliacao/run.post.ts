import crypto from 'node:crypto'
import { rodarAvaliacaoGoogle } from '../../../utils/avaliacao-google'

// Acompanhamento de avaliacao no Google, 3 dias apos a entrega (05/nov/2026).
// Chamado pelo timer do host (pc-avaliacao-google.timer) com x-admin-secret.
// Body: { desde: ISO (obrigatorio, corte do deploy), excluir: string[]
// (lista de exclusao do host), dry_run?: boolean, limite?: number }.
// Sem segredo ou errado: 404. Fora de prod nao envia nada.
export default defineEventHandler(async (event) => {
  const segredo = String(useRuntimeConfig().adminSecret || '')
  if (!segredo) throw createError({ statusCode: 404, message: 'Not Found' })
  const enviado = String(getRequestHeader(event, 'x-admin-secret') || '')
  const ok = enviado.length === segredo.length && crypto.timingSafeEqual(Buffer.from(enviado), Buffer.from(segredo))
  if (!ok) throw createError({ statusCode: 404, message: 'Not Found' })

  const body = await readBody(event).catch(() => ({})) || {}
  const desde = Date.parse(String(body.desde || ''))
  if (!Number.isFinite(desde)) throw createError({ statusCode: 400, message: 'desde obrigatorio (ISO)' })
  const excluir = Array.isArray(body.excluir) ? body.excluir.map((e: any) => String(e)) : []
  return await rodarAvaliacaoGoogle(usePremiumSupabase(), {
    desde,
    excluir,
    dryRun: body.dry_run === true,
    limite: Number(body.limite) || undefined,
  })
})
