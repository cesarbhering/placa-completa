import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import { verificarOidc } from './pubsub-oidc'

// O endpoint da RTDN registra compras no banco: so o Pub/Sub da nossa
// assinatura pode chamar. Cada caso aqui seria uma porta aberta.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }
const outra = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
const AGORA = 1_800_000_000
const AUD = 'https://placacompleta.com.br/api/premium/google-play/rtdn'
const EMAIL = 'rtdn-push@projeto.iam.gserviceaccount.com'

function jwt(claims: any, o: { kid?: string; chave?: crypto.KeyObject; alg?: string } = {}) {
  const enc = (x: any) => Buffer.from(JSON.stringify(x)).toString('base64url')
  const h = enc({ alg: o.alg ?? 'RS256', kid: o.kid ?? 'k1', typ: 'JWT' })
  const c = enc({ iss: 'https://accounts.google.com', aud: AUD, exp: AGORA + 3000, iat: AGORA - 10, email: EMAIL, email_verified: true, ...claims })
  const s = crypto.createSign('RSA-SHA256').update(`${h}.${c}`).sign(o.chave ?? privateKey).toString('base64url')
  return `Bearer ${h}.${c}.${s}`
}
const opts = (x: any = {}) => ({ audiencia: AUD, email: EMAIL, agoraSeg: AGORA, chaves: async () => [jwk], ...x })

describe('token OIDC do Pub/Sub', () => {
  it('token valido passa', async () => {
    expect((await verificarOidc(jwt({}), opts())).ok).toBe(true)
  })
  it('sem token, ilegivel ou assinatura de outra chave: recusa', async () => {
    expect(await verificarOidc(undefined, opts())).toMatchObject({ ok: false })
    expect(await verificarOidc('Bearer a.b.c', opts())).toMatchObject({ ok: false })
    expect(await verificarOidc(jwt({}, { chave: outra }), opts())).toMatchObject({ ok: false, motivo: 'assinatura' })
    expect(await verificarOidc(jwt({}, { kid: 'zz' }), opts())).toMatchObject({ ok: false, motivo: 'kid desconhecido' })
    expect(await verificarOidc(jwt({}, { alg: 'none' }), opts())).toMatchObject({ ok: false })
  })
  it('audiencia, emissor, validade e e-mail', async () => {
    expect(await verificarOidc(jwt({ aud: 'https://outro' }), opts())).toMatchObject({ motivo: 'aud' })
    expect(await verificarOidc(jwt({ iss: 'https://evil' }), opts())).toMatchObject({ motivo: 'iss' })
    expect(await verificarOidc(jwt({ exp: AGORA - 120 }), opts())).toMatchObject({ motivo: 'expirado' })
    expect(await verificarOidc(jwt({ email: 'outro@x.com' }), opts())).toMatchObject({ motivo: 'email' })
    expect(await verificarOidc(jwt({ email_verified: false }), opts())).toMatchObject({ motivo: 'email' })
    expect((await verificarOidc(jwt({ email: 'outro@x.com' }), opts({ email: '' }))).ok).toBe(true)
  })
  it('sem audiencia configurada, nada passa', async () => {
    expect(await verificarOidc(jwt({}), opts({ audiencia: '' }))).toMatchObject({ ok: false, motivo: 'aud' })
  })
})
