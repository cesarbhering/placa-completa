import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import VersoesCompativeis from './VersoesCompativeis.vue'

const VERSOES = [
  { codigo_fipe: '002061-3', modelo: 'Corolla XEi 1.8/1.8 Flex 16V Aut.', valor: 34812 },
  { codigo_fipe: '002028-1', modelo: 'Corolla XEi 1.8/1.8 Flex 16V Mec.', valor: 34067 },
]
const SERIE = [{ label: 'Jan/25', price: 30000 }, { label: 'Fev/25', price: 29500 }]
const stubs = { GraficoValor: { props: ['historico'], template: '<div class="grafico">{{ historico.length }}</div>' } }

describe('VersoesCompativeis (acordeao)', () => {
  let fetchMock: any
  beforeEach(() => {
    fetchMock = vi.fn(async () => ({ historico: SERIE }))
    vi.stubGlobal('$fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('lista igual a de hoje (modelo e valor), tudo fechado no inicio, sem buscar nada', () => {
    const w = mount(VersoesCompativeis, { props: { versoes: VERSOES, token: 'TOKEN123' }, global: { stubs } })
    const cabs = w.findAll('button.vc__cab')
    expect(cabs).toHaveLength(2)
    expect(cabs[0].text()).toContain('Corolla XEi 1.8/1.8 Flex 16V Aut.')
    expect(cabs[0].text()).toMatch(/R\$\s?34\.812/)
    expect(cabs.every((b) => b.attributes('aria-expanded') === 'false')).toBe(true)
    expect(w.find('.grafico').exists()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('abrir busca o historico daquela versao e mostra o grafico', async () => {
    const w = mount(VersoesCompativeis, { props: { versoes: VERSOES, token: 'TOKEN123' }, global: { stubs } })
    await w.findAll('button.vc__cab')[0].trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/premium/fipe-historico', { query: { token: 'TOKEN123', codigo: '002061-3' } })
    expect(w.findAll('.grafico')).toHaveLength(1)
  })

  it('so um aberto por vez; clicar de novo fecha; nao busca de novo', async () => {
    const w = mount(VersoesCompativeis, { props: { versoes: VERSOES, token: 'TOKEN123' }, global: { stubs } })
    const cabs = () => w.findAll('button.vc__cab')
    await cabs()[0].trigger('click'); await flushPromises()
    await cabs()[1].trigger('click'); await flushPromises()
    expect(cabs()[0].attributes('aria-expanded')).toBe('false')
    expect(cabs()[1].attributes('aria-expanded')).toBe('true')
    expect(w.findAll('.vc__painel')).toHaveLength(1)
    await cabs()[1].trigger('click')
    expect(w.findAll('.vc__painel')).toHaveLength(0)
    await cabs()[0].trigger('click'); await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('sem historico ou erro: aviso no lugar do grafico', async () => {
    fetchMock.mockResolvedValueOnce({ historico: [] }).mockRejectedValueOnce(new Error('404'))
    const w = mount(VersoesCompativeis, { props: { versoes: VERSOES, token: 'TOKEN123' }, global: { stubs } })
    await w.findAll('button.vc__cab')[0].trigger('click'); await flushPromises()
    expect(w.find('.vc__msg').text()).toContain('indisponível')
    await w.findAll('button.vc__cab')[1].trigger('click'); await flushPromises()
    expect(w.find('.vc__msg').text()).toContain('Tentar de novo')
  })
})
