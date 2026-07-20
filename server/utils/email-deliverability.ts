/**
 * Verificacao de deliverability de email SEM porta 25 (etapa 1):
 *  1. Typo de dominio comum (gmial.com -> gmail.com) com sugestao de correcao
 *  2. Dominio descartavel (temp-mail e afins, blocklist de ~120k dominios)
 *  3. MX lookup via DNS (o dominio recebe email?)
 *
 * Politica fail-open: erro de DNS (timeout, SERVFAIL) NAO bloqueia o usuario.
 * Etapa 2 (handshake SMTP via porta 25 / API externa) fica pra depois.
 */
import { resolveMx } from 'node:dns/promises'
import disposableDomains from 'disposable-email-domains'

export interface DeliverabilityResult {
  ok: boolean
  reason?: 'typo' | 'disposable' | 'no_mx'
  /** Email corrigido sugerido (só para reason=typo). */
  suggestion?: string
}

// Typos frequentes dos provedores dominantes no Brasil. A chave é o dominio
// errado, o valor é a correcao. Mantido curado e pequeno: o MX check pega o
// resto (dominio-typo raramente tem MX); este mapa existe pra gerar SUGESTAO.
const DOMAIN_TYPOS: Record<string, string> = {
  // gmail
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmails.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmail.com.br': 'gmail.com',
  'gemail.com': 'gmail.com',
  'gmeil.com': 'gmail.com',
  // hotmail
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'hotamil.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hormail.com': 'hotmail.com',
  // outlook
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.con': 'outlook.com',
  'oultook.com': 'outlook.com',
  // yahoo
  'yaho.com': 'yahoo.com',
  'yahho.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com.br',
  'yahool.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  // icloud
  'iclould.com': 'icloud.com',
  'icloud.co': 'icloud.com',
  'iclou.com': 'icloud.com',
  // uol / bol / terra
  'uol.com': 'uol.com.br',
  'bol.com': 'bol.com.br',
  'terra.com': 'terra.com.br',
}

const disposableSet = new Set<string>(disposableDomains as string[])

// Cache de MX em memoria: dominio -> { ok, expiresAt }.
// Positivo dura 12h (gmail.com nao muda), negativo 10min (typo digitado
// agora pode ser dominio novo ou glitch de DNS).
const mxCache = new Map<string, { ok: boolean; expiresAt: number }>()
const MX_TTL_OK = 12 * 60 * 60 * 1000
const MX_TTL_FAIL = 10 * 60 * 1000
const MX_CACHE_MAX = 5000

async function domainHasMx(domain: string): Promise<boolean | null> {
  const cached = mxCache.get(domain)
  if (cached && cached.expiresAt > Date.now()) return cached.ok

  try {
    const records = await resolveMx(domain)
    const ok = records.length > 0
    if (mxCache.size >= MX_CACHE_MAX) mxCache.clear()
    mxCache.set(domain, { ok, expiresAt: Date.now() + (ok ? MX_TTL_OK : MX_TTL_FAIL) })
    return ok
  } catch (err: any) {
    // ENOTFOUND/ENODATA = dominio sem MX -> negativo confiavel.
    // Timeout/SERVFAIL/etc = inconclusivo -> fail-open (null).
    if (err?.code === 'ENOTFOUND' || err?.code === 'ENODATA') {
      if (mxCache.size >= MX_CACHE_MAX) mxCache.clear()
      mxCache.set(domain, { ok: false, expiresAt: Date.now() + MX_TTL_FAIL })
      return false
    }
    return null
  }
}

export async function checkEmailDeliverability(email: string): Promise<DeliverabilityResult> {
  const at = email.lastIndexOf('@')
  if (at < 0) return { ok: false, reason: 'no_mx' }
  const local = email.slice(0, at)
  const domain = email.slice(at + 1).toLowerCase()

  // 1. Typo conhecido -> sugestao de correcao
  const corrected = DOMAIN_TYPOS[domain]
  if (corrected) {
    return { ok: false, reason: 'typo', suggestion: `${local}@${corrected}` }
  }

  // 2. Dominio descartavel
  if (disposableSet.has(domain)) {
    return { ok: false, reason: 'disposable' }
  }

  // 3. MX lookup (fail-open em erro de DNS)
  const hasMx = await domainHasMx(domain)
  if (hasMx === false) {
    return { ok: false, reason: 'no_mx' }
  }

  return { ok: true }
}
