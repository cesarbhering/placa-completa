import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { blogPosts, findBlogPost } from '../data/blog-posts'
import { postsRecallAuto } from '../data/blog-posts-recall-auto'
import { BASE_LEILAO_TEXTO } from '../shared/base-leilao'

describe('blog', () => {
  it('post do Claude for Startups', () => {
    const p = findBlogPost('claude-for-startups')!
    expect(p).toBeTruthy()
    const tudo = JSON.stringify(p)
    expect(tudo).toContain('Claude for Startups')
    expect(tudo).toContain('Anthropic')
    expect(tudo).toContain(BASE_LEILAO_TEXTO)
    expect(tudo).not.toContain('—')
    expect(tudo).not.toMatch(/SENATRAN|fundador|uma pessoa s[oó]|sozinho|receita|faturamento|vendas/i)
    expect(p.content.at(-1)).toMatchObject({ type: 'cta', ctaTo: '/' })
  })
  it('post da eleicao 2026: neutro, com fontes e sem travessao', () => {
    const p = findBlogPost('eleicao-2026-o-que-muda-no-preco-do-carro-usado')!
    expect(p).toBe(blogPosts[1])
    const tudo = JSON.stringify(p)
    expect(tudo).not.toContain('\u2014')
    expect(tudo).not.toMatch(/SENATRAN|DETRAN/i)
    expect(p.content.find((s) => s.heading === 'Fontes')?.text).toContain('g1.globo.com')
    expect(p.content.some((s) => s.type === 'cta' && s.ctaTo === '/')).toBe(true)
  })
  it('post da Black Friday: estilo do Cesar, sem travessao, sem fonte, sem preco', () => {
    const p = findBlogPost('black-friday-carro-usado-golpe-anuncio')!
    expect(p).toBe(blogPosts[0])
    const tudo = JSON.stringify(p)
    expect(tudo).not.toContain('\u2014')
    expect(tudo).not.toMatch(/SENATRAN|DETRAN|39,90|44,90|29,90/i)
    expect(p.title + p.metaDescription).not.toMatch(/gr[aá]tis/i)
    expect(p.content.some((s) => s.type === 'faq')).toBe(true)
    expect(p.content.at(-1)).toMatchObject({ type: 'cta', ctaTo: '/' })
  })
  it('post da FIPE de novembro de 2026: estilo do Cesar, sem travessao, sem fonte, sem preco, sem gratis', () => {
    const p = findBlogPost('tabela-fipe-novembro-2026-usado-caiu')!
    expect(p).toBeTruthy()
    const tudo = JSON.stringify(p)
    expect(tudo).not.toContain('\u2014')
    expect(tudo).not.toMatch(/SENATRAN|DETRAN|39,90|44,90|29,90/i)
    expect(p.title + p.metaDescription + (p.seoTitles || []).join(' ')).not.toMatch(/gr[aá]tis/i)
    expect(tudo).toMatch(/tabela FIPE/i)
    expect(p.content.filter((s) => s.type === 'table').length).toBe(3)
    expect(p.content.some((s) => s.type === 'faq')).toBe(true)
    expect(p.content.at(-1)).toMatchObject({ type: 'cta', ctaTo: '/' })
  })

  it('capas existem em public/', () => {
    for (const p of blogPosts) {
      expect(existsSync('public' + p.capa.src)).toBe(true)
      expect(existsSync('public' + p.capa.og)).toBe(true)
    }
  })
  it('posts de recall automaticos (pc-recall-publicar) entram no blog e seguem a copy', () => {
    for (const p of postsRecallAuto) {
      expect(findBlogPost(p.slug)).toBe(p)
      const tudo = JSON.stringify(p)
      expect(tudo).not.toContain('\u2014')
      expect(tudo).not.toMatch(/SENATRAN|REVISAR/i)
      expect(p.categoria).toBe('Recall')
    }
  })
})
