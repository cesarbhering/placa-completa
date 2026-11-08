// Contact form behind the floating button (Cesar 07/11/2026: the company
// WhatsApp number is offline for a few weeks, so the button opens a form and
// the message goes to Cesar by e-mail through Resend). Nothing is stored: the
// e-mail is the record. Never log the e-mail or phone.

export const DESTINO_CONTATO = 'cesar.bhering@placacompleta.com.br'

export interface MensagemContato {
  email: string
  telefone: string
  mensagem: string | null
}

const limpo = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Validates and sanitizes the form. Returns the data or the first error, already as a sentence for the screen. */
export function validarContato(b: any): { ok: true; dados: MensagemContato } | { ok: false; erro: string; campo: string } {
  const email = limpo(b?.email, 160).toLowerCase()
  if (!EMAIL_RE.test(email)) return { ok: false, erro: 'Informe um e-mail válido.', campo: 'email' }
  const digitos = String(b?.telefone ?? '').replace(/\D/g, '')
  if (digitos.length < 10 || digitos.length > 13) return { ok: false, erro: 'Informe um telefone com DDD.', campo: 'telefone' }
  // Message keeps line breaks (people write paragraphs); only control chars go.
  const mensagem = String(b?.mensagem ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, 2000) || null
  return { ok: true, dados: { email, telefone: digitos, mensagem } }
}

/** Page category only (the path can carry a plate or a report token). */
export function assuntoContato(d: Pick<MensagemContato, 'email'>, pagina: string): string {
  return `Contato pelo site (${pagina}): ${d.email}`
}

export function textoContato(d: MensagemContato, pagina: string): string {
  return [
    'Mensagem pelo botão de contato do site.',
    '',
    `E-mail: ${d.email}`,
    `Telefone: ${d.telefone}`,
    `Página: ${pagina}`,
    '',
    d.mensagem ? `Mensagem:\n${d.mensagem}` : 'Sem mensagem escrita.',
    '',
    'Responder a este e-mail vai direto para a pessoa.',
  ].join('\n')
}
