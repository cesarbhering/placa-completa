import { createHash } from 'node:crypto'
import { validarProposta, assuntoProposta, textoProposta, MSG_RECEBIDO } from '../../../shared/empresas'
import { DESTINO_AVISO_VENDA } from '../../utils/aviso-venda'

// Pedido de proposta de consultas em pacote (/para-empresas, Cesar 20/out/2026).
// Grava em leads_empresas e avisa o Cesar por e-mail (Resend, contato@). O
// lead NAO recebe e-mail automatico: so o "recebemos" na tela.
// Anti-abuso: rate limit (server/middleware/rate-limit.ts) + honeypot (campo
// "site" invisivel; bot que preenche recebe o mesmo "ok" e nada e gravado).
const REMETENTE = 'PlacaCompleta <contato@placacompleta.com.br>'

export default defineEventHandler(async (event) => {
  const body: any = await readBody(event).catch(() => null)
  if (!body || typeof body !== 'object') throw createError({ statusCode: 400, message: 'Pedido inválido.' })
  if (String(body.site || '').trim()) return { ok: true, mensagem: MSG_RECEBIDO }

  const v = validarProposta(body)
  if (!v.ok) throw createError({ statusCode: 400, message: v.erro, data: { campo: v.campo } })

  const config: any = useRuntimeConfig()
  const ip = getClientIp(event)
  const sal = String(config.suporteSecret || config.pagadorHashSecret || 'placacompleta')
  const origem = String(body.origem || '').replace(/\s+/g, ' ').trim().slice(0, 300) || null
  const linha = {
    ...v.dados,
    origem,
    ip_hash: ip ? createHash('sha256').update(`${sal}|${ip}`).digest('hex').slice(0, 32) : null,
    user_agent: String(getHeader(event, 'user-agent') || '').slice(0, 300) || null,
  }

  const { error } = await usePremiumSupabase().from('leads_empresas').insert(linha)
  if (error) {
    console.warn('[empresas] gravar falhou:', error.message)
    throw createError({ statusCode: 500, message: 'Não conseguimos enviar agora. Tente de novo em instantes.' })
  }

  // Aviso ao Cesar: falha aqui nao derruba o pedido (ja esta gravado).
  if (config.resendApiKey) {
    try {
      await $fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
        body: { from: REMETENTE, to: [DESTINO_AVISO_VENDA], reply_to: v.dados.email, subject: assuntoProposta(v.dados), text: textoProposta(v.dados, origem) },
        timeout: 10000,
      })
    } catch (e: any) {
      console.warn('[empresas] e-mail ao Cesar falhou (lead gravado):', e?.message || e)
    }
  }
  return { ok: true, mensagem: MSG_RECEBIDO }
})
