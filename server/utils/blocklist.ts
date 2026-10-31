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

// E-mails bloqueados vem do ambiente (NUXT_BLOCKLIST_EMAILS, separados por
// virgula), nunca do codigo: o repositorio e publico. Default vazio.
let emailsCache: { bruto: string; set: Set<string> } | null = null
function emailsBloqueados(): Set<string> {
  const bruto = String(process.env.NUXT_BLOCKLIST_EMAILS || '')
  if (emailsCache?.bruto !== bruto) {
    emailsCache = {
      bruto,
      set: new Set(bruto.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)),
    }
  }
  return emailsCache.set
}

/** true quando o IP ou o e-mail esta na blocklist. E-mail entra normalizado. */
export function estaBloqueado(ip?: string | null, email?: string | null): boolean {
  const ipLimpo = String(ip || '').trim()
  const emailLimpo = String(email || '').trim().toLowerCase()
  if (ipLimpo && IP_BLOQUEADOS.has(ipLimpo)) return true
  if (emailLimpo && emailsBloqueados().has(emailLimpo)) return true
  return false
}
