import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { blogPosts, findBlogPost } from '../data/blog-posts'
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
  it('capas existem em public/', () => {
    for (const p of blogPosts) {
      expect(existsSync('public' + p.capa.src)).toBe(true)
      expect(existsSync('public' + p.capa.og)).toBe(true)
    }
  })
})
