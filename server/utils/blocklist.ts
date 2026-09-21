// Blocklist de contencao pontual: IPs e e-mails de abuso JA CONFIRMADO.
//
// Vive aqui, e nao dentro de um endpoint, porque as duas rotas que gastam
// credito da fonte paga precisam da MESMA lista. Enquanto ela morava so no
// /api/consulta, quem estava bloqueado ali continuava consultando pelo
// /api/premium/preview, que bate na mesma API e no mesmo bolso.
//
// Escala pra abuso especifico; o teto por IP (ip-wdapi-limit) e a contencao
// geral, que vale pra todo mundo.

const IP_BLOQUEADOS = new Set<string>([
  '177.44.134.147',
  // Enumeracao de 386 placas pelo app, com a imagem antiga que ainda nao
  // tinha o teto por IP (05/set).
  '177.121.153.13',
  '177.33.86.180',
])

const EMAIL_BLOQUEADOS = new Set<string>([
  'bloqueado@example.com',
  'bloqueado@example.com',
  // 83 consultas em 5 dias batendo o limite todo dia (17 a 21/set), e-mail
  // inexistente (Yahoo devolveu "mailbox not found"): sem como contatar,
  // Cesar mandou bloquear (21/set).
  'bloqueado@example.com',
])

/** true quando o IP ou o e-mail esta na blocklist. E-mail entra normalizado. */
export function estaBloqueado(ip?: string | null, email?: string | null): boolean {
  const ipLimpo = String(ip || '').trim()
  const emailLimpo = String(email || '').trim().toLowerCase()
  if (ipLimpo && IP_BLOQUEADOS.has(ipLimpo)) return true
  if (emailLimpo && EMAIL_BLOQUEADOS.has(emailLimpo)) return true
  return false
}
