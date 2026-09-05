import { describe, it, expect } from 'vitest'
import { estaBloqueado } from './blocklist'

// A lista existe pra conter abuso ja confirmado; o teste garante que ninguem
// remove uma entrada sem querer e que a normalizacao nao deixa passar variacao
// trivial de e-mail.
describe('estaBloqueado', () => {
  it('bloqueia os IPs do incidente do app', () => {
    expect(estaBloqueado('177.121.153.13')).toBe(true)
    expect(estaBloqueado('177.33.86.180')).toBe(true)
  })

  it('bloqueia o IP do incidente anterior', () => {
    expect(estaBloqueado('177.44.134.147')).toBe(true)
  })

  it('bloqueia os e-mails conhecidos, em qualquer caixa e com espaco sobrando', () => {
    expect(estaBloqueado(null, 'bloqueado@example.com')).toBe(true)
    expect(estaBloqueado(null, '  GuMarcanti2@Gmail.com  ')).toBe(true)
    expect(estaBloqueado(null, 'bloqueado@example.com')).toBe(true)
  })

  it('basta um dos dois casar', () => {
    expect(estaBloqueado('177.33.86.180', 'pessoa@exemplo.com')).toBe(true)
    expect(estaBloqueado('8.8.8.8', 'bloqueado@example.com')).toBe(true)
  })

  it('deixa passar quem nao esta na lista', () => {
    expect(estaBloqueado('8.8.8.8', 'pessoa@exemplo.com')).toBe(false)
    expect(estaBloqueado('', '')).toBe(false)
    expect(estaBloqueado(null, null)).toBe(false)
    expect(estaBloqueado(undefined, undefined)).toBe(false)
  })

  it('nao bloqueia por prefixo de IP parecido', () => {
    expect(estaBloqueado('177.33.86.18')).toBe(false)
    expect(estaBloqueado('177.33.86.1800')).toBe(false)
  })
})
