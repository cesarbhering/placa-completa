import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { estudoModelos, combinado, custoKm, pearson } from '../data/estudo-economicos'
import { findBlogPost } from '../data/blog-posts'
import { escolherTitulo } from '../shared/seo-titulo'

const post = findBlogPost('carros-usados-mais-economicos')!
const tudo = JSON.stringify(post)

describe('estudo carros usados mais economicos', () => {
  it('numeros principais batem com o dataset', () => {
    expect(estudoModelos).toHaveLength(27)
    const r = pearson(estudoModelos.map((m) => m.fipe), estudoModelos.map((m) => combinado(m.gasolina)))
    expect(r).toBeCloseTo(-0.69, 2)
    const c = estudoModelos.map((m) => custoKm(m, 'gasolina'))
    expect(Math.min(...c)).toBeCloseTo(0.42, 2)
    expect(Math.max(...c)).toBeCloseTo(0.61, 2)
    // etanol mais barato por km em todos
    expect(estudoModelos.every((m) => custoKm(m, 'etanol') < custoKm(m, 'gasolina'))).toBe(true)
  })
  it('combinado reproduz a coluna do Inmetro (HB20 1.0 2026: etanol 10,2 e gasolina 14,2)', () => {
    expect(combinado([9.9, 10.7])).toBeCloseTo(10.2, 1)
    expect(combinado([13.3, 15.4])).toBeCloseTo(14.2, 1)
  })
  it('regras de copy', () => {
    expect(tudo).not.toContain('—')
    expect(tudo).not.toMatch(/SENATRAN/i)
    expect(tudo).not.toMatch(/\/premium/)
    expect(tudo).not.toMatch(/undefined|NaN/)
    expect(post.content.at(-1)).toMatchObject({ type: 'cta', ctaTo: '/consulta-gratis' })
    expect(post.content.at(-1)!.text).not.toMatch(/consumo/i)
  })
  it('seo: title, meta e faq', () => {
    const t = escolherTitulo(post.seoTitles!)
    expect(t.length).toBeGreaterThanOrEqual(50)
    expect(t.length).toBeLessThanOrEqual(60)
    expect(post.metaDescription.length).toBeLessThanOrEqual(165)
    expect(post.content.some((s) => s.type === 'faq' && (s.faq?.length || 0) >= 5)).toBe(true)
    expect(post.content.filter((s) => s.type === 'table')).toHaveLength(4)
  })
  it('capas existem', () => {
    expect(existsSync('public' + post.capa.src)).toBe(true)
    expect(existsSync('public' + post.capa.og)).toBe(true)
  })
})
