import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoteCarrossel from './LoteCarrossel.vue'

const foto = (i: number) => ({ tipo: 'foto' as const, src: `/api/premium/foto?token=T&ref=r${i}`, alt: `Foto ${i + 1}` })

describe('LoteCarrossel', () => {
  it('contador "1/18" e so a atual e a vizinha carregadas', () => {
    const w = mount(LoteCarrossel, { props: { midias: Array.from({ length: 18 }, (_, i) => foto(i)) } })
    expect(w.find('.lc__cont').text()).toBe('1/18')
    expect(w.findAll('img')).toHaveLength(2)
    expect(w.findAll('.lc__slide')).toHaveLength(18)
  })
  it('seta avanca, carrega a vizinha e atualiza o contador', async () => {
    const w = mount(LoteCarrossel, { props: { midias: Array.from({ length: 5 }, (_, i) => foto(i)) }, attachTo: document.body })
    const trilho = w.find('.lc__trilho').element as HTMLElement
    ;(trilho as any).scrollTo = () => {}
    await w.find('.lc__seta--dir').trigger('click')
    expect(w.find('.lc__cont').text()).toBe('2/5')
    expect(w.findAll('img')).toHaveLength(3)
    expect(w.find('.lc__seta--esq').attributes('disabled')).toBeUndefined()
    w.unmount()
  })
  it('video com controls e preload="none"; embed e link da leiloeira', () => {
    const w = mount(LoteCarrossel, { props: { midias: [
      { tipo: 'video', src: '/api/premium/foto?token=T&ref=v', alt: 'Vídeo 1' },
      { tipo: 'embed', src: 'https://www.youtube-nocookie.com/embed/x', alt: 'Vídeo 2' },
      { tipo: 'link', src: 'https://leiloeira/grande.mp4', alt: 'Vídeo 3' },
    ] } })
    const v = w.find('video')
    expect(v.attributes('preload')).toBe('none')
    expect(v.attributes('controls')).toBeDefined()
    expect(v.attributes('src')).toBe('/api/premium/foto?token=T&ref=v')
    expect(w.find('iframe').attributes('src')).toBe('https://www.youtube-nocookie.com/embed/x')
    expect(w.find('.lc__grande').attributes('href')).toBe('https://leiloeira/grande.mp4')
    expect(w.find('.lc__grande').text()).not.toContain('—')
  })
  it('uma foto so: sem setas nem contador; vazio: nada', () => {
    const w = mount(LoteCarrossel, { props: { midias: [foto(0)] } })
    expect(w.find('.lc__seta').exists()).toBe(false)
    expect(w.find('.lc__cont').exists()).toBe(false)
    expect(mount(LoteCarrossel, { props: { midias: [] } }).find('.lc').exists()).toBe(false)
  })
})
