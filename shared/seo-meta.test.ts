import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  DESCRICOES, descricaoNaFaixa, problemaNoTitulo, descricaoTabelaFipePorPlaca, descricaoCapital,
  descricaoLeilaoModelo, descricaoSeguroEletrico, descricaoSeguroEletricoEstado, DESCRICAO_MAX,
} from './seo-meta'
import { descricaoMarca, descricaoModelo } from './fipe-seo'
import { descricaoEstado } from './estado-seo'
import { MODELOS_LEILAO } from './leilao-modelos'
import { PAGINAS_COMPRA } from './cluster-compra'
import { ARTIGOS } from './artigos-o-que-e'
import { capitals } from '../data/capitals'
import { states } from '../data/states'
import { fipeBrands } from '../data/fipe-brands'
import { ibvPosts } from '../data/ibv-posts'
import { blogPosts } from '../data/blog-posts'
import { vehicleTypes } from '../data/vehicle-types'
import seguroEletricos from '../data/seguro-eletricos.json'

// Auditoria Ahrefs (08/out): 93 descriptions acima de 160. Este teste varre
// TODAS as descriptions que o site gera (fixas e programaticas) e os titulos
// escritos no codigo, e falha se alguma sair da regra.

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function todasAsDescricoes(): [string, string][] {
  const out: [string, string][] = []
  for (const [k, v] of Object.entries(DESCRICOES)) out.push([`fixa:${k}`, v])
  for (const mes of MESES) for (const ano of [2026, 2027]) out.push([`/tabela-fipe-por-placa ${mes}/${ano}`, descricaoTabelaFipePorPlaca(mes, ano)])
  for (const c of Object.values(capitals)) {
    const uf = states[c.stateSlug]?.uf || '??'
    out.push([`/consultar-placa/capital/${c.slug}`, descricaoCapital(c.name, uf)])
  }
  for (const s of Object.values(states)) out.push([`/consultar-placa/${s.slug}`, descricaoEstado(s.uf, s.name)])
  for (const m of MODELOS_LEILAO) {
    out.push([`/carro-de-leilao/${m.slug}`, m.description])
    out.push([`/carro-de-leilao/${m.slug} (template)`, descricaoLeilaoModelo(m.nomeCompleto, m.nome)])
  }
  for (const b of Object.values(fipeBrands)) {
    out.push([`/tabela-fipe/${b.slug}`, descricaoMarca(b.name, b.models.map((m) => m.name), 2026)])
    for (const m of b.models) out.push([`/tabela-fipe/${b.slug}/${m.slug}`, descricaoModelo(b.name, m.name, [])])
  }
  const seg = seguroEletricos as Record<string, any>
  const medias = Object.values(seg).map((d: any) => d?.mediaPremio).filter(Boolean)
  out.push(['/seguro/carro-eletrico', descricaoSeguroEletrico(Math.round(medias.reduce((a, b) => a + b, 0) / medias.length))])
  for (const s of Object.values(states)) {
    const d = seg[s.uf]
    if (d?.mediaPremio) out.push([`/seguro/carro-eletrico/${s.slug}`, descricaoSeguroEletricoEstado(s.name, d.mediaPremio)])
  }
  for (const p of ibvPosts) out.push([`/ibv/${p.slug}`, p.metaDescription])
  for (const p of blogPosts) out.push([`/blog/${p.slug}`, p.metaDescription])
  for (const p of PAGINAS_COMPRA) out.push([p.rota, p.description])
  for (const a of ARTIGOS) out.push([`/o-que-e/${a.slug}`, a.description])
  for (const [slug, v] of Object.entries(vehicleTypes)) out.push([`/consultar-placa-de-${slug}`, (v as any).metaDescription])
  return out
}

describe('meta descriptions', () => {
  const todas = todasAsDescricoes()
  it('cobre as paginas programaticas', () => {
    expect(todas.length).toBeGreaterThan(150)
  })
  it(`entre 110 e ${DESCRICAO_MAX} caracteres`, () => {
    const fora = todas.filter(([, d]) => !descricaoNaFaixa(d)).map(([r, d]) => `${r} (${d.length}): ${d}`)
    expect(fora).toEqual([])
  })
  it('sem travessao e sem citar a fonte oficial', () => {
    const ruins = todas.filter(([, d]) => d.includes('—') || /senatran/i.test(d)).map(([r]) => r)
    expect(ruins).toEqual([])
  })
  it('tabela FIPE pela placa nao promete gratis', () => {
    expect(descricaoTabelaFipePorPlaca('setembro', 2026)).not.toMatch(/gr[aá]tis/i)
  })
  it('marca com nomes longos corta modelos em vez de estourar', () => {
    const d = descricaoMarca('Mercedes-Benz', ['Classe GLE Coupé', 'Classe GLC Coupé', 'Classe CLA Shooting Brake'], 2026)
    expect(d.length).toBeLessThanOrEqual(DESCRICAO_MAX)
    expect(d.startsWith('Tabela FIPE Mercedes-Benz 2026')).toBe(true)
  })
})

describe('titulos', () => {
  it('titulos dos posts e modelos sem marca duplicada nem travessao', () => {
    const titulos: [string, string][] = [
      ...ibvPosts.map((p) => [`/ibv/${p.slug}`, p.title] as [string, string]),
      ...blogPosts.map((p) => [`/blog/${p.slug}`, p.title] as [string, string]),
      ...MODELOS_LEILAO.map((m) => [`/carro-de-leilao/${m.slug}`, m.title.replace(' | PlacaCompleta', '')] as [string, string]),
    ]
    const ruins = titulos.map(([r, t]) => [r, problemaNoTitulo(t)]).filter(([, p]) => p)
    expect(ruins).toEqual([])
  })

  // O modulo de SEO ja anexa " | PlacaCompleta" (site.name). Titulo escrito
  // com o sufixo no codigo sai "| PlacaCompleta | PlacaCompleta".
  it('nenhuma pagina escreve o sufixo da marca ou travessao no title', () => {
    const arquivos: string[] = []
    const varrer = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f)
        if (statSync(p).isDirectory()) varrer(p)
        else if (p.endsWith('.vue')) arquivos.push(p)
      }
    }
    varrer(join(__dirname, '..', 'pages'))
    const ruins: string[] = []
    for (const a of arquivos) {
      for (const linha of readFileSync(a, 'utf8').split('\n')) {
        if (!/^\s*title:\s*[`'"]/.test(linha)) continue
        const p = problemaNoTitulo(linha.replace(/^\s*title:\s*[`'"]|[`'"],?\s*$/g, ''))
        if (p) ruins.push(`${a}: ${p}: ${linha.trim()}`)
      }
    }
    expect(ruins).toEqual([])
  })
})
