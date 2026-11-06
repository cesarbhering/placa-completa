import { DESTINO_ALERTA_FEEDBACK, registrarComentario } from '../../utils/feedback'
import { comTagAmbiente } from '../../utils/ambiente-alerta'

// Comentario de quem deu nota 1 a 3. Nota 1 ou 2 avisa o Lead por e-mail.
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({})) || {}
  const token = String(body.token || '').trim()
  const config = useRuntimeConfig()
  const r = await registrarComentario(usePremiumSupabase(), token, body.comentario, async ({ subject, text }) => {
    if (!config.resendApiKey) return
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: { from: 'PlacaCompleta <contato@placacompleta.com.br>', to: [DESTINO_ALERTA_FEEDBACK], subject: comTagAmbiente(subject, config), text },
      timeout: 10000,
    })
  })
  if (!r.ok && r.motivo === 'link') throw createError({ statusCode: 404, message: 'Link nao encontrado' })
  if (!r.ok) throw createError({ statusCode: 400, message: 'Escreva o comentário.' })
  return { ok: true }
})
