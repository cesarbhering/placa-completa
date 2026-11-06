import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const tracks: Array<[string, any]> = []
vi.stubGlobal('useAnalytics', () => ({ track: (e: string, p: any) => { tracks.push([e, p]) } }))

const { default: CompartilharWhatsapp } = await import('./CompartilharWhatsapp.vue')
const { default: ResultadoLayoutA } = await import('./ResultadoLayoutA.vue')

const DADOS = { placa: 'AAA1A11', marca: 'FIAT', modelo: 'UNO MILLE', ano: '2015', anoFabricacao: '2014', fipe: 'R$ 20.000,00' }

describe('botao Compartilhar no WhatsApp', () => {
  it('link wa.me em nova aba, so com o link do resultado, e registra o clique', async () => {
    const w = mount(CompartilharWhatsapp, { props: { placa: 'AAA1A11', modelo: 'Uno', ano: '2015', onde: 'layout_b' } })
    const a = w.find('a')
    expect(a.text()).toBe('Compartilhar no WhatsApp')
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toContain('noopener')
    expect(a.find('svg').exists()).toBe(true)
    const texto = new URL(a.attributes('href')!).searchParams.get('text')
    expect(texto).toBe('Olha o que apareceu na consulta da placa deste Uno 2015: https://placacompleta.com.br/placa/AAA1A11?utm_source=whatsapp&utm_medium=share&utm_campaign=resultado_gratis')
    expect(texto).not.toMatch(/R\$/)
    await a.trigger('click')
    expect(tracks).toContainEqual(['compartilhar_whatsapp_click', { onde: 'layout_b' }])
  })

  it('sem placa valida nao renderiza', () => {
    const w = mount(CompartilharWhatsapp, { props: { placa: '', onde: 'layout_b' } })
    expect(w.find('a').exists()).toBe(false)
  })
})

describe('resultado gratis (layout A)', () => {
  const base = {
    dados: DADOS, modeloCurto: 'Uno', valorFipeCurto: 'R$ 20.000', fipeValido: true,
    barraRelatorioStyle: { width: '4px' }, pctFipe: null, qtdLeiloes: 0, leilaoEncontrado: false,
    precoCompleta: 'R$ 39,90', precoBasica: 'R$ 19,90',
  }
  it('mostra o botao DEPOIS do card do CTA da Completa, sem o valor FIPE no texto', () => {
    const w = mount(ResultadoLayoutA, { props: base, global: { stubs: { PrecoPromo: true } } })
    const btn = w.find('.cw')
    expect(btn.exists()).toBe(true)
    const html = w.html()
    // o CTA nao desce: o botao vem depois do card inteiro da acao
    const fimCardCta = html.indexOf('</section>', html.indexOf('class="la-acao"'))
    expect(fimCardCta).toBeGreaterThan(0)
    expect(html.indexOf('class="cw"')).toBeGreaterThan(fimCardCta)
    expect(w.find('.la-acao .cw').exists()).toBe(false)
    const texto = new URL(btn.attributes('href')!).searchParams.get('text')!
    expect(texto).not.toContain('20.000')
    expect(texto).toContain('deste Uno 2015')
  })
  it('no app nao aparece', () => {
    const w = mount(ResultadoLayoutA, { props: { ...base, app: true }, global: { stubs: { PrecoPromo: true } } })
    expect(w.find('.cw').exists()).toBe(false)
  })
})
