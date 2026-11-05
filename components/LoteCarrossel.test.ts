import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import LoteCarrossel from './LoteCarrossel.vue'

const foto = (i: number) => ({ tipo: 'foto' as const, src: `/api/premium/foto?token=T&ref=r${i}`, alt: `Foto ${i + 1}` })
const lb = () => document.body.querySelector('.lc-lb')

afterEach(() => { document.body.innerHTML = '' })

describe('LoteCarrossel (grade de miniaturas + lightbox)', () => {
  it('grade: ate 8 miniaturas, a ultima vira "+N"; lightbox fechado', () => {
    const w = mount(LoteCarrossel, { props: { midias: Array.from({ length: 18 }, (_, i) => foto(i)) }, attachTo: document.body })
    expect(w.findAll('.lc__mini')).toHaveLength(8)
    expect(w.find('.lc__mais').text()).toBe('+11')
    expect(w.findAll('.lc__mini-img').every((i) => i.attributes('loading') === 'lazy')).toBe(true)
    expect(lb()).toBeNull()
    w.unmount()
  })
  it('ate 8 midias: todas viram miniatura, sem "+N"', () => {
    const w = mount(LoteCarrossel, { props: { midias: Array.from({ length: 8 }, (_, i) => foto(i)) } })
    expect(w.findAll('.lc__mini')).toHaveLength(8)
    expect(w.find('.lc__mais').exists()).toBe(false)
  })
  it('clicar na miniatura abre o lightbox nela, com a vizinha carregada; seta e Esc', async () => {
    const w = mount(LoteCarrossel, { props: { midias: Array.from({ length: 5 }, (_, i) => foto(i)) }, attachTo: document.body })
    await w.findAll('.lc__mini')[2].trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(lb()).not.toBeNull()
    expect(document.body.querySelector('.lc-lb__cont')?.textContent).toBe('3/5')
    expect(document.body.querySelectorAll('.lc-lb__img')).toHaveLength(3)
    const trilho = document.body.querySelector('.lc-lb__trilho') as any
    trilho.scrollTo = () => {}
    ;(document.body.querySelector('.lc-lb__seta--dir') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r, 0))
    expect(document.body.querySelector('.lc-lb__cont')?.textContent).toBe('4/5')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await new Promise((r) => setTimeout(r, 0))
    expect(lb()).toBeNull()
    w.unmount()
  })
  it('video com controls e preload="none"; embed e link da leiloeira no lightbox', async () => {
    const w = mount(LoteCarrossel, { props: { midias: [
      { tipo: 'video', src: '/api/premium/foto?token=T&ref=v', alt: 'Vídeo 1' },
      { tipo: 'embed', src: 'about:blank#embed-x', alt: 'Vídeo 2' },
      { tipo: 'link', src: 'https://leiloeira/grande.mp4', alt: 'Vídeo 3' },
    ] }, attachTo: document.body })
    expect(w.findAll('.lc__mini-video')).toHaveLength(3)
    await w.findAll('.lc__mini')[1].trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    const v = document.body.querySelector('video')!
    expect(v.getAttribute('preload')).toBe('none')
    expect(v.hasAttribute('controls')).toBe(true)
    expect(document.body.querySelector('iframe')?.getAttribute('src')).toBe('about:blank#embed-x')
    const grande = document.body.querySelector('.lc-lb__grande')!
    expect(grande.getAttribute('href')).toBe('https://leiloeira/grande.mp4')
    expect(grande.textContent).not.toContain('—')
    w.unmount()
  })
  it('uma foto so: miniatura unica, lightbox sem setas; vazio: nada', async () => {
    const w = mount(LoteCarrossel, { props: { midias: [foto(0)] }, attachTo: document.body })
    expect(w.find('.lc__grade--um').exists()).toBe(true)
    await w.find('.lc__mini').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(document.body.querySelector('.lc-lb__seta')).toBeNull()
    expect(mount(LoteCarrossel, { props: { midias: [] } }).find('.lc').exists()).toBe(false)
    w.unmount()
  })
})
