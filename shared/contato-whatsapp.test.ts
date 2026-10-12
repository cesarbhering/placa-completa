import { describe, it, expect } from 'vitest'
import { linkWhatsapp, tipoDePagina, whatsappVisivel, WHATSAPP_NUMERO } from './contato'

describe('WhatsApp flutuante', () => {
  it('link wa.me com o numero da constante e a mensagem codificada', () => {
    expect(WHATSAPP_NUMERO).toBe('17205887194')
    expect(linkWhatsapp()).toBe('https://wa.me/17205887194?text=Ol%C3%A1!%20Vim%20pelo%20site%20da%20PlacaCompleta%20e%20tenho%20uma%20d%C3%BAvida.')
  })
  it('evento so leva a categoria da pagina (sem placa nem token)', () => {
    expect(tipoDePagina('/')).toBe('home')
    expect(tipoDePagina('/premium/AbCdEf123456')).toBe('relatorio')
    expect(tipoDePagina('/placa/ABC1D23')).toBe('resultado')
    expect(tipoDePagina('/contato')).toBe('conteudo')
    for (const p of ['/premium/AbCdEf123456', '/placa/ABC1D23']) expect(tipoDePagina(p)).not.toMatch(/ABC|AbCd/)
  })
  it('esconde nas telas internas e quando alguem pede (checkout, modal, Pix)', () => {
    expect(whatsappVisivel('/', {})).toBe(true)
    expect(whatsappVisivel('/premium/x', { w1: false })).toBe(true)
    expect(whatsappVisivel('/', { w1: false, w2: true })).toBe(false)
    expect(whatsappVisivel('/admin/pedidos', {})).toBe(false)
    expect(whatsappVisivel('/dash', {})).toBe(false)
  })
})
