import crypto from 'node:crypto'

// Confere o token OIDC que o Pub/Sub manda no push (Authorization: Bearer).
// Sem lib: JWT RS256 assinado pela Google, chaves publicas em JWK.
// Regras (doc do Pub/Sub, "authenticate push"): assinatura valida, iss da
// Google, aud igual a audiencia configurada na assinatura push, nao expirado
// e, se configurado, email da conta de servico da assinatura (verificado).

export const CERTS_GOOGLE = 'https://www.googleapis.com/oauth2/v3/certs'
const ISS = new Set(['accounts.google.com', 'https://accounts.google.com'])

export interface OpcoesOidc {
  audiencia: string
  /** E-mail da conta de servico da assinatura push. Vazio = nao confere. */
  email?: string
  agoraSeg?: number
  /** Busca as chaves publicas (JWKS). */
  chaves: () => Promise<any[]>
}

export type ResultadoOidc = { ok: true; claims: any } | { ok: false; motivo: string }

const b64json = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'))

export async function verificarOidc(bearer: string | null | undefined, o: OpcoesOidc): Promise<ResultadoOidc> {
  const tok = String(bearer || '').replace(/^Bearer\s+/i, '').trim()
  const partes = tok.split('.')
  if (partes.length !== 3) return { ok: false, motivo: 'sem token' }
  let header: any, claims: any
  try { header = b64json(partes[0]); claims = b64json(partes[1]) } catch { return { ok: false, motivo: 'token ilegivel' } }
  if (header?.alg !== 'RS256' || !header?.kid) return { ok: false, motivo: 'alg/kid' }
  const jwk = (await o.chaves()).find((k: any) => k?.kid === header.kid)
  if (!jwk) return { ok: false, motivo: 'kid desconhecido' }
  let valida = false
  try {
    const chave = crypto.createPublicKey({ key: jwk, format: 'jwk' })
    valida = crypto.createVerify('RSA-SHA256').update(`${partes[0]}.${partes[1]}`).verify(chave, Buffer.from(partes[2], 'base64url'))
  } catch { valida = false }
  if (!valida) return { ok: false, motivo: 'assinatura' }
  const agora = o.agoraSeg ?? Math.floor(Date.now() / 1000)
  if (!ISS.has(claims?.iss)) return { ok: false, motivo: 'iss' }
  const aud = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud]
  if (!o.audiencia || !aud.includes(o.audiencia)) return { ok: false, motivo: 'aud' }
  if (typeof claims?.exp !== 'number' || claims.exp + 60 < agora) return { ok: false, motivo: 'expirado' }
  if (typeof claims?.iat === 'number' && claims.iat - 300 > agora) return { ok: false, motivo: 'iat no futuro' }
  if (o.email && (claims?.email !== o.email || claims?.email_verified !== true)) return { ok: false, motivo: 'email' }
  return { ok: true, claims }
}

let cacheChaves: { chaves: any[]; ate: number } | null = null

/** JWKS da Google com cache de 1 h (a Google gira as chaves em dias). */
export async function chavesGoogle(): Promise<any[]> {
  if (cacheChaves && cacheChaves.ate > Date.now()) return cacheChaves.chaves
  const r: any = await $fetch(CERTS_GOOGLE, { timeout: 5000 })
  const chaves = Array.isArray(r?.keys) ? r.keys : []
  cacheChaves = { chaves, ate: Date.now() + 3600_000 }
  return chaves
}

/** So pra teste. */
export function _limparCacheChaves() { cacheChaves = null }
