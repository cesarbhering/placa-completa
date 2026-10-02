import { describe, it, expect } from 'vitest'
import { chassiDoPayload } from './chassi-servidor'

describe('chassiDoPayload (chassi que o servidor ja tem da consulta)', () => {
  it('extra.chassi de 17 = completo', () => {
    expect(chassiDoPayload({ extra: { chassi: 'lj11kaab9ke000139' }, chassi: '*****00139' }))
      .toEqual({ tipo: 'completo', chassi: 'LJ11KAAB9KE000139' })
  })
  it('sem extra: sufixo mascarado da WDAPI como veio', () => {
    expect(chassiDoPayload({ extra: null, chassi: '*****55388' })).toEqual({ tipo: 'sufixo', chassi: '*****55388' })
  })
  it('extra.chassi curto/pre-VIN nao vale como completo; cai pro sufixo', () => {
    expect(chassiDoPayload({ extra: { chassi: 'AB1234' }, chassi: '*****01234' })).toEqual({ tipo: 'sufixo', chassi: '*****01234' })
  })
  it('prefixo mascarado (o que a tela tem) ou nada: sem chassi', () => {
    expect(chassiDoPayload({ chassi: 'LJ11K*****' })).toEqual({ tipo: null, chassi: null })
    expect(chassiDoPayload({ chassi: '*****' })).toEqual({ tipo: null, chassi: null })
    expect(chassiDoPayload(null)).toEqual({ tipo: null, chassi: null })
  })
})
