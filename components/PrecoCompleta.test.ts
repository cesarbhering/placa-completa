import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { mount } from '@vue/test-utils'
import PrecoCompleta from './PrecoCompleta.vue'
import TextoComPreco from './TextoComPreco.vue'
import { partesComPreco } from '../composables/usePrecoCompleta'
import { AB_PRECO_KEY, _resetAbPreco, configurarAbPreco } from '../shared/ab-preco'
import { precoBRL } from '../shared/planos'

// Single source of the visible Completa price during the price A/B test:
// SSR = A, arm price after mount, first-fold numbers hidden until mount in
// both arms, and nothing changes with the test off.
let flag = ''
function comBraco(v: string | null, ligado: boolean) {
  const m = new Map<string, string>()
  if (v) m.set(AB_PRECO_KEY, v)
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, x: string) => { m.set(k, x) }, removeItem: () => {} })
  flag = ligado ? 'on' : ''
  configurarAbPreco({ ligado })
}
const ssr = (props: any = {}) => renderToString(createSSRApp({ render: () => h(PrecoCompleta, props) }))
const nbsp = (s: string) => s.replace(/ /g, ' ')

beforeEach(() => {
  vi.unstubAllGlobals()
  _resetAbPreco()
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { abPreco: flag } }))
})

describe('PrecoCompleta', () => {
  it('SSR always renders the A price', async () => {
    comBraco('B', true)
    expect(nbsp(await ssr())).toContain('R$ 44,90')
  })

  it('arm B sees 39,90 after mount; arm A keeps 44,90', async () => {
    comBraco('B', true)
    const b = mount(PrecoCompleta); await nextTick()
    expect(nbsp(b.text())).toBe('R$ 39,90')
    _resetAbPreco(); comBraco('A', true)
    const a = mount(PrecoCompleta); await nextTick()
    expect(nbsp(a.text())).toBe('R$ 44,90')
  })

  it('first fold: number hidden in SSR with the test on (both arms), visible after mount', async () => {
    for (const v of ['A', 'B']) {
      comBraco(v, true)
      expect(await ssr({ dobra: true })).toContain('visibility:hidden')
      const w = mount(PrecoCompleta, { props: { dobra: true } }); await nextTick()
      expect(w.html()).not.toContain('visibility')
    }
  })

  it('test off: same HTML as before (no hidden span), A price even with B stored', async () => {
    comBraco('B', false)
    const html = await ssr({ dobra: true })
    expect(html).not.toContain('visibility')
    expect(nbsp(html)).toContain('R$ 44,90')
    expect(nbsp(mount(PrecoCompleta, { props: { dobra: true } }).text())).toBe('R$ 44,90')
  })
})

describe('TextoComPreco', () => {
  it('splits on the table price, with a regular or a non-breaking space', () => {
    expect(partesComPreco('Custa R$ 44,90, no Pix.')).toEqual(['Custa ', { espaco: ' ' }, ', no Pix.'])
    expect(partesComPreco(`por ${precoBRL(4490)} e ${precoBRL(4490)}`)).toEqual(['por ', { espaco: ' ' }, ' e ', { espaco: ' ' }, ''])
    expect(partesComPreco('sem preço')).toEqual(['sem preço'])
  })

  it('test off: SSR HTML is byte-identical to the original text (both separators)', async () => {
    comBraco('B', false)
    for (const texto of ['Custa R$ 44,90, no Pix.', `Por ${precoBRL(4490)}, uma vez.`]) {
      const html = await renderToString(createSSRApp({ render: () => h('p', [h(TextoComPreco, { texto, dobra: true })]) }))
      expect(html.replace(/<!--[\s\S]*?-->/g, '')).toBe(`<p>${texto}</p>`)
    }
  })

  it('SSR renders A; after mount arm B sees 39,90 in a section text', async () => {
    comBraco('B', true)
    const texto = `O relatório completo, por ${precoBRL(4490)}, traz tudo.`
    const html = await renderToString(createSSRApp({ render: () => h('p', [h(TextoComPreco, { texto })]) }))
    expect(nbsp(html)).toContain('R$ 44,90')
    const w = mount({ render: () => h('p', [h(TextoComPreco, { texto })]) }); await nextTick()
    expect(nbsp(w.element.textContent || '')).toBe('O relatório completo, por R$ 39,90, traz tudo.')
  })

  it('renders the arm price inside the text', async () => {
    comBraco('B', true)
    const w = mount({ render: () => h('p', [h(TextoComPreco, { texto: 'Custa R$ 44,90, no Pix.' })]) }); await nextTick()
    expect(nbsp(w.element.textContent || '')).toBe('Custa R$ 39,90, no Pix.')
  })
})
