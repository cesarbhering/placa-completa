import { describe, it, expect } from 'vitest'
import { logoProxyDaMarca } from './logo-marca-arquivo'
import { arquivoLogoValido } from '../server/utils/logo-marca'

describe('logoProxyDaMarca', () => {
  it('marca vira arquivo do proxy', () => {
    expect(logoProxyDaMarca('BYD')).toBe('/api/logo-marca/byd.png')
    expect(logoProxyDaMarca('GWM')).toBe('/api/logo-marca/greatwall.png')
    expect(logoProxyDaMarca('CAOA')).toBe('/api/logo-marca/caoachery.png')
    expect(logoProxyDaMarca('M.BENZ')).toBe('/api/logo-marca/m.benz.png')
  })
  it('token invalido nao vira caminho', () => {
    expect(logoProxyDaMarca('')).toBeNull()
    expect(logoProxyDaMarca(null)).toBeNull()
    expect(logoProxyDaMarca('../x')).toBeNull()
    expect(logoProxyDaMarca('A..B')).toBeNull()
  })
  it('todo arquivo gerado passa na validacao do proxy', () => {
    for (const m of ['BYD', 'GWM', 'CAOA', 'CHERY', 'HAVAL', 'ZEEKR', 'GAC', 'OMODA', 'JAECOO', 'M.BENZ']) {
      const u = logoProxyDaMarca(m)!
      expect(arquivoLogoValido(u.replace('/api/logo-marca/', ''))).toBe(true)
    }
  })
})
