import { describe, it, expect } from 'vitest'
import { logoProxyDe, arquivoLogoValido } from './logo-marca'

describe('logoProxyDe', () => {
  it('apiplacas vira caminho do nosso proxy', () => {
    expect(logoProxyDe('https://apiplacas.com.br/logos/logosMarcas/jac.png')).toBe('/api/logo-marca/jac.png')
    expect(logoProxyDe('https://apiplacas.com.br/logos/logosMarcas/m.benz.png')).toBe('/api/logo-marca/m.benz.png')
  })
  it('qualquer outra coisa: null', () => {
    for (const u of [
      'http://apiplacas.com.br/logos/logosMarcas/jac.png',
      'https://evil.com/logos/logosMarcas/jac.png',
      'https://apiplacas.com.br.evil.com/logos/logosMarcas/jac.png',
      'https://apiplacas.com.br/outra/jac.png',
      'https://apiplacas.com.br/logos/logosMarcas/../x.png',
      'https://apiplacas.com.br/logos/logosMarcas/a/b.png',
      'https://apiplacas.com.br/logos/logosMarcas/jac.svg',
      'https://apiplacas.com.br/logos/logosMarcas/jac.png?x=1',
      'https://apiplacas.com.br:8443/logos/logosMarcas/jac.png',
      'javascript:alert(1)', '', null, 42,
    ]) expect(logoProxyDe(u)).toBeNull()
  })
  it('nome de arquivo', () => {
    expect(arquivoLogoValido('m.b..png')).toBe(false)
    expect(arquivoLogoValido('.png')).toBe(false)
    expect(arquivoLogoValido('..png')).toBe(false)
    expect(arquivoLogoValido('caoachery.png')).toBe(true)
  })
})
