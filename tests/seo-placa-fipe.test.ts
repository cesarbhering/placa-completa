import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CONTENT } from '../composables/useSiteVariant'
import { DESCRICOES, DESCRICAO_CONSULTAR_PLACA, GANCHO_CONSULTA, DESCRICAO_HOME_BUSCA, descricaoTabelaFipePorPlaca } from '../shared/seo-meta'

const arq = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8')

// Plano de growth nov/2026: "placa fipe" e "fipe pela placa" caiam na home
// (CTR 0,3%). A pagina /tabela-fipe-por-placa assume o termo; a home nao
// disputa; o resultado gratis e o relatorio linkam pra ela.
describe('SEO placa FIPE', () => {
  const fipe = arq('pages/tabela-fipe-por-placa.vue')
  it('pagina FIPE: canonical, H1 e primeiro paragrafo com os dois termos', () => {
    expect(fipe).toContain("{ rel: 'canonical', href: 'https://placacompleta.com.br/tabela-fipe-por-placa' }")
    const h1 = /<h1[^>]*>([^<]+)<\/h1>/.exec(fipe)![1]
    expect(h1).toMatch(/placa fipe/i)
    expect(h1).toMatch(/fipe pela placa/i)
    const lead = /class="pc-lead">([\s\S]*?)<\/p>/.exec(fipe)![1]
    expect(lead).toMatch(/placa FIPE/i)
    expect(lead).toMatch(/FIPE pela placa/i)
    expect(descricaoTabelaFipePorPlaca('novembro', 2026)).not.toMatch(/gr[aá]tis/i)
  })
  it('home nao disputa o termo FIPE no title nem na meta', () => {
    expect(DESCRICAO_HOME_BUSCA).not.toMatch(/fipe/i)
    expect(CONTENT.default.metaTitle).toBe('Consulta Placa: Busca Placa, Leilão e Roubo | PlacaCompleta')
    expect(CONTENT.default.metaTitle).not.toMatch(/fipe/i)
  })
  it('links internos destacados no resultado gratis e no bloco FIPE do relatorio', () => {
    expect(arq('pages/index.vue')).toContain('<NuxtLink to="/tabela-fipe-por-placa">Ver o valor FIPE deste modelo</NuxtLink>')
    expect(arq('pages/premium/[token].vue')).toContain('<NuxtLink to="/tabela-fipe-por-placa">')
  })
  it('metas de consultar placa com o gancho de leilao e sem gratis', () => {
    for (const d of [DESCRICOES.consultaPlaca, DESCRICAO_CONSULTAR_PLACA]) {
      expect(d).toMatch(/sem cadastro/i)
      expect(d).toMatch(/modelo aparece em leilões/)
      expect(d).not.toMatch(/gr[aá]tis|gratuit/i)
      expect(d).not.toContain('—')
      expect(d.length).toBeLessThanOrEqual(160)
    }
    expect(DESCRICAO_CONSULTAR_PLACA).toContain(GANCHO_CONSULTA)
    const idx = arq('pages/consultar-placa/index.vue')
    expect(idx).toContain("{ name: 'description', content: DESCRICAO_CONSULTAR_PLACA }")
    expect(idx).toContain("{ property: 'og:description', content: DESCRICAO_CONSULTAR_PLACA }")
  })
})
