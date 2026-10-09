import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PrecoPromo from './PrecoPromo.vue'

describe('PrecoPromo', () => {
  it('Promoção, de riscado e por em destaque', () => {
    const w = mount(PrecoPromo)
    expect(w.find('.pp__tag').text()).toBe('Promoção')
    expect(w.find('s.pp__de').text()).toBe('de R$ 44,90')
    expect(w.find('strong.pp__por').text()).toBe('por R$ 39,90')
    expect(w.text()).not.toContain('—')
  })
  it('plano sem promocao nao renderiza', () => {
    expect(mount(PrecoPromo, { props: { plano: 'basica' } }).html()).not.toContain('pp__de')
  })
})

describe('PrecoPromo variantes', () => {
  it('soDe: so rotulo e preco antigo (o atual ja aparece grande ao lado)', () => {
    const w = mount(PrecoPromo, { props: { soDe: true } })
    expect(w.find('s.pp__de').text()).toBe('de R$ 44,90')
    expect(w.find('.pp__por').exists()).toBe(false)
  })
  it('inline: dentro da frase', () => {
    expect(mount(PrecoPromo, { props: { inline: true } }).classes()).toContain('pp--inline')
  })
})
