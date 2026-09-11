import { describe, it, expect, vi } from 'vitest'
import crypto from 'node:crypto'
import { statusNormalizado, verificarAssinatura, qrComoDataUri } from './woovi'

// A parte do adaptador que da pra testar sem rede: traducao de status,
// assinatura do webhook e o QR gerado do copia e cola.
describe('status da Woovi traduzido pro nosso vocabulario', () => {
  it('COMPLETED e pagamento confirmado', () => {
    expect(statusNormalizado('COMPLETED')).toBe('PAID')
    expect(statusNormalizado('completed')).toBe('PAID')
  })

  it('ACTIVE ainda nao pagou', () => {
    expect(statusNormalizado('ACTIVE')).toBe('PENDING')
  })

  it('EXPIRED e o fim da cobranca', () => {
    expect(statusNormalizado('EXPIRED')).toBe('EXPIRED')
  })

  it('status desconhecido nao vira "pago" por descuido', () => {
    // O default TEM que ser pendente: um status novo virando "pago" liberaria
    // relatorio sem dinheiro entrar.
    expect(statusNormalizado('QUALQUER_COISA_NOVA')).toBe('PENDING')
    expect(statusNormalizado(null)).toBe('PENDING')
    expect(statusNormalizado(undefined)).toBe('PENDING')
  })
})

describe('assinatura do webhook (RSA-SHA256, chave publica da Woovi)', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  const assinar = (corpo: string, chave = privateKey) =>
    crypto.sign('sha256', Buffer.from(corpo), chave).toString('base64')

  const corpo = JSON.stringify({ event: 'OPENPIX:CHARGE_COMPLETED', charge: { correlationID: 'ped-1' } })

  it('aceita corpo assinado pela chave certa', () => {
    expect(verificarAssinatura(corpo, assinar(corpo), [publicKey])).toBe(true)
  })

  it('recusa corpo adulterado depois de assinado', () => {
    const assinatura = assinar(corpo)
    const adulterado = corpo.replace('ped-1', 'ped-2')
    expect(verificarAssinatura(adulterado, assinatura, [publicKey])).toBe(false)
  })

  it('recusa assinatura de outra chave', () => {
    const outra = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    expect(verificarAssinatura(corpo, assinar(corpo, outra.privateKey), [publicKey])).toBe(false)
  })

  it('sem assinatura ou sem chave, recusa', () => {
    expect(verificarAssinatura(corpo, '', [publicKey])).toBe(false)
    expect(verificarAssinatura(corpo, assinar(corpo), [])).toBe(false)
  })

  it('chave malformada na lista nao derruba a verificacao das outras', () => {
    expect(verificarAssinatura(corpo, assinar(corpo), ['nao é uma chave', publicKey])).toBe(true)
  })

  it('assinatura em base64 invalido nao explode', () => {
    expect(verificarAssinatura(corpo, '!!!nao-base64!!!', [publicKey])).toBe(false)
  })
})

describe('QR gerado do copia e cola', () => {
  it('vira data URI, que e o que o CSP do site permite', () => {
    const uri = qrComoDataUri('00020126580014BR.GOV.BCB.PIX0136exemplo52040000530398654041.005802BR')
    expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true)
    const svg = Buffer.from(uri.split(',')[1], 'base64').toString()
    expect(svg).toContain('<svg')
  })

  it('sem copia e cola, nao inventa QR', () => {
    expect(qrComoDataUri('')).toBe('')
  })
})
