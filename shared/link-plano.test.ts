import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { planoDoLinkSemPlaca } from './link-plano'
import { ORIGENS_CHECKOUT, sanearOrigemCheckout, ROTULO_ORIGEM_CHECKOUT } from './origem-checkout'

describe('link com o plano ja escolhido (/?plano=)', () => {
  it('sem placa: completa e basica valem; gratis e lixo nao', () => {
    expect(planoDoLinkSemPlaca({ plano: 'completa' })).toBe('completa')
    expect(planoDoLinkSemPlaca({ plano: 'basica' })).toBe('basica')
    expect(planoDoLinkSemPlaca({ plano: 'gratis' })).toBe(null)
    expect(planoDoLinkSemPlaca({ plano: 'xpto' })).toBe(null)
    expect(planoDoLinkSemPlaca({})).toBe(null)
  })
  it('com placa na URL fica o fluxo antigo (link_direto)', () => {
    expect(planoDoLinkSemPlaca({ plano: 'completa', placa: 'ABC1D23' })).toBe(null)
    expect(planoDoLinkSemPlaca({ plano: 'completa' }, { placaNaRota: 'ABC1D23' })).toBe(null)
  })
  it('app (Capacitor) e PWA nao mudam', () => {
    expect(planoDoLinkSemPlaca({ plano: 'completa' }, { app: true })).toBe(null)
    expect(planoDoLinkSemPlaca({ plano: 'completa' }, { pwa: true })).toBe(null)
  })
  it('origem do checkout link_plano existe e e aceita pelo servidor', () => {
    expect(ORIGENS_CHECKOUT).toContain('link_plano')
    expect(sanearOrigemCheckout('link_plano')).toBe('link_plano')
    expect(ROTULO_ORIGEM_CHECKOUT.link_plano).toBe('Link com plano')
  })
  it('a home usa a regra e abre o checkout com origem link_plano', () => {
    const home = readFileSync('pages/index.vue', 'utf8')
    expect(home).toContain('planoDoLinkSemPlaca(route.query')
    expect(home).toContain("viaLinkPlano.value ? 'link_plano' : 'hero_apos_cta'")
    // copy do aviso: sem travessao
    const aviso = home.slice(home.indexOf('class="cb-plano-link"'), home.indexOf('class="cb-plano-link"') + 600)
    expect(aviso).not.toMatch(/—/)
  })
})
