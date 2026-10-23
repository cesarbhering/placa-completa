import { describe, it, expect } from 'vitest'
import { metaCupomRecompra, mensagemWhatsappRecompra, linkWhatsappRecompra } from './cupom-recompra-texto'

const c = { codigo: 'CARRO5UGT3', validoAte: '2026-10-12T14:00:00Z' }

describe('card do cupom de recompra', () => {
  it('linha de validade', () => {
    expect(metaCupomRecompra(c)).toBe('Vale para qualquer placa, até 12/10. Pode compartilhar.')
  })
  it('mensagem do WhatsApp aprovada, sem travessao', () => {
    const m = mensagemWhatsappRecompra(c)
    expect(m).toBe('Estou usando o PlacaCompleta para checar carro usado antes de comprar. Use o cupom CARRO5UGT3 e ganhe 10% no relatório completo, até 12/10: https://placacompleta.com.br/?utm_source=whatsapp&utm_medium=indicacao&utm_campaign=cupom_recompra')
    expect(m).not.toContain('—')
  })
  it('link wa.me sem token nem placa', () => {
    const l = linkWhatsappRecompra(c)
    expect(l.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(l.slice('https://wa.me/?text='.length))).toBe(mensagemWhatsappRecompra(c))
    expect(l).not.toMatch(/premium|token|placa=/)
  })
})

describe('cupom de recompra: percentual do proprio cupom (20% antigos, 10% novos)', () => {
  it('cupom ja emitido com 20% segue dizendo 20%; sem pct, o atual (10%)', async () => {
    const { textoCupomRecompra, mensagemWhatsappRecompra, pctDoCupom, DESCONTO_RECOMPRA_PCT } = await import('./cupom-recompra-texto')
    expect(DESCONTO_RECOMPRA_PCT).toBe(10)
    const antigo = { codigo: 'CARROABCDE', validoAte: '2026-10-25T12:00:00Z', pct: 20 }
    expect(textoCupomRecompra(antigo)).toContain('ganhe 20% na próxima consulta')
    expect(mensagemWhatsappRecompra(antigo)).toContain('ganhe 20% no relatório completo')
    expect(textoCupomRecompra({ codigo: 'CARRONOVO1', validoAte: '2026-10-27T12:00:00Z' })).toContain('ganhe 10% na próxima consulta')
    expect(pctDoCupom({ pct: 0 })).toBe(10)
    expect(pctDoCupom(null)).toBe(10)
  })
})
