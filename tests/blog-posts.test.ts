import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { blogPosts, findBlogPost } from '../data/blog-posts'
import { findIbvPost } from '../data/ibv-posts'
import { postsRecallAuto } from '../data/blog-posts-recall-auto'
import { linkDoPost, paginasNoBlog, postsDoBlog, urlAbsolutaDoPost, urlsDoBlog } from '../data/blog-indice'
import { BASE_LEILAO_TEXTO } from '../shared/base-leilao'
import { DESCRICOES } from '../shared/seo-meta'

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
    expect(p).toBe(blogPosts[2])
    const tudo = JSON.stringify(p)
    expect(tudo).not.toContain('\u2014')
    expect(tudo).not.toMatch(/SENATRAN|DETRAN/i)
    expect(p.content.find((s) => s.heading === 'Fontes')?.text).toContain('g1.globo.com')
    expect(p.content.some((s) => s.type === 'cta' && s.ctaTo === '/')).toBe(true)
  })
  it('post da Black Friday: estilo do Cesar, sem travessao, sem fonte, sem preco', () => {
    const p = findBlogPost('black-friday-carro-usado-golpe-anuncio')!
    expect(p).toBe(blogPosts[1])
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

  it('GTA 6 post: study with sources, tables from the saved data, no dash, no product price, no source of the registry', () => {
    const p = findBlogPost('gta-6-carro-usado-o-que-os-dados-dizem')!
    expect(p).toBe(blogPosts[0])
    const tudo = JSON.stringify(p)
    expect(tudo).not.toContain('\u2014')
    expect(tudo).not.toContain('\u2013')
    expect(tudo).not.toMatch(/SENATRAN|DETRAN|39,90|44,90|29,90/i)
    expect(p.title + p.metaDescription + (p.seoTitles || []).join(' ')).not.toMatch(/gr[aá]tis/i)
    expect(p.categoria).toBe('Estudos')
    // The 2013 search table: the three car searches and the game, three weeks each.
    const tabela = p.content.find((s) => s.type === 'table')!
    expect(tabela.columns).toHaveLength(4)
    expect(tabela.rows!.map((r) => r[0])).toEqual(['carros usados', 'webmotors', 'tabela fipe', 'gta 5'])
    for (const r of tabela.rows!) expect(r).toHaveLength(4)
    // Every external figure has its source listed.
    const fontes = p.content.find((s) => s.heading === 'Fontes')!.text!
    for (const dominio of ['doi.org/10.1002/soej.12139', 'doi.org/10.1177/1477370817717070', 'iihs.org', 'portaldotransito.com.br', 'vrum.com.br', 'theloadout.com']) expect(fontes).toContain(dominio)
    expect(p.content.some((s) => s.type === 'faq')).toBe(true)
    expect(p.content.some((s) => s.type === 'cta' && s.ctaTo === '/')).toBe(true)
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

// Pages that live outside /blog but show up in the listing (Nov 26, 2026).
describe('blog listing: pages outside /blog', () => {
  it('IPVA 2027 is listed under Estudos with the page title and description', () => {
    const e = postsDoBlog.find((p) => p.slug === 'ipva-2027')!
    expect(e).toBeTruthy()
    expect(paginasNoBlog).toContain(e)
    expect(e.tipo).toBe('pagina')
    expect(e.href).toBe('/ipva-2027')
    expect(linkDoPost(e)).toBe('/ipva-2027')
    expect(urlAbsolutaDoPost(e)).toBe('https://placacompleta.com.br/ipva-2027')
    expect(e.publishedAt).toBe('2026-11-26')
    expect(e.tag.slug).toBe('estudos')
    expect(e.metaDescription).toBe(DESCRICOES.ipva2027)
    const pagina = readFileSync('pages/ipva-2027.vue', 'utf8')
    expect(pagina).toContain(`{ property: 'og:title', content: '${e.title}' }`)
    expect(pagina).toContain("{ name: 'description', content: DESCRICOES.ipva2027 }")
    expect(existsSync('public' + e.imagem!.src)).toBe(true)
    expect(e.imagem!.alt).toMatch(/^IPVA 2027/)
    const tudo = JSON.stringify(e)
    expect(tudo).not.toContain('\u2014')
    expect(tudo).not.toMatch(/SENATRAN/i)
  })
  it('an entry with its own href never becomes /blog/<slug> and stays out of urlsDoBlog', () => {
    const urls = urlsDoBlog()
    expect(paginasNoBlog.length).toBeGreaterThan(0)
    for (const p of paginasNoBlog) {
      expect(p.href).toMatch(/^\/[a-z0-9]/)
      expect(p.href!.startsWith('/blog')).toBe(false)
      expect(urls).not.toContain(`/blog/${p.slug}`)
      expect(urls).not.toContain(p.href)
      // No real post behind /blog/<slug>: the slug page would 404.
      expect(findBlogPost(p.slug)).toBeUndefined()
      expect(findIbvPost(p.slug)).toBeUndefined()
    }
    for (const u of urls) expect(u.startsWith('/blog')).toBe(true)
    for (const p of postsDoBlog.filter((x) => !x.href)) expect(linkDoPost(p)).toBe(`/blog/${p.slug}`)
  })
  it('the listing and the tag page link through linkDoPost, never a hand-built /blog/<slug>', () => {
    for (const f of ['pages/blog/index.vue', 'pages/blog/tag/[tag].vue']) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).toContain(':to="linkDoPost(post)"')
      expect(src, f).toContain('url: urlAbsolutaDoPost(p)')
      expect(src, f).not.toMatch(/\/blog\/\$\{(post|p)\.slug\}/)
    }
  })
})
