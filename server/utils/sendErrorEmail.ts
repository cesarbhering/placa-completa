import { Resend } from 'resend'

interface ErrorEmailData {
  endpoint: string
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

export async function sendErrorEmail(data: ErrorEmailData) {
  const config = useRuntimeConfig()

  // Don't send error emails in development
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 Error email (dev mode - not sent):', data)
    return
  }

  try {
    const resend = new Resend(config.resendApiKey)

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
    <div class="header">🚨 Erro na API - PlacaCompleta</div>
    <div class="content">
      <div class="field">
        <div class="label">⏰ Horário (Brasília):</div>
        <div class="value">${horaBrasilia(data.timestamp)}</div>
      </div>

      <div class="field">
        <div class="label">📍 Endpoint:</div>
        <div class="value"><span class="code">${data.endpoint}</span></div>
      </div>

      <div class="field">
        <div class="label">❌ Erro:</div>
        <div class="value">${data.errorMessage}</div>
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
        <div class="value"><pre>${JSON.stringify(sanitizeRequestBody(data.requestBody), null, 2)}</pre></div>
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
        <div class="value">${data.ip}</div>
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
      subject: `[Erro API] ${data.endpoint} - ${horaBrasilia(new Date())}`,
      html: htmlContent,
    })
  } catch (emailError) {
    // Log but don't throw - we don't want error emails to break the API
    console.error('Failed to send error email:', emailError)
  }
}

function sanitizeRequestBody(body: any): any {
  if (!body) return null

  const sanitized = { ...body }

  // Remove sensitive data
  if (sanitized.email) {
    const email = sanitized.email
    const [local, domain] = email.split('@')
    sanitized.email = `${local.substring(0, 2)}***@${domain}`
  }

  if (sanitized.image) {
    sanitized.image = `[BASE64_IMAGE_${sanitized.image.length}_bytes]`
  }

  return sanitized
}

