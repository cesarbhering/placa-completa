import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { estaBloqueado, placaBloqueada } from './blocklist'

// A lista existe pra conter abuso ja confirmado; o teste garante que ninguem
// remove uma entrada sem querer e que a normalizacao nao deixa passar variacao
// trivial de e-mail.
describe('estaBloqueado', () => {
  beforeEach(() => { vi.stubEnv('NUXT_BLOCKLIST_EMAILS', ' Abuso1@Example.com, abuso2@example.com ,,') })
  afterEach(() => { vi.unstubAllEnvs() })

  it('bloqueia os IPs do incidente do app', () => {
    expect(estaBloqueado('177.121.153.13')).toBe(true)
    expect(estaBloqueado('177.33.86.180')).toBe(true)
  })

  it('bloqueia o IP do incidente anterior', () => {
    expect(estaBloqueado('177.44.134.147')).toBe(true)
  })

  it('bloqueia os e-mails do ambiente, em qualquer caixa e com espaco sobrando', () => {
    expect(estaBloqueado(null, 'abuso2@example.com')).toBe(true)
    expect(estaBloqueado(null, '  ABUSO2@Example.com  ')).toBe(true)
    expect(estaBloqueado(null, 'abuso1@example.com')).toBe(true)
  })

  it('basta um dos dois casar', () => {
    expect(estaBloqueado('177.33.86.180', 'pessoa@exemplo.com')).toBe(true)
    expect(estaBloqueado('8.8.8.8', 'abuso2@example.com')).toBe(true)
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

  it('sem NUXT_BLOCKLIST_EMAILS nenhum e-mail e bloqueado', () => {
    vi.stubEnv('NUXT_BLOCKLIST_EMAILS', '')
    expect(estaBloqueado(null, 'abuso1@example.com')).toBe(false)
  })
})

describe('placaBloqueada', () => {
  beforeEach(() => { vi.stubEnv('NUXT_BLOCKLIST_PLACAS', ' abc-1d23 , XYZ9876 ,,') })
  afterEach(() => { vi.unstubAllEnvs() })

  it('bloqueia a placa do ambiente em qualquer caixa e com separador', () => {
    expect(placaBloqueada('ABC1D23')).toBe(true)
    expect(placaBloqueada('abc-1d23')).toBe(true)
    expect(placaBloqueada('XYZ9876')).toBe(true)
  })

  it('bloqueia tambem o outro formato da mesma placa (antiga x Mercosul)', () => {
    expect(placaBloqueada('ABC1323')).toBe(true)
    expect(placaBloqueada('XYZ9I76')).toBe(true)
  })

  it('deixa passar placa parecida e vazio', () => {
    expect(placaBloqueada('ABC1D24')).toBe(false)
    expect(placaBloqueada('')).toBe(false)
    expect(placaBloqueada(null)).toBe(false)
  })

  it('sem env, nada e bloqueado', () => {
    vi.stubEnv('NUXT_BLOCKLIST_PLACAS', '')
    expect(placaBloqueada('ABC1D23')).toBe(false)
  })
})
