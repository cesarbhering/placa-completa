import { Resend } from 'resend'
import { ambienteForaDeProd, TAG_HOMOLOG } from './ambiente-alerta'
import { escapeHtml } from './htmlEscape'

interface ErrorEmailData {
  endpoint: string
  /**
   * TEXTO puro, com `\n` para quebrar linha. Nunca HTML: quem chama monta esta
   * mensagem com dado de cliente (e-mail, origem, placa, id de pedido) e com
   * resposta de provedor, entao o escape e a quebra de linha acontecem aqui,
   * num lugar so.
   */
  errorMessage: string
  errorStack?: string
  requestBody?: any
  userAgent?: string
  ip?: string
  /**
   * Opcional de proposito: quase todo chamador do premium nunca mandou este
   * campo, e o `horaBrasilia(undefined)` estourava TypeError ANTES do envio.
   * Resultado: nenhum e-mail de erro do premium saiu, e um pedido estornado so
   * apareceu por outro caminho. Sem timestamp, a hora e agora.
   */
  timestamp?: string
  /**
   * Destinatarios extras, alem da caixa de erros do time. Serve pro que o
   * Cesar quer ver no proprio e-mail sem virar caixa de log: hoje, todo
   * estorno automatico.
   */
  paraTambem?: string[]
}

// Sempre em BRT e com o fuso escrito: o container roda em UTC e a hora "pt-BR"
// sem fuso era lida como horario de Brasilia, 3h adiantada.
export function horaBrasilia(d: string | Date | null | undefined = new Date()): string {
  const dt = d === null || d === undefined ? new Date() : typeof d === 'string' ? new Date(d) : d
  if (!(dt instanceof Date) || isNaN(dt.getTime())) return String(d)
  return dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false }) + ' BRT'
}

/** Texto -> HTML: escapado, com as quebras de linha preservadas. */
function textoParaHtml(v: unknown): string {
  return escapeHtml(v).replace(/\r\n|\r|\n/g, '<br>')
}

/** A mensagem e texto; se um chamador mandar outra coisa, o alerta sai assim mesmo. */
function textoDaMensagem(m: unknown): string {
  if (typeof m === 'string') return m
  if (m === null || m === undefined) return ''
  try { return JSON.stringify(m) ?? String(m) } catch { return String(m) }
}

/** Assunto em uma linha so e com tamanho limitado. */
function umaLinha(v: unknown, max = 200): string {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max)
}

/** JSON do corpo para o alerta. Corpo que nao serializa nao pode derrubar o aviso. */
function jsonDoCorpo(body: unknown): string {
  try {
    return JSON.stringify(sanitizeRequestBody(body), null, 2) ?? ''
  } catch {
    return '[corpo nao serializavel]'
  }
}

export async function sendErrorEmail(data: ErrorEmailData) {
  const config = useRuntimeConfig()

  // Don't send error emails in development
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 Error email (dev mode - not sent):', data)
    return
  }

  try {
    const resend = new Resend(config.resendApiKey)
    // Homolog/staging: [HOMOLOG] no assunto e na 1a linha do corpo.
    const foraDeProd = ambienteForaDeProd(config)
    const tag = foraDeProd ? `${TAG_HOMOLOG} ` : ''

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: monospace; background: #f5f5f5; padding: 20px; }
    .container { background: white; border: 2px solid #cc0000; max-width: 800px; margin: 0 auto; }
    .header { background: #cc0000; color: white; padding: 12px 16px; font-weight: bold; }
    .content { padding: 16px; }
    .field { margin-bottom: 16px; }
    .label { font-weight: bold; color: #333; margin-bottom: 4px; }
    .value { background: #f9f9f9; border: 1px solid #ddd; padding: 8px; word-wrap: break-word; }
    .error-stack { background: #fff3cd; border: 1px solid #ffc107; padding: 12px; white-space: pre-wrap; font-size: 12px; }
    .code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">${tag}🚨 Erro na API - PlacaCompleta${foraDeProd ? ' (teste, não é cliente real)' : ''}</div>
    <div class="content">
      <div class="field">
        <div class="label">⏰ Horário (Brasília):</div>
        <div class="value">${escapeHtml(horaBrasilia(data.timestamp))}</div>
      </div>

      <div class="field">
        <div class="label">📍 Endpoint:</div>
        <div class="value"><span class="code">${escapeHtml(data.endpoint)}</span></div>
      </div>

      <div class="field">
        <div class="label">❌ Erro:</div>
        <div class="value">${textoParaHtml(textoDaMensagem(data.errorMessage))}</div>
      </div>

      ${data.errorStack ? `
      <div class="field">
        <div class="label">📚 Stack Trace:</div>
        <div class="error-stack">${escapeHtml(data.errorStack)}</div>
      </div>
      ` : ''}

      ${data.requestBody ? `
      <div class="field">
        <div class="label">📦 Request Body:</div>
        <div class="value"><pre>${escapeHtml(jsonDoCorpo(data.requestBody))}</pre></div>
      </div>
      ` : ''}

      ${data.userAgent ? `
      <div class="field">
        <div class="label">🖥️ User Agent:</div>
        <div class="value">${escapeHtml(data.userAgent)}</div>
      </div>
      ` : ''}

      ${data.ip ? `
      <div class="field">
        <div class="label">🌐 IP Address:</div>
        <div class="value">${escapeHtml(data.ip)}</div>
      </div>
      ` : ''}
    </div>
  </div>
</body>
</html>
`

    await resend.emails.send({
      from: 'PlacaCompleta Errors <erros@placacompleta.com.br>',
      to: ['erros@placacompleta.com.br', ...(data.paraTambem || [])],
      subject: `${tag}[Erro API] ${umaLinha(data.endpoint)} - ${horaBrasilia(new Date())}`,
      html: htmlContent,
    })
  } catch (emailError) {
    // Log but don't throw - we don't want error emails to break the API
    console.error('Failed to send error email:', emailError)
  }
}

function sanitizeRequestBody(body: any): any {
  if (!body) return null
  if (typeof body !== 'object') return body

  const sanitized = { ...body }

  // Remove sensitive data. So mascara o que e texto: um campo com outro tipo
  // nao pode estourar aqui e levar o alerta junto.
  if (typeof sanitized.email === 'string' && sanitized.email) {
    const [local, domain] = sanitized.email.split('@')
    sanitized.email = `${local.substring(0, 2)}***@${domain}`
  }

  if (typeof sanitized.image === 'string' && sanitized.image) {
    sanitized.image = `[BASE64_IMAGE_${sanitized.image.length}_bytes]`
  }

  return sanitized
}

