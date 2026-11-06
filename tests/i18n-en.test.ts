import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pt from '../i18n/locales/pt-BR'
import en from '../i18n/locales/en'
import { PAGINAS_BILINGUES, parDeIdiomas, caminhoEn, caminhoPt } from '../shared/idiomas'
import { nomeDaRota, nomesDeRotas, paginasSoEmPortugues, comVersaoEn } from '../shared/idiomas-rotas'
import { RECURSOS } from '../shared/planos'
import { RECURSOS_EN, DETALHES_EN } from '../shared/planos-en'
import { paginaCompra } from '../shared/cluster-compra'
import { PAGINAS_COMPRA_EN } from '../shared/cluster-compra-en'
import { COLUNAS_RODAPE, ROTULOS_RODAPE_EN } from '../shared/rodape-links'
import { DESCRICOES_EN } from '../shared/seo-meta-en'

// English version (Nov 6, 2026): every PT text of a bilingual page has its
// English line, and the English copy follows the same rules as the PT one.

// vitest runs from the repo root (vitest.config.ts)
const DIR_PAGES = resolve(process.cwd(), 'pages')
const ler = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

type Arvore = { [k: string]: string | Arvore }
function folhas(o: Arvore, prefixo = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(o)) {
    const chave = prefixo ? `${prefixo}.${k}` : k
    if (typeof v === 'string') out[chave] = v
    else Object.assign(out, folhas(v, chave))
  }
  return out
}
const PT = folhas(pt as Arvore)
const EN = folhas(en as Arvore)
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('translation keys (i18n/locales)', () => {
  it('every PT key has an English text', () => {
    const faltando = Object.keys(PT).filter((k) => !EN[k] || !EN[k].trim())
    expect(faltando).toEqual([])
  })
  it('no English key without a PT one (stale keys)', () => {
    expect(Object.keys(EN).filter((k) => !(k in PT))).toEqual([])
  })
  it('same {placeholders} in both languages', () => {
    for (const k of Object.keys(PT)) expect(placeholders(EN[k]), k).toEqual(placeholders(PT[k]))
  })
  it('no character vue-i18n would read as syntax (@ | $ and stray braces)', () => {
    for (const [k, v] of [...Object.entries(PT), ...Object.entries(EN)]) {
      expect(v, k).not.toMatch(/[@|$]/)
      expect(v.replace(/\{\w+\}/g, ''), k).not.toMatch(/[{}]/)
    }
  })
  it('every t(\'key\') used in the bilingual pages and shared chrome exists', () => {
    const arquivos = ['app.vue', 'components/HomeHeader.vue', 'components/WhatsappFlutuante.vue', 'components/PaginaCompra.vue',
      'pages/contato.vue', 'pages/para-empresas.vue', 'pages/feedback/[token].vue']
    for (const a of arquivos) {
      const src = ler(a)
      const usadas = [...src.matchAll(/\bt\('([\w.]+)'/g), ...src.matchAll(/keypath="([\w.]+)"/g)].map((m) => m[1])
      for (const k of usadas) expect(PT[k], `${a}: ${k}`).toBeTypeOf('string')
      // keys built with a template string: t(`empresas.quemUsa.${k}T`)
      for (const m of src.matchAll(/\bt\(`([\w.]+)\.\$\{/g)) {
        expect(Object.keys(PT).some((k) => k.startsWith(`${m[1]}.`)), `${a}: ${m[1]}`).toBe(true)
      }
    }
  })
})

// The long pages (about, terms, privacy) keep the PT markup as is and carry
// an English block next to it. Same headings and list items in both.
function blocos(arquivo: string) {
  const src = ler(arquivo)
  const i = src.indexOf('<template v-if="emIngles">')
  const j = src.indexOf('<template v-else>', i)
  const k = src.indexOf('</template>\n    </main>', j)
  expect(i, arquivo).toBeGreaterThan(0)
  return { en: src.slice(i, j), pt: src.slice(j, k), src }
}
const conta = (s: string, tag: string) => (s.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length

describe('long pages: English block mirrors the PT one', () => {
  for (const arquivo of ['pages/sobre.vue', 'pages/termos-de-uso.vue', 'pages/politica-de-privacidade.vue']) {
    it(`${arquivo}: same h1, h2, h3 and li count`, () => {
      const { en: e, pt: p } = blocos(arquivo)
      for (const tag of ['h1', 'h2', 'h3', 'li']) expect(conta(e, tag), `${arquivo} <${tag}>`).toBe(conta(p, tag))
    })
  }
  it('terms and privacy in English say the PT version prevails', () => {
    for (const arquivo of ['pages/termos-de-uso.vue', 'pages/politica-de-privacidade.vue']) {
      expect(blocos(arquivo).en).toMatch(/Portuguese version[\s\S]{0,80}prevails/)
    }
  })
})

describe('shared data in English', () => {
  it('every report feature has an English label', () => {
    expect(RECURSOS.filter((r) => !RECURSOS_EN[r.label]).map((r) => r.label)).toEqual([])
    expect(RECURSOS.filter((r) => r.detalhe && !DETALHES_EN[r.detalhe]).map((r) => r.detalhe)).toEqual([])
  })
  it('every footer link has an English label', () => {
    const links = COLUNAS_RODAPE.flatMap((c) => c.links.map((l) => l.to))
    expect(links.filter((to) => !ROTULOS_RODAPE_EN[to])).toEqual([])
  })
  it('the English buying page mirrors the PT one item by item', () => {
    for (const e of PAGINAS_COMPRA_EN) {
      const p = paginaCompra(e.rota)!
      expect(p, e.rota).toBeTruthy()
      expect(e.secoes.length).toBe(p.secoes.length)
      e.secoes.forEach((s, i) => {
        expect(s.lista?.length ?? 0, `${e.rota} secao ${i} lista`).toBe(p.secoes[i].lista?.length ?? 0)
        expect(s.paragrafos?.length ?? 0, `${e.rota} secao ${i} paragrafos`).toBe(p.secoes[i].paragrafos?.length ?? 0)
      })
      expect(e.faq.length).toBe(p.faq.length)
    }
  })
})

// --- Copy rules -------------------------------------------------------------

function textosEn(): Record<string, string> {
  const out: Record<string, string> = { ...Object.fromEntries(Object.entries(EN).map(([k, v]) => [`en.ts:${k}`, v])) }
  for (const [k, v] of Object.entries(DESCRICOES_EN)) out[`seo-meta-en:${k}`] = v
  for (const [k, v] of Object.entries(RECURSOS_EN)) out[`planos-en:${k}`] = v
  for (const [k, v] of Object.entries(DETALHES_EN)) out[`planos-en:${k}`] = v
  for (const [k, v] of Object.entries(ROTULOS_RODAPE_EN)) out[`rodape:${k}`] = v
  out['cluster-compra-en'] = JSON.stringify(PAGINAS_COMPRA_EN)
  for (const a of ['pages/sobre.vue', 'pages/termos-de-uso.vue', 'pages/politica-de-privacidade.vue']) {
    const { en: bloco, src } = blocos(a)
    out[`${a}:template`] = bloco
    out[`${a}:head`] = src.slice(src.indexOf('if (emIngles.value)'), src.indexOf('} else {'))
  }
  out['app.vue:head-en'] = ler('app.vue').match(/if \(emIngles\.value\) \{[\s\S]*?\n  \}/)![0]
  return out
}

describe('English copy rules', () => {
  const textos = textosEn()
  it('no em dash', () => {
    for (const [k, v] of Object.entries(textos)) expect(v, k).not.toContain('—')
  })
  it('never the federal agency acronym', () => {
    for (const [k, v] of Object.entries(textos)) expect(v, k).not.toMatch(/senatran/i)
  })
  it('no "free"/"grátis" in title, meta description, og or JSON-LD', () => {
    const metas: Record<string, string> = {}
    for (const [k, v] of Object.entries(EN)) if (/(^|\.)(title|titleCurto|ogTitle)$/.test(k)) metas[k] = v
    for (const [k, v] of Object.entries(DESCRICOES_EN)) metas[`descricao:${k}`] = v
    for (const p of PAGINAS_COMPRA_EN) {
      metas[`${p.rota}:title`] = p.title
      metas[`${p.rota}:description`] = p.description
      metas[`${p.rota}:h1`] = p.h1
      for (const q of p.faq) metas[`${p.rota}:faq`] = `${q.pergunta} ${q.resposta}`
    }
    for (const a of ['pages/sobre.vue', 'pages/termos-de-uso.vue', 'pages/politica-de-privacidade.vue']) metas[a] = textos[`${a}:head`]
    metas.app = textos['app.vue:head-en']
    for (const [k, v] of Object.entries(metas)) expect(v, k).not.toMatch(/\bfree\b|gr[aá]tis/i)
  })
  it('English meta descriptions fit Google (110 to 160 characters)', () => {
    const descs = [...Object.values(DESCRICOES_EN), ...PAGINAS_COMPRA_EN.map((p) => p.description)]
    for (const d of descs) {
      expect(d.length, d).toBeGreaterThanOrEqual(110)
      expect(d.length, d).toBeLessThanOrEqual(160)
    }
  })
  it('no case number, no real plate in the English copy', () => {
    for (const [k, v] of Object.entries(textos)) {
      expect(v, k).not.toMatch(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/) // CNJ case number
      expect(v, k).not.toMatch(/\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b/) // Brazilian plate
    }
  })
})

// --- Routes and sitemap -----------------------------------------------------

describe('bilingual routes', () => {
  it('route names follow Nuxt', () => {
    expect(nomeDaRota('index.vue')).toBe('index')
    expect(nomeDaRota('sobre.vue')).toBe('sobre')
    expect(nomeDaRota('blog/index.vue')).toBe('blog')
    expect(nomeDaRota('feedback/[token].vue')).toBe('feedback-token')
    expect(nomeDaRota('consultar-placa-de-[tipo].vue')).toBe('consultar-placa-de-tipo')
    expect(nomeDaRota('consultar-placa/capital/[slug].vue')).toBe('consultar-placa-capital-slug')
  })
  it('every bilingual page exists in pages/', () => {
    const nomes = nomesDeRotas(DIR_PAGES)
    for (const p of PAGINAS_BILINGUES) expect(nomes, p.nome).toContain(p.nome)
  })
  it('only the bilingual pages get /en: every other page is listed as en: false', () => {
    const so = paginasSoEmPortugues(DIR_PAGES)
    for (const p of PAGINAS_BILINGUES) expect(so[p.nome], p.nome).toBeUndefined()
    for (const n of ['index', 'blog', 'blog-slug', 'tabela-fipe', 'tabela-fipe-slug', 'carro-de-leilao', 'o-que-e-slug', 'premium', 'premium-token', 'admin', 'dash', 'woovi-teste']) {
      expect(so[n], n).toEqual({ en: false })
    }
  })
  it('PT/EN pair', () => {
    expect(parDeIdiomas('/sobre')).toMatchObject({ pt: '/sobre', en: '/en/sobre' })
    expect(parDeIdiomas('/en/sobre')).toMatchObject({ pt: '/sobre', en: '/en/sobre' })
    expect(parDeIdiomas('/feedback/TOKENFICTICIO')).toMatchObject({ en: '/en/feedback/TOKENFICTICIO' })
    expect(parDeIdiomas('/blog')).toBeNull()
    expect(caminhoEn('/')).toBe('/en')
    expect(caminhoPt('/en')).toBe('/')
  })
  it('sitemap: PT URLs unchanged and in order, /en added at the end', () => {
    const entrada = ['/', '/sobre', '/blog', '/termos-de-uso', '/contato']
    const saida = comVersaoEn(entrada)
    const loc = (u: any) => (typeof u === 'string' ? u : u.loc)
    expect(saida.slice(0, entrada.length).map(loc)).toEqual(entrada)
    expect(saida.slice(entrada.length).map(loc)).toEqual(['/en/sobre', '/en/contato'])
    expect(saida[1]).toMatchObject({ alternatives: [
      { hreflang: 'pt-BR', href: 'https://placacompleta.com.br/sobre' },
      { hreflang: 'en', href: 'https://placacompleta.com.br/en/sobre' },
      { hreflang: 'x-default', href: 'https://placacompleta.com.br/sobre' },
    ] })
    expect(saida[0]).toBe('/')
    expect(saida[2]).toBe('/blog')
  })
})
