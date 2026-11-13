import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mensagemDoLimite } from './mensagem-limite'

// The buyer sees the server message for checkout limits (429/503) instead of
// the generic error, and only for those statuses.
describe('mensagemDoLimite', () => {
  it('echoes the server message on 429 and 503', () => {
    expect(mensagemDoLimite({ statusCode: 429, data: { message: 'Muitas tentativas.' } })).toBe('Muitas tentativas.')
    expect(mensagemDoLimite({ response: { status: 503 }, data: { message: 'Cartão indisponível no momento. Use o Pix.' } })).toBe('Cartão indisponível no momento. Use o Pix.')
  })
  it('null for other statuses or without a message', () => {
    expect(mensagemDoLimite({ statusCode: 500, data: { message: 'stack' } })).toBeNull()
    expect(mensagemDoLimite({ statusCode: 429 })).toBeNull()
    expect(mensagemDoLimite(null)).toBeNull()
  })
  it('inline checkout uses it for the Pix and the card errors', () => {
    const f = readFileSync('components/PremiumInlineCheckout.vue', 'utf8')
    expect(f).toContain("msg.value = mensagemDoLimite(e) || 'Não conseguimos gerar o Pix agora.")
    expect(f).toContain("erroCartao.value = mensagemDoLimite(e) || 'Não conseguimos processar o cartão agora.")
  })
})
