import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed, onMounted } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('onMounted', onMounted)
const eventos: string[] = []
vi.mock('~/composables/useAnalytics', () => ({ enfileirarEventoFunil: (e: string) => { eventos.push(e) } }))

const { default: OfertaSegundaPlaca } = await import('./OfertaSegundaPlaca.vue')

describe('oferta de segunda placa', () => {
  it('com cupom: frase, prazo e link com o cupom e origem bump', async () => {
    vi.stubGlobal('$fetch', async () => ({ bump: { codigo: 'SEGUNDAABC234', validoAte: '2026-11-05T18:30:00Z', precoCentavos: 2990 } }))
    const w = mount(OfertaSegundaPlaca, { props: { token: 't', onde: 'relatorio' } })
    await flushPromises()
    expect(w.find('.osp__t').text().replace(/\u00a0/g, ' ')).toBe('Consultar uma segunda placa com o relatório completo por R$ 29,90')
    expect(w.find('.osp__s').text()).toBe('Vale até 05/11 às 15h30, uma vez, para o e-mail desta compra.')
    expect(w.find('a').attributes('href')).toBe('/?plano=completa&cupom=SEGUNDAABC234&origem=bump')
    expect(w.text()).not.toContain('—')
    expect(eventos).toContain('bump_visto')
  })
  it('sem cupom ou com erro: nada aparece', async () => {
    vi.stubGlobal('$fetch', async () => ({ bump: null }))
    const a = mount(OfertaSegundaPlaca, { props: { token: 't', onde: 'checkout' } })
    await flushPromises()
    expect(a.html()).toBe('<!--v-if-->')
    vi.stubGlobal('$fetch', async () => { throw new Error('x') })
    const b = mount(OfertaSegundaPlaca, { props: { token: 't', onde: 'checkout' } })
    await flushPromises()
    expect(b.find('.osp').exists()).toBe(false)
  })
})
