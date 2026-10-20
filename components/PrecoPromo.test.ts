import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PrecoPromo from './PrecoPromo.vue'
import { PLANOS } from '../shared/planos'

// Desde 20/out/2026 nao ha promocao (completa R$ 44,90, sem "de"): o
// componente nao renderiza nada. Os casos com promocao simulam um "de" so no
// teste, pra o componente continuar pronto quando houver outra.
afterEach(() => { delete (PLANOS.completa as any).precoDeCentavos })

describe('PrecoPromo sem promocao (hoje)', () => {
  it('nao renderiza nada em nenhum plano nem variante', () => {
    for (const props of [{}, { soDe: true }, { inline: true }, { plano: 'basica' }]) {
      expect(mount(PrecoPromo, { props: props as any }).find('.pp__de').exists()).toBe(false)
    }
  })
})

describe('PrecoPromo com promocao (simulada)', () => {
  it('Promoção, de riscado e por em destaque, os dois de planos.ts', () => {
    ;(PLANOS.completa as any).precoDeCentavos = 4990
    const w = mount(PrecoPromo)
    expect(w.find('.pp__tag').text()).toBe('Promoção')
    expect(w.find('s.pp__de').text()).toBe('de R$ 49,90')
    expect(w.find('strong.pp__por').text()).toBe('por R$ 44,90')
    expect(w.text()).not.toContain('—')
  })
  it('soDe: so rotulo e preco antigo; inline: dentro da frase', () => {
    ;(PLANOS.completa as any).precoDeCentavos = 4990
    const w = mount(PrecoPromo, { props: { soDe: true } })
    expect(w.find('s.pp__de').text()).toBe('de R$ 49,90')
    expect(w.find('.pp__por').exists()).toBe(false)
    expect(mount(PrecoPromo, { props: { inline: true } }).classes()).toContain('pp--inline')
  })
  it('"de" menor ou igual ao cobrado nao e promocao', () => {
    ;(PLANOS.completa as any).precoDeCentavos = 4490
    expect(mount(PrecoPromo).find('.pp__de').exists()).toBe(false)
  })
})
