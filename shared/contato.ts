// E-mail de contato e como ele vai pro HTML.
//
// O Email Obfuscation da Cloudflare (ligado) reescreve e-mail e mailto do
// HTML pra /cdn-cgi/l/email-protection#..., que da 404 pra crawler. O trecho
// entre <!--email_off--> e <!--/email_off--> a Cloudflare deixa como esta.
// Vue tira comentario do template, por isso o HTML vai por v-html.

export const EMAIL_CONTATO = 'contato@placacompleta.com.br'

export const emailContatoHtml =
  `<!--email_off--><a href="mailto:${EMAIL_CONTATO}">${EMAIL_CONTATO}</a><!--/email_off-->`
