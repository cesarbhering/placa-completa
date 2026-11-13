import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mensagemDoLimite } from './mensagem-limite'

// The buyer sees the server message only for checkout-limit refusals (marked
// by the server); every other error keeps the generic text.
const limite = (status: number, message: string) => ({ statusCode: status, data: { statusCode: status, message, data: { limite: true, motivo: 'placa' } } })

describe('mensagemDoLimite', () => {
  it('echoes the message of a marked 429 or 503', () => {
    expect(mensagemDoLimite(limite(429, 'Muitas tentativas.'))).toBe('Muitas tentativas.')
    expect(mensagemDoLimite({ ...limite(503, 'Cartão indisponível no momento. Use o Pix.'), statusCode: undefined, response: { status: 503 } }))
      .toBe('Cartão indisponível no momento. Use o Pix.')
  })
  it('unmarked 503 (card not configured) falls back to the generic text', () => {
    expect(mensagemDoLimite({ statusCode: 503, data: { message: 'Cartao indisponivel no momento' } })).toBeNull()
  })
  it('null for other statuses or without a message', () => {
    expect(mensagemDoLimite({ statusCode: 500, data: { message: 'x', data: { limite: true } } })).toBeNull()
    expect(mensagemDoLimite({ statusCode: 429, data: { data: { limite: true } } })).toBeNull()
    expect(mensagemDoLimite(null)).toBeNull()
  })
  it('inline checkout uses it for the Pix and the card errors', () => {
    const f = readFileSync('components/PremiumInlineCheckout.vue', 'utf8')
    expect(f).toContain("msg.value = mensagemDoLimite(e) || 'Não conseguimos gerar o Pix agora.")
    expect(f).toContain("erroCartao.value = mensagemDoLimite(e) || 'Não conseguimos processar o cartão agora.")
  })
})
