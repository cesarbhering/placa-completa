import { validarContato, assuntoContato, textoContato, DESTINO_CONTATO } from '../../../shared/contato-form'

// Floating contact button form (components/WhatsappFlutuante.vue). Sends the
// message to Cesar through Resend from contato@, reply_to = the person. No
// table, no automatic reply to the person. Anti-abuse: rate limit
// (server/middleware/rate-limit.ts) + honeypot "site" (a bot that fills it
// gets the same ok and nothing is sent).
const REMETENTE = 'PlacaCompleta <contato@placacompleta.com.br>'
const PAGINAS = new Set(['home', 'resultado', 'relatorio', 'blog', 'conteudo'])

export default defineEventHandler(async (event) => {
  const body: any = await readBody(event).catch(() => null)
  if (!body || typeof body !== 'object') throw createError({ statusCode: 400, message: 'Pedido inválido.' })
  if (String(body.site || '').trim()) return { ok: true }

  const v = validarContato(body)
  if (!v.ok) throw createError({ statusCode: 400, message: v.erro, data: { campo: v.campo } })

  const pagina = PAGINAS.has(String(body.pagina)) ? String(body.pagina) : 'conteudo'
  const config: any = useRuntimeConfig()
  if (!config.resendApiKey) {
    console.warn('[contato] sem chave do Resend')
    throw createError({ statusCode: 503, message: 'Não conseguimos enviar agora. Escreva para contato@placacompleta.com.br.' })
  }
  try {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: { from: REMETENTE, to: [DESTINO_CONTATO], reply_to: v.dados.email, subject: assuntoContato(v.dados, pagina), text: textoContato(v.dados, pagina) },
      timeout: 10000,
    })
  } catch (e: any) {
    console.warn('[contato] envio falhou:', e?.statusCode || e?.message || 'erro')
    throw createError({ statusCode: 502, message: 'Não conseguimos enviar agora. Tente de novo em instantes.' })
  }
  return { ok: true }
})
