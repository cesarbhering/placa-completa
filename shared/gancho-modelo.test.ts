import { describe, it, expect } from 'vitest'
import { acharModelo, fraseGanchoModelo, normalizarMarca, nomeParaFrase, type LinhaLeilaoModelo } from './gancho-modelo'

const TABELA: LinhaLeilaoModelo[] = [
  { marca: 'Volkswagen', modelo: 'Gol', qtd: 900 },
  { marca: 'VOLKSWAGEN', modelo: 'GOLF', qtd: 50 },
  { marca: 'Chevrolet', modelo: 'Onix', qtd: 700 },
  { marca: 'Chevrolet', modelo: 'Onix Plus', qtd: 200 },
  { marca: 'Hyundai', modelo: 'HB20', qtd: 400 },
  { marca: 'Hyundai', modelo: 'Azera', qtd: 10 },
  { marca: 'Fiat', modelo: 'Uno', qtd: 0 },
  { marca: 'Citroën', modelo: 'C3', qtd: 30 },
]

describe('gancho por modelo', () => {
  it('apelido de marca da consulta casa com o nome por extenso da tabela', () => {
    expect(normalizarMarca('VW')).toBe('VOLKSWAGEN')
    expect(normalizarMarca('gm')).toBe('CHEVROLET')
    expect(acharModelo(TABELA, 'VW', 'GOL 1.0')?.modelo).toBe('Gol')
  })
  it('palavra inteira: GOL nao casa GOLF e vice-versa', () => {
    expect(acharModelo(TABELA, 'VW', 'GOLF TSI')?.modelo).toBe('GOLF')
    expect(acharModelo(TABELA, 'VW', 'GOLZINHO')).toBeNull()
  })
  it('mais especifico vence', () => {
    expect(acharModelo(TABELA, 'GM', 'ONIX PLUS 1.0T')?.modelo).toBe('Onix Plus')
    expect(acharModelo(TABELA, 'GM', 'ONIX 10MT LT')?.modelo).toBe('Onix')
  })
  it('importado com a marca dentro do modelo, NOVO na frente e acento', () => {
    expect(acharModelo(TABELA, 'HYUNDAI', 'HYUNDAI AZERA 3.0 V6')?.modelo).toBe('Azera')
    expect(acharModelo(TABELA, 'VW', 'NOVO GOL TL MCV')?.modelo).toBe('Gol')
    expect(acharModelo(TABELA, 'CITROEN', 'C3 GLX 1.4')?.modelo).toBe('C3')
  })
  it('sem linha, qtd zero, marca errada ou dado vazio: nada', () => {
    expect(acharModelo([], 'VW', 'GOL')).toBeNull()
    expect(acharModelo(TABELA, 'FIAT', 'UNO MILLE')).toBeNull()
    expect(acharModelo(TABELA, 'FIAT', 'GOL')).toBeNull()
    expect(acharModelo(TABELA, '', 'GOL')).toBeNull()
    expect(acharModelo(TABELA, 'VW', '')).toBeNull()
  })
  it('frase neutra, sem numero nem placa', () => {
    expect(fraseGanchoModelo('VW', 'GOL')).toBe('Veículos VW Gol aparecem em leilões na nossa base')
    expect(fraseGanchoModelo('HYUNDAI', 'HB20')).toBe('Veículos Hyundai HB20 aparecem em leilões na nossa base')
    expect(nomeParaFrase('T-CROSS')).toBe('T-Cross')
    expect(fraseGanchoModelo('', 'GOL')).toBeNull()
    const f = fraseGanchoModelo('GM', 'ONIX PLUS')!
    expect(f).not.toMatch(/\d/)
    expect(f).not.toContain('—')
  })
})
