import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed } from 'vue'
import { readFileSync } from 'node:fs'

;(globalThis as any).computed = computed
const { default: MarcaLogo } = await import('./MarcaLogo.vue')

describe('MarcaLogo', () => {
  for (const marca of ['JAC/V260', 'I/JAC V260', 'IMP/JAC J3', 'JAC', 'jac/t40']) {
    it(`${marca}: logo oficial da JAC servido do public/`, () => {
      const w = mount(MarcaLogo, { props: { marca } })
      const img = w.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe('/marcas/jac.svg')
      expect(w.find('.ml__mono').exists()).toBe(false)
    })
  }
  it('Fiat continua na simple-icons (svg inline)', () => {
    const w = mount(MarcaLogo, { props: { marca: 'FIAT/ARGO' } })
    expect(w.find('svg path').exists()).toBe(true)
    expect(w.find('img').exists()).toBe(false)
  })
  it('marca sem logo cai no monograma', () => {
    const w = mount(MarcaLogo, { props: { marca: 'CAOA CHERY/TIGGO' } })
    expect(w.find('.ml__mono').text()).toBe('C')
  })
  it('arquivo local, sem link externo nem script', () => {
    const svg = readFileSync('public/marcas/jac.svg', 'utf8')
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)|<script|on\w+=/i)
  })
})
