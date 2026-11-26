import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { escolherTitulo, TITULO_MIN, TITULO_MAX } from '../shared/seo-titulo'
import { DESCRICOES, descricaoNaFaixa } from '../shared/seo-meta'
import Ipva2027Estimativa from '../components/Ipva2027Estimativa.vue'

const arq = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8')
const plano = (s: string) => s.replace(/\s+/g, ' ')

// /ipva-2027 (Cesar, Nov 26, 2026): estimate of IPVA 2027 by plate, the 2027
// calendar of SP, MG, RS and MS, and what to check before paying.
describe('IPVA 2027 page', () => {
  const pagina = arq('pages/ipva-2027.vue')

  it('canonical, and "estimativa" in the title and the H1', () => {
    expect(pagina).toContain("const URL_PAGINA = 'https://placacompleta.com.br/ipva-2027'")
    expect(pagina).toContain("{ rel: 'canonical', href: URL_PAGINA }")
    const titulo = escolherTitulo(['IPVA 2027: estimativa do valor pela placa e calendário'])
    expect(pagina).toContain("escolherTitulo(['IPVA 2027: estimativa do valor pela placa e calendário'])")
    expect(titulo.length).toBeGreaterThanOrEqual(TITULO_MIN)
    expect(titulo.length).toBeLessThanOrEqual(TITULO_MAX)
    const h1 = /<h1[^>]*>([^<]+)<\/h1>/.exec(pagina)![1]
    expect(h1).toMatch(/IPVA 2027/)
    expect(h1).toMatch(/estimativa/i)
  })

  it('meta description in range, without "grátis" and without promising the official value', () => {
    expect(descricaoNaFaixa(DESCRICOES.ipva2027)).toBe(true)
    expect(DESCRICOES.ipva2027).toMatch(/^Estimativa do IPVA 2027/)
    expect(DESCRICOES.ipva2027).not.toMatch(/gr[aá]tis|oficial/i)
  })

  it('is in the sitemap and cached like the FIPE page', () => {
    const cfg = arq('nuxt.config.ts')
    expect(cfg).toContain('"/ipva-2027",')
    expect(cfg).toContain('"/ipva-2027": { swr: 86400 },')
  })

  it('reuses the plate lookup and the basic-plan offer of the FIPE page', () => {
    expect(pagina).toContain('<FipePorPlaca source-page="ipva-2027"')
    expect(pagina).toContain('<template #estimativa="{ resultado }">')
    expect(pagina).toContain(':segmento="resultado.segmento"')
    expect(pagina).toContain(':combustivel-texto="resultado.combustivel"')
  })

  it('FipePorPlaca keeps the FIPE page defaults and the offer card as they were', () => {
    const comp = arq('components/FipePorPlaca.vue')
    expect(comp).toContain("sourcePage: 'tabela-fipe-por-placa',")
    expect(comp).toContain("botao: 'Ver valor FIPE',")
    expect(comp).toContain('<slot name="estimativa" :resultado="resultado" />')
    // The slot sits between the FIPE value and the offer card.
    expect(comp.indexOf('<slot name="estimativa"')).toBeGreaterThan(comp.indexOf('resultado.fipeNota'))
    expect(comp.indexOf('<slot name="estimativa"')).toBeLessThan(comp.indexOf('class="fpp__oferta"'))
    expect(arq('pages/tabela-fipe-por-placa.vue')).toContain('<FipePorPlaca />')
  })

  it('is linked from the FIPE page and from the SP, MG, RS and MS state pages', () => {
    expect(arq('pages/tabela-fipe-por-placa.vue')).toContain('<NuxtLink to="/ipva-2027">estimativa do IPVA 2027 pela placa</NuxtLink>')
    const estado = arq('pages/consultar-placa/[estado].vue')
    expect(estado).toContain('UFS_COM_LINK_IPVA_2027.includes(data.uf)')
    expect(estado).toContain('<NuxtLink :to="linkIpva2027">estimativa do IPVA 2027 pela placa</NuxtLink>')
  })

  it('the free lookup tells the page whether the vehicle is a car', () => {
    expect(arq('server/api/consulta.post.ts')).toContain('segmento: detectarSegmento({ wdapi: apiResponse')
  })
})

describe('Ipva2027Estimativa', () => {
  const flex = { combustivelTexto: 'Álcool/Gasolina', segmento: 'carro' }

  it('shows the estimate for a gasoline/flex car in a checked state, with the source', () => {
    const w = mount(Ipva2027Estimativa, { props: { fipe: 'R$ 50.000,00', ufInicial: 'SP', ...flex } })
    const t = plano(w.text())
    expect(t).toContain('IPVA 2027 estimado')
    expect(t).toContain('R$ 2.000')
    expect(t).toContain('× 4%')
    expect(t).toContain('não o valor oficial nem uma consulta de débitos')
    expect(w.find('a[href^="https://portal.fazenda.sp.gov.br/"]').exists()).toBe(true)
    expect(t).toContain('Confira no documento do carro (CRLV)')
  })

  it('recomputes when the person changes the state', async () => {
    const w = mount(Ipva2027Estimativa, { props: { fipe: 50000, ufInicial: 'SP', ...flex } })
    await w.find('select').setValue('PR')
    expect(plano(w.text())).toContain('R$ 950')
    await w.find('select').setValue('MA')
    expect(plano(w.text())).not.toContain('IPVA 2027 estimado')
    expect(plano(w.text())).toContain('Ainda não conferimos a alíquota 2027 no Maranhão')
  })

  it('shows the range and what decides it where the rate depends on power', () => {
    const w = mount(Ipva2027Estimativa, { props: { fipe: 50000, ufInicial: 'CE', ...flex } })
    const t = plano(w.text())
    expect(t).toContain('R$ 1.250 a R$ 1.750')
    expect(t).toContain('depende da potência')
  })

  it('uses the rate the source gives for a hybrid, and none where it gives none', async () => {
    const w = mount(Ipva2027Estimativa, { props: { fipe: 50000, ufInicial: 'RJ', segmento: 'carro', combustivelTexto: 'Gasolina/Elétrico' } })
    expect(plano(w.text())).toContain('R$ 750')
    expect(plano(w.text())).toContain('de carro híbrido no Rio de Janeiro')
    await w.find('select').setValue('SP')
    expect(plano(w.text())).toContain('Para carro híbrido, a alíquota em São Paulo pode ser diferente')
    expect(plano(w.text())).not.toContain('IPVA 2027 estimado')
  })

  it('shows no number for a motorcycle', () => {
    const w = mount(Ipva2027Estimativa, { props: { fipe: 'R$ 18.000,00', ufInicial: 'SP', segmento: 'moto' } })
    expect(plano(w.text())).toContain('motos podem ter alíquota diferente')
    expect(plano(w.text())).not.toMatch(/R\$ \d/)
    expect(w.find('select').exists()).toBe(false)
  })

  it('without a FIPE value it explains instead of estimating', () => {
    const w = mount(Ipva2027Estimativa, { props: { fipe: null, ufInicial: 'MG', ...flex } })
    expect(plano(w.text())).toContain('Sem valor FIPE para este veículo')
    const m = mount(Ipva2027Estimativa, { props: { fipe: null, segmento: 'carro', combustivel: 'comum', origem: 'manual' } })
    expect(plano(m.text())).toContain('Digite o valor FIPE do carro')
    expect(plano(m.text())).not.toContain('CRLV')
  })
})
