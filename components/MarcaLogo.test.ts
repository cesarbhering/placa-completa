import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MarcaLogo from './MarcaLogo.vue'

describe('MarcaLogo', () => {
  for (const marca of ['JAC/V260', 'I/JAC V260', 'IMP/JAC J3', 'JAC', 'jac/t40']) {
    it(`${marca}: path monocromatico da JAC (nossa base), viewBox largo`, () => {
      const w = mount(MarcaLogo, { props: { marca, logoUrl: '/api/logo-marca/jac.png' } })
      expect(w.find('svg').attributes('viewBox')).toBe('0 0 118 25')
      expect(w.find('svg path').attributes('d')).toMatch(/^M117\.9/)
      expect(w.find('img').exists()).toBe(false)
      expect(w.find('.ml__mono').exists()).toBe(false)
    })
  }
  it('Fiat continua na simple-icons, ignora o logoUrl', async () => {
    const w = mount(MarcaLogo, { props: { marca: 'FIAT/ARGO', logoUrl: '/api/logo-marca/fiat.png' } })
    await flushPromises()
    expect(w.find('svg').attributes('viewBox')).toBe('0 0 24 24')
    expect(w.find('img').exists()).toBe(false)
  })
  it('sem path: usa o logo da apiplacas pelo NOSSO proxy', async () => {
    const w = mount(MarcaLogo, { props: { marca: 'M.BENZ/C180', logoUrl: '/api/logo-marca/m.benz.png' } })
    await flushPromises()
    expect(w.find('img').attributes('src')).toBe('/api/logo-marca/m.benz.png')
  })
  it('logo falhou ao carregar: some e entra o monograma', async () => {
    const w = mount(MarcaLogo, { props: { marca: 'M.BENZ/C180', logoUrl: '/api/logo-marca/m.benz.png' } })
    await flushPromises()
    await w.find('img').trigger('error')
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('.ml__mono').text()).toBe('M')
  })
  it('URL externa nunca vira <img>', async () => {
    const w = mount(MarcaLogo, { props: { marca: 'M.BENZ/C180', logoUrl: 'https://apiplacas.com.br/logos/logosMarcas/m.benz.png' } })
    await flushPromises()
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('.ml__mono').text()).toBe('M')
  })
})
