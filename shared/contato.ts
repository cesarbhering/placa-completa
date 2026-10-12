// E-mail de contato e como ele vai pro HTML.
//
// O Email Obfuscation da Cloudflare (ligado) reescreve e-mail e mailto do
// HTML pra /cdn-cgi/l/email-protection#..., que da 404 pra crawler. O trecho
// entre <!--email_off--> e <!--/email_off--> a Cloudflare deixa como esta.
// Vue tira comentario do template, por isso o HTML vai por v-html.

export const EMAIL_CONTATO = 'contato@placacompleta.com.br'

export const emailContatoHtml =
  `<!--email_off--><a href="mailto:${EMAIL_CONTATO}">${EMAIL_CONTATO}</a><!--/email_off-->`

// WhatsApp da empresa (pareado em 10/out/2026). Numero SO aqui: o botao
// flutuante e qualquer outro link montam a URL por linkWhatsapp().
export const WHATSAPP_NUMERO = '17205887194'
export const WHATSAPP_MENSAGEM = 'Olá! Vim pelo site da PlacaCompleta e tenho uma dúvida.'

export function linkWhatsapp(mensagem: string = WHATSAPP_MENSAGEM): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`
}

/**
 * Tipo da pagina pro evento de analytics, sem PII: a rota pode ter placa
 * (/placa/ABC1D23) ou token de relatorio (/premium/xxxx), entao vai so a categoria.
 */
export function tipoDePagina(path: string): string {
  const p = String(path || '/')
  if (p === '/') return 'home'
  if (p.startsWith('/premium')) return 'relatorio'
  if (p.startsWith('/placa/')) return 'resultado'
  if (p.startsWith('/blog')) return 'blog'
  return 'conteudo'
}

/** Botao flutuante aparece? Fora das telas internas e sem nada pedindo pra esconder. */
export function whatsappVisivel(path: string, ocultos: Record<string, boolean>): boolean {
  const p = String(path || '/')
  if (p.startsWith('/admin') || p.startsWith('/dash')) return false
  return !Object.values(ocultos || {}).some(Boolean)
}
