import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { postsDoBlog, tagsComPost, urlsDoBlog, TAGS_BLOG } from '../data/blog-indice'
import { ibvPosts, IBV_SLUG_ANTIGO } from '../data/ibv-posts'
import { blogPosts } from '../data/blog-posts'
import { descricaoNaFaixa } from '../shared/seo-meta'
import { escolherTitulo } from '../shared/seo-titulo'

// IBV Auto dentro do blog (16/out/2026).
describe('IBV Auto no blog', () => {
  it('todos os posts do IBV e do blog no indice, sem colisao de slug', () => {
    expect(postsDoBlog).toHaveLength(ibvPosts.length + blogPosts.length)
    const slugs = postsDoBlog.map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
  it('posts do mes com prefixo ibv-auto-; os outros mantem o nome', () => {
    const mes = /^(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)-\d{4}$/
    for (const [antigo, novo] of Object.entries(IBV_SLUG_ANTIGO)) {
      expect(novo).toBe(mes.test(antigo) ? `ibv-auto-${antigo}` : antigo)
    }
    expect(Object.keys(IBV_SLUG_ANTIGO)).toHaveLength(ibvPosts.length)
    expect(IBV_SLUG_ANTIGO['setembro-2026']).toBe('ibv-auto-setembro-2026')
    expect(IBV_SLUG_ANTIGO['seguro-mais-caro-brasil-2026']).toBe('seguro-mais-caro-brasil-2026')
  })
  it('nenhum link /ibv dentro dos posts', () => {
    const txt = JSON.stringify(ibvPosts).replace(/\/images\/ibv\//g, '')
    expect(txt).not.toMatch(/\(\/ibv|placacompleta\.com\.br\/ibv/)
  })
  it('tags: title 50 a 60 e description na faixa', () => {
    expect(tagsComPost.map((t) => t.slug)).toEqual(expect.arrayContaining(['ibv-auto']))
    for (const t of TAGS_BLOG) {
      const titulo = escolherTitulo(t.titulos)
      expect(titulo.length, t.slug).toBeGreaterThanOrEqual(50)
      expect(titulo.length, t.slug).toBeLessThanOrEqual(60)
      expect(descricaoNaFaixa(t.description), `${t.slug}: ${t.description.length}`).toBe(true)
      expect(t.description + t.lead).not.toContain('—')
    }
  })
  it('sitemap: blog, tags e todos os posts, nada de /ibv', () => {
    const urls = urlsDoBlog()
    expect(urls).toContain('/blog/tag/ibv-auto')
    for (const p of ibvPosts) expect(urls).toContain(`/blog/${p.slug}`)
    const cfg = readFileSync(join(process.cwd(), 'nuxt.config.ts'), 'utf8')
    const sitemap = cfg.slice(cfg.indexOf('sitemap:'), cfg.indexOf('exclude:', cfg.indexOf('sitemap:')))
    expect(sitemap).not.toMatch(/"\/ibv/)
    expect(sitemap).toContain('...urlsDoBlog()')
  })
  it('header e rodape: "Blog" e nada de /ibv', () => {
    const header = readFileSync(join(process.cwd(), 'components/HomeHeader.vue'), 'utf8')
    expect(header).toContain("{ href: '/blog', label: 'Blog' }")
    expect(header).not.toContain("'/ibv'")
    const rodape = readFileSync(join(process.cwd(), 'shared/rodape-links.ts'), 'utf8')
    expect(rodape).not.toContain('/ibv')
    expect(rodape).toContain("{ rotulo: 'Blog', to: '/blog' }")
  })
})
