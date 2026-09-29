import crypto from 'node:crypto'
import { describe, it, expect } from 'vitest'
import { verificarAssinaturaStripe } from './stripe'

// verificarAssinaturaStripe e a unica parte do cartao onde errar deixa alguem
// forjar um "pagamento confirmado". Testa o algoritmo do Stripe: header
// "t=<ts>,v1=<hmac>", signedPayload = `${t}.${raw}`, HMAC-SHA256 com o whsec.
const WHSEC = 'whsec_teste_1234567890'

function assinar(raw: string, secret: string, ts: number): string {
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex')
  return `t=${ts},v1=${sig}`
}

describe('verificarAssinaturaStripe', () => {
  const raw = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' })
  const agora = () => Math.floor(Date.now() / 1000)

  it('aceita uma assinatura valida e recente', () => {
    const header = assinar(raw, WHSEC, agora())
    expect(verificarAssinaturaStripe(raw, header, WHSEC)).toBe(true)
  })

  it('recusa corpo adulterado (um byte muda o HMAC)', () => {
    const header = assinar(raw, WHSEC, agora())
    const adulterado = raw.replace('evt_1', 'evt_2')
    expect(verificarAssinaturaStripe(adulterado, header, WHSEC)).toBe(false)
  })

  it('recusa assinatura feita com outro segredo', () => {
    const header = assinar(raw, 'whsec_outro_segredo', agora())
    expect(verificarAssinaturaStripe(raw, header, WHSEC)).toBe(false)
  })

  it('recusa timestamp velho (replay alem da tolerancia)', () => {
    const header = assinar(raw, WHSEC, agora() - 3600) // 1h atras
    expect(verificarAssinaturaStripe(raw, header, WHSEC)).toBe(false)
  })

  it('aceita quando ha varios v1 e um deles confere (rotacao de chave)', () => {
    const ts = agora()
    const bom = crypto.createHmac('sha256', WHSEC).update(`${ts}.${raw}`).digest('hex')
    const header = `t=${ts},v1=deadbeef,v1=${bom}`
    expect(verificarAssinaturaStripe(raw, header, WHSEC)).toBe(true)
  })

  it('recusa header ausente, vazio ou sem v1', () => {
    expect(verificarAssinaturaStripe(raw, null, WHSEC)).toBe(false)
    expect(verificarAssinaturaStripe(raw, '', WHSEC)).toBe(false)
    expect(verificarAssinaturaStripe(raw, `t=${agora()}`, WHSEC)).toBe(false)
  })

  it('recusa sem segredo ou sem corpo', () => {
    const header = assinar(raw, WHSEC, agora())
    expect(verificarAssinaturaStripe(raw, header, '')).toBe(false)
    expect(verificarAssinaturaStripe('', header, WHSEC)).toBe(false)
  })
})
