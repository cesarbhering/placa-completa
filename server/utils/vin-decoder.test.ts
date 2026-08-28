import { describe, it, expect } from 'vitest'
import { anoChassiCoerente, corrigirAnoChassi } from './vin-decoder'

// Caso real GQU8596: Honda Civic 1995, chassi 2HGEH339XSH650352 (pos10 'S').
// O decoder devolve 2025 (mais recente do ciclo); o registro diz 1995.
describe('anoChassiCoerente', () => {
  it('puxa o candidato do ciclo de 30 anos que bate com o registro (Civic 1995)', () => {
    expect(anoChassiCoerente(2025, 1995)).toBe(1995)
  })

  it('aceita 1 ano de diferenca (fabricado em dezembro, ano-modelo seguinte)', () => {
    expect(anoChassiCoerente(2025, 1994)).toBe(1995)
    expect(anoChassiCoerente(2025, 1996)).toBe(1995)
  })

  it('mantem o ano do decoder quando ja bate com o registro', () => {
    expect(anoChassiCoerente(2019, 2019)).toBe(2019)
    expect(anoChassiCoerente(2019, 2020)).toBe(2019)
  })

  it('omite o ano quando nenhum candidato chega perto do registro', () => {
    expect(anoChassiCoerente(2025, 2008)).toBeNull()
    expect(anoChassiCoerente(2025, 1980)).toBeNull()
  })

  it('sem registro utilizavel, devolve o ano do decoder como veio', () => {
    expect(anoChassiCoerente(2025, null)).toBe(2025)
    expect(anoChassiCoerente(2025, undefined)).toBe(2025)
    expect(anoChassiCoerente(2025, 0)).toBe(2025)
  })

  it('sem ano do decoder, nao inventa nada', () => {
    expect(anoChassiCoerente(null, 1995)).toBeNull()
    expect(anoChassiCoerente(undefined, 1995)).toBeNull()
  })
})

describe('corrigirAnoChassi', () => {
  const origem = { checksumOk: true, fabricante: 'Honda', pais: 'Canadá', regiao: 'América do Norte', anoModelo: 2025, planta: null }

  it('corrige o ano sem mexer no resto do decode', () => {
    const r = corrigirAnoChassi(origem, 1995)!
    expect(r.anoModelo).toBe(1995)
    expect(r.fabricante).toBe('Honda')
    expect(origem.anoModelo).toBe(2025)
  })

  it('zera o ano quando ele contradiz o registro', () => {
    expect(corrigirAnoChassi(origem, 2008)!.anoModelo).toBeNull()
  })

  it('null entra, null sai', () => {
    expect(corrigirAnoChassi(null, 1995)).toBeNull()
  })
})
