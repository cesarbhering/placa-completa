import { describe, it, expect } from 'vitest'
import { passagemCertezaPorIdentificador, leiloeiroValido, sanearCasaLeilao, textoCasaLeilao } from './leilao-exibicao'

describe('passagemCertezaPorIdentificador (Cesar, 29/out)', () => {
  it('confirmado por chassi ou placa completos: certeza', () => {
    expect(passagemCertezaPorIdentificador({ nivel: 'confirmado', evidencias: ['chassi completo igual', 'modelo compatível'] })).toBe(true)
    expect(passagemCertezaPorIdentificador({ nivel: 'confirmado', evidencias: ['Placa completa igual'] })).toBe(true)
  })
  it('provavel/possivel ou sem identificador completo: nao e certeza', () => {
    expect(passagemCertezaPorIdentificador({ nivel: 'provavel', evidencias: ['chassi completo igual'] })).toBe(false)
    expect(passagemCertezaPorIdentificador({ nivel: 'possivel', evidencias: ['final de placa igual'] })).toBe(false)
    expect(passagemCertezaPorIdentificador({ nivel: 'confirmado', evidencias: ['final do chassi igual'] })).toBe(false)
    expect(passagemCertezaPorIdentificador({ nivel: 'confirmado' })).toBe(false)
    expect(passagemCertezaPorIdentificador(null)).toBe(false)
  })
  it('com conflito continua sendo certeza (caso JRP5326)', () => {
    expect(passagemCertezaPorIdentificador({ nivel: 'confirmado', evidencias: ['placa completa igual'], conflitos: ['marca diferente (I)'] })).toBe(true)
    expect(passagemCertezaPorIdentificador({ nivel: 'confirmado', evidencias: ['chassi completo igual'], conflitos: ['modelo divergente'] })).toBe(true)
  })
})

describe('leiloeiro e casa do leilao de DETRAN', () => {
  it('"Oficial designado" vira null', () => {
    expect(leiloeiroValido('Oficial designado')).toBeNull()
    expect(leiloeiroValido(' OFICIAL DESIGNADO ')).toBeNull()
    expect(leiloeiroValido('')).toBeNull()
    expect(leiloeiroValido(null)).toBeNull()
    expect(leiloeiroValido('Fulano de Tal')).toBe('Fulano de Tal')
  })
  it('casa com nome e site', () => {
    expect(textoCasaLeilao({ site: 'rjleiloes.com.br', nome: 'RJ Leilões' })).toBe('Realizado por RJ Leilões (rjleiloes.com.br)')
  })
  it('casa sem nome: so o site', () => {
    expect(textoCasaLeilao({ site: 'brbid.com', nome: null })).toBe('Realizado por brbid.com')
    expect(textoCasaLeilao({ site: 'https://www.RJLeiloes.com.br/lotes?x=1' })).toBe('Realizado por rjleiloes.com.br')
    expect(sanearCasaLeilao({ site: 'brbid.com', nome: 'brbid.com' })).toEqual({ site: 'brbid.com', nome: null })
  })
  it('ausente ou torto: nada', () => {
    expect(textoCasaLeilao(undefined)).toBeNull()
    expect(textoCasaLeilao(null)).toBeNull()
    expect(textoCasaLeilao({ nome: 'RJ Leilões' })).toBeNull()
    expect(textoCasaLeilao({ site: 'javascript:alert(1)' })).toBeNull()
    expect(textoCasaLeilao('rjleiloes.com.br')).toBeNull()
  })
})
