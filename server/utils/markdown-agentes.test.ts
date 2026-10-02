import { describe, it, expect } from 'vitest'
import { pathPermiteMarkdown, prefereMarkdown, htmlParaMarkdown, estimarTokens } from './markdown-agentes'

describe('prefereMarkdown', () => {
  it('agente pedindo markdown', () => {
    expect(prefereMarkdown('text/markdown')).toBe(true)
    expect(prefereMarkdown('text/markdown, text/html;q=0.9')).toBe(true)
    expect(prefereMarkdown('text/html;q=0.5, text/markdown')).toBe(true)
    expect(prefereMarkdown('text/markdown, text/html')).toBe(true)
  })
  it('navegador e Accept normal: HTML', () => {
    expect(prefereMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8')).toBe(false)
    expect(prefereMarkdown('*/*')).toBe(false)
    expect(prefereMarkdown(undefined)).toBe(false)
    expect(prefereMarkdown('text/html, text/markdown')).toBe(false)
    expect(prefereMarkdown('text/html, text/markdown;q=0.9')).toBe(false)
    expect(prefereMarkdown('text/markdown;q=0')).toBe(false)
  })
})

describe('pathPermiteMarkdown', () => {
  it('paginas publicas', () => {
    for (const p of ['/', '/consulta-placa', '/como-consultar-placa', '/consultar-placa/sao-paulo', '/consultar-placa/capital/belo-horizonte',
      '/tabela-fipe', '/tabela-fipe/fiat-argo', '/sobre', '/politica-de-privacidade', '/termos-de-uso', '/consulta-placa/', '/consulta-placa?x=1'])
      expect(pathPermiteMarkdown(p), p).toBe(true)
  })
  it('nunca: premium, api, admin, dash, checkout, desconhecidas', () => {
    for (const p of ['/premium', '/premium/abc123', '/premium/abc/pdf', '/api/premium/report', '/api/consulta', '/admin', '/dash',
      '/checkout', '/feedback/tok', '/woovi-teste', '/cotacao', '/_nuxt/x.js', '/consultar-placa/../premium/x'])
      expect(pathPermiteMarkdown(p), p).toBe(false)
  })
})

describe('htmlParaMarkdown', () => {
  const html = `<html><head><title>Consulta placa | PlacaCompleta</title><meta name="description" content="Desc &amp; mais"><style>.a{}</style></head>
  <body><header><nav><a href="/">Menu</a></nav></header><main><h1>Consulta de placa</h1><p>Texto com <a href="/sobre">link</a>.</p>
  <table><tr><th>UF</th><th>Preco</th></tr><tr><td>SP</td><td>R$ 1</td></tr></table><script>alert(1)</script></main><footer>Rodape</footer></body></html>`
  const md = htmlParaMarkdown(html, 'https://placacompleta.com.br/consulta-placa')
  it('mantem titulo, texto, links e tabela', () => {
    expect(md).toContain('# Consulta de placa')
    expect(md).toContain('[link](/sobre)')
    expect(md).toMatch(/\| UF\s*\| Preco\s*\|/)
    expect(md).toContain('> Desc & mais')
    expect(md).toContain('Fonte: https://placacompleta.com.br/consulta-placa')
  })
  it('tira script, estilo, nav e footer', () => {
    expect(md).not.toMatch(/alert|\.a\{|Menu|Rodape/)
  })
  it('tokens ~ chars/4', () => expect(estimarTokens('abcdefgh')).toBe(2))
})
