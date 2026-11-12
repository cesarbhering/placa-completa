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
    const w = mount(MarcaLogo, { props: { marca: 'HAFEI/TOWNER', logoUrl: '/api/logo-marca/hafei.png' } })
    await flushPromises()
    expect(w.find('img').attributes('src')).toBe('/api/logo-marca/hafei.png')
  })
  it('logo falhou ao carregar: some e entra o monograma', async () => {
    const w = mount(MarcaLogo, { props: { marca: 'HAFEI/TOWNER', logoUrl: '/api/logo-marca/hafei.png' } })
    await flushPromises()
    await w.find('img').trigger('error')
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('.ml__mono').text()).toBe('H')
  })
  it('URL externa nunca vira <img>: cai no proxy deduzido da marca', async () => {
    const w = mount(MarcaLogo, { props: { marca: 'HAFEI/TOWNER', logoUrl: 'https://apiplacas.com.br/logos/logosMarcas/hafei.png' } })
    await flushPromises()
    expect(w.find('img').attributes('src')).toBe('/api/logo-marca/hafei.png')
    await w.find('img').trigger('error')
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('.ml__mono').text()).toBe('H')
  })


  for (const [marca, arquivo] of [
    ['I/GAC AION Y', 'gac.png'],
  ]) {
    it(`${marca}: tenta /api/logo-marca/${arquivo}`, async () => {
      const w = mount(MarcaLogo, { props: { marca } })
      await flushPromises()
      expect(w.find('img').attributes('src')).toBe(`/api/logo-marca/${arquivo}`)
    })
  }

  it('logo da fonte falhou: tenta o deduzido antes do monograma', async () => {
    const w = mount(MarcaLogo, { props: { marca: 'I/GAC AION Y', logoUrl: '/api/logo-marca/gac2.png' } })
    await flushPromises()
    expect(w.find('img').attributes('src')).toBe('/api/logo-marca/gac2.png')
    await w.find('img').trigger('error')
    expect(w.find('img').attributes('src')).toBe('/api/logo-marca/gac.png')
    await w.find('img').trigger('error')
    expect(w.find('.ml__mono').text()).toBe('G')
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
  // KAWASAKI e BAJAJ (11/nov/2026): asset local largo, nada da simple-icons.
  for (const [marca, arquivo] of [
    ['KAWASAKI/NINJA 400', 'kawasaki'], ['I/KAWASAKI Z900', 'kawasaki'], ['IMP/KAWASAKI VERSYS', 'kawasaki'],
    ['kawasaki/z1000', 'kawasaki'], ['KAWASAKI', 'kawasaki'],
    ['BAJAJ/DOMINAR 400', 'bajaj'], ['I/BAJAJ PULSAR', 'bajaj'], ['BAJAJ', 'bajaj'],
  ] as const) {
    it(`${marca}: asset local ${arquivo}.png, caixa larga`, async () => {
      const w = mount(MarcaLogo, { props: { marca, logoUrl: '/api/logo-marca/i.png' } })
      await flushPromises()
      expect(w.find('img').attributes('src')).toBe(`/logos-marcas/${arquivo}.png`)
      expect(w.find('img').classes()).toContain('ml__img--local')
      expect(w.find('.ml').classes()).toContain('ml--larga')
      expect(w.find('svg').exists()).toBe(false)
      expect(w.find('.ml__mono').exists()).toBe(false)
    })
  }
  // Lote de 12/nov/2026: a consulta entrega "I/M.BENZ CLA200" e a Mercedes
  // saia so com o "M". Todas as grafias caem no asset local.
  for (const [marca, arquivo, largo] of [
    ['I/M.BENZ CLA200', 'mercedes', false], ['M.BENZ/C180', 'mercedes', false], ['IMP/M.BENZ GLA 200', 'mercedes', false],
    ['MBENZ/A200', 'mercedes', false], ['MERCEDES-BENZ/SPRINTER', 'mercedes', false],
    ['MERCEDES BENZ/ACCELO', 'mercedes', false], ['MB/AXOR', 'mercedes', false], ['m.benz/c200', 'mercedes', false],
    ['I/LR DISCOVERY SPORT', 'landrover', true], ['LAND ROVER/DEFENDER', 'landrover', true], ['I/LAND ROVER EVOQUE', 'landrover', true],
    ['DAF/XF FTT 530', 'daf', true],
    ['I/HARLEY DAVIDSON FLHX', 'harley', false], ['H.DAVIDSON/XL883', 'harley', false], ['HARLEY-DAVIDSON/FAT BOY', 'harley', false],
    ['CAOACHERY/TIGGO 5X', 'chery', true], ['CAOA CHERY/TIGGO 7', 'chery', true], ['I/CHERY TIGGO 7', 'chery', true],
    ['I/LAMBORGHINI HURACAN', 'lamborghini', true],
    ['I/JAGUAR F-PACE', 'jaguar', true],
    ['I/BYD SONG PLUS PREM DM', 'byd', true], ['BYD/DOLPHIN MINI', 'byd', true],
    ['TROLLER/T4 XLT', 'troller', false],
    ['I/GEELY EX5', 'geely', true], ['GEELY/EX2', 'geely', true],
    ['I/ZEEKR 001', 'zeekr', true], ['ZEEKR/X', 'zeekr', true],
    ['I/OMODA 5', 'omoda', true], ['OMODA/E5', 'omoda', true],
    ['I/JAECOO 7', 'jaecoo', true], ['JAECOO/7 SHS', 'jaecoo', true],
  ] as const) {
    it(`${marca}: asset local ${arquivo}.png`, async () => {
      const w = mount(MarcaLogo, { props: { marca, logoUrl: null } })
      await flushPromises()
      expect(w.find('img').attributes('src')).toBe(`/logos-marcas/${arquivo}.png`)
      expect(w.find('img').classes()).toContain('ml__img--local')
      expect(w.find('.ml').classes().includes('ml--larga')).toBe(largo)
      expect(w.find('.ml__mono').exists()).toBe(false)
    })
  }
  it('Mercedes: asset local vence o logoUrl da fonte', async () => {
    const w = mount(MarcaLogo, { props: { marca: 'I/M.BENZ CLA200', logoUrl: '/api/logo-marca/m.benz.png' } })
    await flushPromises()
    expect(w.find('img').attributes('src')).toBe('/logos-marcas/mercedes.png')
  })
  it('GWM segue na caixa quadrada', async () => {
    const w = mount(MarcaLogo, { props: { marca: 'GWM/HAVAL H6' } })
    await flushPromises()
    expect(w.find('.ml').classes()).not.toContain('ml--larga')
  })
  it('logoUrl "i.png" (prefixo de importado) e descartado; marca segue pelo nome', async () => {
    const w = mount(MarcaLogo, { props: { marca: 'I/GAC AION Y', logoUrl: '/api/logo-marca/i.png' } })
    await flushPromises()
    expect(w.find('img').attributes('src')).toBe('/api/logo-marca/gac.png')
  })
  it('I/TOYOTA, CHEV/PRISMA e JTA/SUZUKI seguem na simple-icons', async () => {
    for (const marca of ['I/TOYOTA HILUX CDSRXA4FD', 'CHEV/PRISMA 1.4MT LT', 'JTA/SUZUKI EN125 YES']) {
      const w = mount(MarcaLogo, { props: { marca, logoUrl: '/api/logo-marca/i.png' } })
      await flushPromises()
      expect(w.find('svg').exists(), marca).toBe(true)
    }
  })
})
