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
  it('URL externa nunca vira <img>: cai no proxy deduzido da marca', async () => {
    const w = mount(MarcaLogo, { props: { marca: 'M.BENZ/C180', logoUrl: 'https://apiplacas.com.br/logos/logosMarcas/m.benz.png' } })
    await flushPromises()
    expect(w.find('img').attributes('src')).toBe('/api/logo-marca/m.benz.png')
    await w.find('img').trigger('error')
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('.ml__mono').text()).toBe('M')
  })

  // Caso RMB6B90: a fonte nao mandou logo e a BYD nao tem path.
  it('sem logoUrl: BYD usa o proxy pelo nome da marca', async () => {
    const w = mount(MarcaLogo, { props: { marca: 'I/BYD SONG PLUS PREM DM', logoUrl: null } })
    await flushPromises()
    expect(w.find('img').attributes('src')).toBe('/api/logo-marca/byd.png')
  })

  for (const [marca, arquivo] of [
    ['CAOA CHERY/TIGGO 5X', 'caoachery.png'],
    ['I/CHERY TIGGO 7', 'chery.png'],
    ['I/ZEEKR 001', 'zeekr.png'],
    ['I/GAC AION Y', 'gac.png'],
    ['OMODA/5', 'omoda.png'],
    ['JAECOO/7', 'jaecoo.png'],
  ]) {
    it(`${marca}: tenta /api/logo-marca/${arquivo}`, async () => {
      const w = mount(MarcaLogo, { props: { marca } })
      await flushPromises()
      expect(w.find('img').attributes('src')).toBe(`/api/logo-marca/${arquivo}`)
    })
  }

  it('logo da fonte falhou: tenta o deduzido antes do monograma', async () => {
    const w = mount(MarcaLogo, { props: { marca: 'I/BYD DOLPHIN', logoUrl: '/api/logo-marca/byd2.png' } })
    await flushPromises()
    expect(w.find('img').attributes('src')).toBe('/api/logo-marca/byd2.png')
    await w.find('img').trigger('error')
    expect(w.find('img').attributes('src')).toBe('/api/logo-marca/byd.png')
    await w.find('img').trigger('error')
    expect(w.find('.ml__mono').text()).toBe('B')
  })

  it('so mostra imagem depois de montar (nada de <img> no SSR)', () => {
    // mount() ja roda onMounted; aqui so garante que marca com path nunca vira img.
    const w = mount(MarcaLogo, { props: { marca: 'VW/GOL' } })
    expect(w.find('img').exists()).toBe(false)
  })

  // Logo oficial local (22/out/2026): GWM e HAVAL usam /logos-marcas/gwm.png,
  // antes do logo da fonte e do proxy. "I/" nunca vira a marca "I".
  for (const marca of ['I/GWM HAVAL H6 HEV2', 'GWM/HAVAL H6 PHEV', 'HAVAL/H6']) {
    it(`${marca}: asset local da GWM, ignora i.png da fonte`, async () => {
      const w = mount(MarcaLogo, { props: { marca, logoUrl: '/api/logo-marca/i.png' } })
      await flushPromises()
      expect(w.find('img').attributes('src')).toBe('/logos-marcas/gwm.png')
      expect(w.find('img').classes()).toContain('ml__img--local')
      expect(w.find('.ml__mono').exists()).toBe(false)
    })
  }
  it('logoUrl "i.png" (prefixo de importado) e descartado; marca segue pelo nome', async () => {
    const w = mount(MarcaLogo, { props: { marca: 'I/BYD DOLPHIN', logoUrl: '/api/logo-marca/i.png' } })
    await flushPromises()
    expect(w.find('img').attributes('src')).toBe('/api/logo-marca/byd.png')
  })
  it('I/TOYOTA e CHEV/PRISMA seguem na simple-icons', async () => {
    for (const marca of ['I/TOYOTA HILUX CDSRXA4FD', 'CHEV/PRISMA 1.4MT LT']) {
      const w = mount(MarcaLogo, { props: { marca, logoUrl: '/api/logo-marca/i.png' } })
      await flushPromises()
      expect(w.find('svg').exists(), marca).toBe(true)
    }
  })
})
