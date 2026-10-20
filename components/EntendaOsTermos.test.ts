import { describe, it, expect } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import EntendaOsTermos from './EntendaOsTermos.vue'

describe('EntendaOsTermos', () => {
  it('linka os 5 artigos /o-que-e', () => {
    const w = mount(EntendaOsTermos, { global: { stubs: { NuxtLink: RouterLinkStub } } })
    const tos = w.findAllComponents(RouterLinkStub).map((l) => l.props('to'))
    expect(tos).toEqual(['/o-que-e/renavam', '/o-que-e/gravame', '/o-que-e/intencao-de-gravame', '/o-que-e/renajud', '/o-que-e/multas-renainf'])
    expect(w.text()).toContain('Entenda os termos')
    expect(w.text()).not.toContain('—')
  })
  it('compacto: sem o resumo', () => {
    const w = mount(EntendaOsTermos, { props: { compacto: true }, global: { stubs: { NuxtLink: RouterLinkStub } } })
    expect(w.text()).not.toContain('financiamento')
  })
})
