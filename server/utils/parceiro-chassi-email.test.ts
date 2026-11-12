import { describe, it, expect } from 'vitest'
import { montarEmailParceiro } from './parceiro-chassi-email'

describe('e-mail de acesso de parceiro', () => {
  const m = montarEmailParceiro({ link: 'https://placacompleta.com.br/parceiro/entrar?t=abc', codigo: 'ABCD2345' })
  it('traz o link, o codigo e a validade, sem travessao', () => {
    expect(m.html).toContain('https://placacompleta.com.br/parceiro/entrar?t=abc')
    expect(m.texto).toContain('ABCD2345')
    expect(m.texto).toContain('30 minutos')
    expect(m.texto).not.toContain('não expira')
    expect(`${m.assunto}${m.html}${m.texto}`).not.toContain('—')
  })
})
