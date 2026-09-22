import { describe, it, expect } from 'vitest'
import { horaBrasilia } from './sendErrorEmail'

// Este pedaco derrubou TODOS os e-mails de erro do premium: os chamadores do
// fluxo de pedido nunca mandaram `timestamp`, e horaBrasilia(undefined) batia
// em getTime de undefined antes de qualquer envio. O time so ficou sabendo de
// um pedido estornado por outro caminho.
describe('hora do e-mail de erro', () => {
  it('sem argumento nao quebra: usa agora', () => {
    expect(horaBrasilia()).toMatch(/BRT$/)
  })

  it('undefined e null tambem caem em agora, que e o caso real dos chamadores', () => {
    expect(horaBrasilia(undefined)).toMatch(/BRT$/)
    expect(horaBrasilia(null)).toMatch(/BRT$/)
  })

  it('data conhecida sai no fuso de Brasilia', () => {
    // 22/set/2026 17:30 UTC = 14:30 BRT
    expect(horaBrasilia('2026-09-22T17:30:00.000Z')).toBe('22/09/2026, 14:30:00 BRT')
  })

  it('texto que nao e data volta como veio, em vez de virar "Invalid Date"', () => {
    expect(horaBrasilia('ontem a noite')).toBe('ontem a noite')
  })
})
