import { describe, it, expect } from 'vitest'
import { metaCupomRecompra, mensagemWhatsappRecompra, linkWhatsappRecompra } from './cupom-recompra-texto'

const c = { codigo: 'CARRO5UGT3', validoAte: '2026-10-12T14:00:00Z' }

describe('card do cupom de recompra', () => {
  it('linha de validade', () => {
    expect(metaCupomRecompra(c)).toBe('Vale para qualquer placa, até 12/10. Pode compartilhar.')
  })
  it('mensagem do WhatsApp aprovada, sem travessao', () => {
    const m = mensagemWhatsappRecompra(c)
    expect(m).toBe('Estou usando o PlacaCompleta para checar carro usado antes de comprar. Use o cupom CARRO5UGT3 e ganhe 20% no relatório completo, até 12/10: https://placacompleta.com.br/?utm_source=whatsapp&utm_medium=indicacao&utm_campaign=cupom_recompra')
    expect(m).not.toContain('—')
  })
  it('link wa.me sem token nem placa', () => {
    const l = linkWhatsappRecompra(c)
    expect(l.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(l.slice('https://wa.me/?text='.length))).toBe(mensagemWhatsappRecompra(c))
    expect(l).not.toMatch(/premium|token|placa=/)
  })
})
