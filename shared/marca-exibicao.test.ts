import { describe, it, expect } from 'vitest'
import { marcaExibicao, marcaEhCodigo } from './marca-exibicao'

// Payload real (placa FHH1F97, Azera importado): MARCA vem como codigo.
const importado = {
  MARCA: 'I',
  MODELO: 'HYUNDAI AZERA 3.0 V6',
  marcaModelo: 'I/HYUNDAI AZERA 3.0 V6',
  SUBMODELO: 'HYUNDAI',
  listamodelo: ['HYUNDAI', 'AZERA', '3.0', 'V6'],
}

describe('marcaExibicao', () => {
  it('importado com MARCA "I" vira a marca de verdade', () => {
    expect(marcaExibicao(importado)).toBe('HYUNDAI')
  })

  it('importado sem listamodelo cai no SUBMODELO', () => {
    expect(marcaExibicao({ ...importado, listamodelo: undefined })).toBe('HYUNDAI')
  })

  it('importado so com MODELO ainda resolve', () => {
    expect(marcaExibicao({ MARCA: 'I', MODELO: 'HYUNDAI AZERA 3.0 V6' })).toBe('HYUNDAI')
  })

  it('importado so com marcaModelo ainda resolve', () => {
    expect(marcaExibicao({ MARCA: 'I', marcaModelo: 'I/HYUNDAI AZERA 3.0 V6' })).toBe('HYUNDAI')
  })

  it('domestico continua exatamente como vem', () => {
    expect(marcaExibicao({ MARCA: 'VW', MODELO: 'GOL 1.0' })).toBe('VW')
    expect(marcaExibicao({ MARCA: 'GM', MODELO: 'ONIX 1.0' })).toBe('GM')
    expect(marcaExibicao({ MARCA: 'FIAT', MODELO: 'UNO MILLE' })).toBe('FIAT')
    expect(marcaExibicao({ marca: 'CHEVROLET', MODELO: 'ONIX JOY' })).toBe('CHEVROLET')
  })

  it('sem nada utilizavel devolve vazio em vez de inventar', () => {
    expect(marcaExibicao({ MARCA: 'I' })).toBe('')
    expect(marcaExibicao({})).toBe('')
    expect(marcaExibicao(null)).toBe('')
  })
})

describe('marcaEhCodigo', () => {
  it('reconhece codigo e lixo', () => {
    expect(marcaEhCodigo('I')).toBe(true)
    expect(marcaEhCodigo('IMP')).toBe(true)
    expect(marcaEhCodigo('')).toBe(true)
    expect(marcaEhCodigo('0')).toBe(true)
    expect(marcaEhCodigo(null)).toBe(true)
  })

  it('nao derruba marca de verdade', () => {
    expect(marcaEhCodigo('VW')).toBe(false)
    expect(marcaEhCodigo('GM')).toBe(false)
    expect(marcaEhCodigo('HYUNDAI')).toBe(false)
  })
})
