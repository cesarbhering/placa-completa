import { describe, it, expect } from 'vitest'
import { RESPOSTA_COMO_SABER_INDEX, PERGUNTAS_LEILAO } from '~/shared/faq-leilao'
import { RESPOSTA_COMO_SABER, FAQ_COMO_SABER } from '~/shared/guia-como-saber-leilao'
import { CONTA_INDEX, CONTA_COMO_SABER, PRECO_COMPLETA } from '~/shared/conta-leilao'

const palavras = (s: string) => s.trim().split(/\s+/).length

describe('respostas diretas do leilao', () => {
  it('tem de 40 a 60 palavras, sem travessao ou SENATRAN', () => {
    for (const [k, r] of Object.entries({ RESPOSTA_COMO_SABER_INDEX, RESPOSTA_COMO_SABER })) {
      expect(palavras(r), k).toBeGreaterThanOrEqual(40)
      expect(palavras(r), k).toBeLessThanOrEqual(60)
      expect(r, k).not.toMatch(/—|SENATRAN/i)
    }
  })
  it('as duas respostas sao diferentes e entram no FAQ (schema) de cada pagina', () => {
    expect(RESPOSTA_COMO_SABER_INDEX).not.toBe(RESPOSTA_COMO_SABER)
    expect(PERGUNTAS_LEILAO[0]!.resposta).toBe(RESPOSTA_COMO_SABER_INDEX)
    expect(FAQ_COMO_SABER[0]!.resposta).toBe(RESPOSTA_COMO_SABER)
  })
})

describe('conta do leilao', () => {
  it('preco vem de PLANOS, sem travessao, SENATRAN ou exclamacao, textos diferentes', () => {
    expect(PRECO_COMPLETA.replace(/\s/g, ' ')).toBe('R$ 44,90')
    const a = JSON.stringify(CONTA_INDEX), b = JSON.stringify(CONTA_COMO_SABER)
    for (const t of [a, b]) expect(t).not.toMatch(/—|SENATRAN|!/i)
    expect(a).not.toBe(b)
  })
})
