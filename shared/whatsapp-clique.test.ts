import { describe, it, expect, vi, afterEach } from 'vitest'
import { origemDoClique, validarClique, assuntoClique, textoClique, ondeDoClique, avisarCliqueWhatsapp } from './whatsapp-clique'

describe('origemDoClique', () => {
  it('Bing by msclkid or utm_source, Google by gclid', () => {
    expect(origemDoClique({ msclkid: 'x' })).toBe('bing')
    expect(origemDoClique({ utm_source: 'Bing' })).toBe('bing')
    expect(origemDoClique({ gclid: 'y' })).toBe('google')
  })
  it('another utm source is another campaign; nothing stored is no ad', () => {
    expect(origemDoClique({ utm_source: 'newsletter' })).toBe('outra_campanha')
    expect(origemDoClique(undefined)).toBe('sem_anuncio')
    expect(origemDoClique({})).toBe('sem_anuncio')
  })
})

describe('validarClique', () => {
  it('accepts a known click', () => {
    expect(validarClique({ onde: 'checkout', pagina: 'resultado', origem: 'bing' }, 'celular'))
      .toEqual({ onde: 'checkout', pagina: 'resultado', origem: 'bing', aparelho: 'celular' })
  })
  it('rejects an unknown placement or a body that is not an object', () => {
    expect(validarClique({ onde: 'x', pagina: 'home' }, 'celular')).toBeNull()
    expect(validarClique('flutuante', 'celular')).toBeNull()
    expect(validarClique(null, 'celular')).toBeNull()
  })
  it('unknown page or origin becomes a generic category, never the raw value', () => {
    for (const pagina of ['/placa/ABC1D23', 'toString', '__proto__', 42]) {
      expect(validarClique({ onde: 'flutuante', pagina, origem: 'x' }, 'computador')).toMatchObject({ pagina: 'conteudo', origem: 'sem_anuncio' })
    }
  })
  it('placements the server does not know are sent as outro', () => {
    expect(ondeDoClique('checkout')).toBe('checkout')
    expect(ondeDoClique('rodape')).toBe('outro')
  })
})

describe('e-mail text', () => {
  it('says where, page, device and origin in Brasilia time, without em dash', () => {
    const c = validarClique({ onde: 'flutuante', pagina: 'home', origem: 'google' }, 'celular')!
    const t = textoClique(c, new Date('2026-11-16T15:04:00Z'))
    expect(assuntoClique(c)).toBe('Clique no WhatsApp do site: botão flutuante')
    expect(t).toContain('16/11/2026')
    expect(t).toContain('12:04')
    expect(t).toContain('Onde: botão flutuante')
    expect(t).toContain('Página: página inicial')
    expect(t).toContain('Aparelho: celular')
    expect(t).toContain('Origem: anúncio do Google')
    expect(t + assuntoClique(c)).not.toContain('—')
  })
})

describe('avisarCliqueWhatsapp', () => {
  afterEach(() => { vi.unstubAllGlobals(); sessionStorage.removeItem('pc_origin') })
  it('sends a JSON beacon with categories only (no click id)', async () => {
    const beacon = vi.fn(() => true)
    vi.stubGlobal('navigator', { sendBeacon: beacon })
    sessionStorage.setItem('pc_origin', JSON.stringify({ msclkid: 'abc123', utm_source: 'bing' }))
    avisarCliqueWhatsapp('checkout', 'resultado')
    expect(beacon).toHaveBeenCalledTimes(1)
    const [url, blob] = beacon.mock.calls[0] as unknown as [string, Blob]
    expect(url).toBe('/api/contato/whatsapp-clique')
    const texto = await blob.text()
    expect(JSON.parse(texto)).toEqual({ onde: 'checkout', pagina: 'resultado', origem: 'bing' })
    expect(texto).not.toContain('abc123')
  })
  it('falls back to fetch keepalive when the beacon is refused', () => {
    vi.stubGlobal('navigator', { sendBeacon: vi.fn(() => false) })
    const f = vi.fn(() => Promise.resolve(new Response(null)))
    vi.stubGlobal('fetch', f)
    avisarCliqueWhatsapp('flutuante', 'home')
    expect(f).toHaveBeenCalledWith('/api/contato/whatsapp-clique', expect.objectContaining({ method: 'POST', keepalive: true }))
  })
  it('never throws, so the click always opens WhatsApp', () => {
    vi.stubGlobal('navigator', { sendBeacon: () => { throw new Error('blocked') } })
    expect(() => avisarCliqueWhatsapp('flutuante', 'home')).not.toThrow()
  })
})
