import { createHmac, timingSafeEqual } from 'node:crypto'
import { aplicarEstadoNfse } from '../../../utils/nfse'

// Webhook of the NFS-e emitter. Authenticity is an HMAC-SHA256 of the exact raw
// body with the shared secret. Never logs the body or the customer e-mail.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig() as any
  if (config.nfse !== 'on' || !config.nfseWebhookSecret) {
    throw createError({ statusCode: 404, message: 'not found' })
  }

  const raw = String((await readRawBody(event)) || '')
  const header = String(getRequestHeader(event, 'x-nfse-assinatura') || '')
  const esperado = Buffer.from('sha256=' + createHmac('sha256', config.nfseWebhookSecret).update(raw).digest('hex'))
  const recebido = Buffer.from(header)
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) {
    setResponseStatus(event, 401)
    return { erro: 'assinatura_invalida' }
  }

  let payload: any
  try { payload = JSON.parse(raw) } catch { throw createError({ statusCode: 400, message: 'invalid json' }) }
  const nota = payload?.nota
  if (!nota || typeof nota.referencia !== 'string') throw createError({ statusCode: 400, message: 'invalid payload' })

  const supabase = usePremiumSupabase() as any
  const { data: pedido } = await supabase.from('pedidos_premium')
    .select('id, token_entrega, placa, email, nfse_status, nfse_email_em, nfse_id')
    .eq('id', nota.referencia).maybeSingle()
  if (!pedido) {
    console.warn(`[nfse] webhook for unknown order ${String(nota.referencia).slice(0, 8)}`)
    return { ok: true }
  }

  try {
    await aplicarEstadoNfse(supabase, pedido, nota)
  } catch (e: any) {
    // Valid delivery: answer 200 anyway; the reconciliation job (Task 7) catches up.
    console.warn(`[nfse] webhook apply failed order=${String(pedido.id).slice(0, 8)}`, e?.name)
  }
  return { ok: true }
})
