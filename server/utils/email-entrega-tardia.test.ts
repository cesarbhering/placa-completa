import { describe, it, expect } from 'vitest'
import { entregaTardiaPendente, STATUS_JA_ENTREGUE } from './email-entrega-tardia'

// Caso real: um pedido foi pago sem e-mail, a pessoa mandou o e-mail depois e a
// entrega teve que ser feita a mao pelo time.
describe('entrega quando o e-mail chega depois do pagamento', () => {
  it('pedido pago que ganhou e-mail agora: envia', () => {
    for (const status of STATUS_JA_ENTREGUE) {
      expect(entregaTardiaPendente({ status, email_enviado_em: null }), status).toBe(true)
    }
  })

  it('pedido ainda esperando pagamento: nao envia nada', () => {
    expect(entregaTardiaPendente({ status: 'aguardando_pagamento' })).toBe(false)
    expect(entregaTardiaPendente({ status: 'expirado' })).toBe(false)
  })

  it('pedido que falhou ou foi reembolsado nao dispara entrega', () => {
    expect(entregaTardiaPendente({ status: 'falha' })).toBe(false)
    expect(entregaTardiaPendente({ status: 'reembolsado' })).toBe(false)
  })

  it('nao manda duas vezes: o carimbo segura', () => {
    expect(entregaTardiaPendente({ status: 'entregue', email_enviado_em: '2026-09-08T09:00:00Z' })).toBe(false)
  })

  it('pedido inexistente nao quebra a regra', () => {
    expect(entregaTardiaPendente(null)).toBe(false)
    expect(entregaTardiaPendente(undefined)).toBe(false)
    expect(entregaTardiaPendente({})).toBe(false)
  })
})
