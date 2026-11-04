import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TEMAS_CONSULTAR, INDICE_CONSULTAR, rotaDoTema, temaConsultar } from '../shared/consultar-temas'
import { escolherTitulo, TITULO_MAX } from '../shared/seo-titulo'
import { PLANOS, precoBRL } from '../shared/planos'

const SLUGS = ['gravame', 'leilao', 'recall', 'multas', 'roubo-furto', 'fipe']
const PROIBIDO_META = /gr[aá]tis|gratuit|senatran|avaliservice/i

describe('cluster /consultar/{tema}', () => {
  it('tem os 6 temas com rota, h1, title, description e 5 FAQs', () => {
    expect(TEMAS_CONSULTAR.map((t) => t.slug)).toEqual(SLUGS)
    for (const t of TEMAS_CONSULTAR) {
      expect(rotaDoTema(t)).toBe(`/consultar/${t.slug}`)
      expect(t.h1.length, t.slug).toBeGreaterThan(10)
      expect(escolherTitulo(t.titulos).length, t.slug).toBeLessThanOrEqual(TITULO_MAX)
      expect(t.description.length, t.slug).toBeGreaterThan(80)
      expect(t.description.length, t.slug).toBeLessThanOrEqual(165)
      expect(t.faq, t.slug).toHaveLength(5)
      expect(t.planos.length, t.slug).toBeGreaterThan(0)
    }
    expect(temaConsultar('nao-existe')).toBeUndefined()
  })

  it('nenhum texto tem travessao', () => {
    expect(JSON.stringify(TEMAS_CONSULTAR)).not.toContain('—')
    expect(JSON.stringify(INDICE_CONSULTAR)).not.toContain('—')
    for (const f of ['pages/consultar/index.vue', 'pages/consultar/[tema].vue', 'components/ConsultarPlacaCard.vue']) {
      expect(readFileSync(join(process.cwd(), f), 'utf8'), f).not.toContain('—')
    }
  })

  it('title, description, og e JSON-LD (FAQ, h1, termo) sem gratis, SENATRAN ou fornecedor', () => {
    const metas = [INDICE_CONSULTAR.h1, INDICE_CONSULTAR.description, escolherTitulo(INDICE_CONSULTAR.titulos)]
    for (const t of TEMAS_CONSULTAR) {
      metas.push(escolherTitulo(t.titulos), t.description, t.h1, t.termo)
      for (const q of t.faq) metas.push(q.pergunta, q.resposta)
    }
    expect(metas.filter((m) => PROIBIDO_META.test(m))).toEqual([])
    expect(JSON.stringify(TEMAS_CONSULTAR)).not.toMatch(/senatran|avaliservice/i)
  })

  it('preco vem de PLANOS, nao hardcoded', () => {
    const recall = temaConsultar('recall')!
    const txt = recall.faq.map((q) => q.resposta).join(' ')
    expect(txt).toContain(precoBRL(PLANOS.basica.valorCentavos))
    expect(txt).toContain(precoBRL(PLANOS.completa.valorCentavos))
    const fonte = readFileSync(join(process.cwd(), 'shared/consultar-temas.ts'), 'utf8')
    expect(fonte).not.toMatch(/R\$\s?\d/)
  })

  it('as 7 URLs estao no sitemap do nuxt.config', () => {
    const cfg = readFileSync(join(process.cwd(), 'nuxt.config.ts'), 'utf8')
    const bloco = cfg.slice(cfg.indexOf('sitemap: {'), cfg.indexOf('exclude: [', cfg.indexOf('sitemap: {')))
    for (const u of ['/consultar', ...SLUGS.map((s) => `/consultar/${s}`)]) expect(bloco, u).toContain(`"${u}"`)
  })
})
