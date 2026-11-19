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
    // No checkout o card nasce na tela: "visto" ao aparecer.
    eventos.length = 0
    mount(OfertaSegundaPlaca, { props: { token: 't', onde: 'checkout' } })
    await flushPromises()
    expect(eventos).toContain('bump_visto')
  })
  it('tells the parent when there is an offer, and stays quiet without one', async () => {
    vi.stubGlobal('$fetch', async () => ({ bump: { codigo: 'SEGUNDAABC234', validoAte: '2026-11-05T18:30:00Z', precoCentavos: 2990 } }))
    const com = mount(OfertaSegundaPlaca, { props: { token: 't', onde: 'relatorio' } })
    await flushPromises()
    expect(com.emitted('oferta')).toEqual([[true]])
    vi.stubGlobal('$fetch', async () => ({ bump: null }))
    const sem = mount(OfertaSegundaPlaca, { props: { token: 't', onde: 'relatorio' } })
    await flushPromises()
    expect(sem.emitted('oferta')).toBeUndefined()
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
  it('on the report, counts as seen only once half of the card is on screen, and only once', async () => {
    const instancias: any[] = []
    class FakeIO {
      cb: any
      constructor(cb: any) { this.cb = cb; instancias.push(this) }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', FakeIO)
    vi.stubGlobal('$fetch', async () => ({ bump: { codigo: 'SEGUNDAABC234', validoAte: '2026-11-05T18:30:00Z', precoCentavos: 2990 } }))
    eventos.length = 0
    mount(OfertaSegundaPlaca, { props: { token: 't', onde: 'relatorio' } })
    await flushPromises()
    expect(eventos).not.toContain('bump_visto')
    // The observer also fires when the card starts to enter (10% visible): not seen yet.
    instancias[0].cb([{ isIntersecting: true, intersectionRatio: 0.1 }])
    expect(eventos).not.toContain('bump_visto')
    instancias[0].cb([{ isIntersecting: true, intersectionRatio: 0.6 }])
    instancias[0].cb([{ isIntersecting: true, intersectionRatio: 0.6 }])
    expect(eventos.filter((e) => e === 'bump_visto')).toHaveLength(1)
    vi.unstubAllGlobals()
  })
})

