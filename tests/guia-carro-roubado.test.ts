import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { RESPOSTA_CARRO_ROUBADO, RESPOSTA_CONSULTAR_ROUBO, FAQ_CARRO_ROUBADO, PASSOS_CARRO_ROUBADO, SE_FOR_ROUBADO } from '~/shared/guia-carro-roubado'

const palavras = (s: string) => s.trim().split(/\s+/).length

describe('guia como saber se o carro e roubado', () => {
  it('respostas diretas de 40 a 60 palavras, sem travessao ou SENATRAN', () => {
    for (const r of [RESPOSTA_CARRO_ROUBADO, RESPOSTA_CONSULTAR_ROUBO]) {
      expect(palavras(r)).toBeGreaterThanOrEqual(40)
      expect(palavras(r)).toBeLessThanOrEqual(60)
      expect(r).not.toMatch(/—|SENATRAN/i)
    }
    expect(RESPOSTA_CARRO_ROUBADO).not.toBe(RESPOSTA_CONSULTAR_ROUBO)
    expect(FAQ_CARRO_ROUBADO[0]!.resposta).toBe(RESPOSTA_CARRO_ROUBADO)
  })
  it('texto sem travessao, SENATRAN ou preco', () => {
    const tudo = JSON.stringify([FAQ_CARRO_ROUBADO, PASSOS_CARRO_ROUBADO, SE_FOR_ROUBADO]) + readFileSync('pages/como-saber-se-o-carro-e-roubado.vue', 'utf8')
    expect(tudo).not.toMatch(/—|SENATRAN|R\$\s*\d/i)
  })
  it('o JSON-LD (FAQ) nao leva a palavra gratis', () => {
    expect(JSON.stringify(FAQ_CARRO_ROUBADO)).not.toMatch(/gr[aá]tis/i)
  })
  it('esta no sitemap', () => {
    const cfg = readFileSync('nuxt.config.ts', 'utf8')
    const ini = cfg.indexOf('sitemap: {')
    const bloco = cfg.slice(ini, cfg.indexOf('exclude: [', ini))
    expect(bloco).toContain('"/como-saber-se-o-carro-e-roubado"')
  })
})
