import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paisPorFaixaWmi, checksumAplicavel } from '../src/paises.js'

test('8AW (SpaceFox importado da Argentina) cai na faixa argentina', () => {
  assert.equal(paisPorFaixaWmi('8AW'), 'Argentina')
})

test('faixas conferidas na fonte', () => {
  assert.equal(paisPorFaixaWmi('8FA'), 'Chile')
  assert.equal(paisPorFaixaWmi('8SA'), 'Peru')
  assert.equal(paisPorFaixaWmi('9BW'), 'Brasil')
  assert.equal(paisPorFaixaWmi('93H'), 'Brasil')
  assert.equal(paisPorFaixaWmi('9SA'), 'Uruguai')
})

test('grade ISO 3780 completa (Asia, Europa, America do Norte)', () => {
  assert.equal(paisPorFaixaWmi('JMY'), 'Japão') // Mitsubishi de exportacao (bug do ASX)
  assert.equal(paisPorFaixaWmi('MMB'), 'Tailândia')
  assert.equal(paisPorFaixaWmi('MA3'), 'Índia')
  assert.equal(paisPorFaixaWmi('MHF'), 'Indonésia')
  assert.equal(paisPorFaixaWmi('LVV'), 'China')
  assert.equal(paisPorFaixaWmi('KNA'), 'Coreia do Sul')
  assert.equal(paisPorFaixaWmi('WVW'), 'Alemanha')
  assert.equal(paisPorFaixaWmi('1FA'), 'Estados Unidos')
  assert.equal(paisPorFaixaWmi('3VW'), 'México')
  assert.equal(paisPorFaixaWmi('7AT'), 'Nova Zelândia')
  assert.equal(paisPorFaixaWmi('7FA'), 'Estados Unidos')
})

test('ordem ISO 3780: 2o caractere A..Z, 1..9 e por ultimo 0', () => {
  assert.equal(paisPorFaixaWmi('9A9'), 'Brasil')
  assert.equal(paisPorFaixaWmi('988'), 'Brasil')
  assert.equal(paisPorFaixaWmi('90A'), 'Brasil') // "1-0" cobre o 0 no fim
  assert.equal(paisPorFaixaWmi('8SA'), 'Peru')
})

test('faixa so com regiao generica na fonte: nao chuta pais', () => {
  assert.equal(paisPorFaixaWmi('8H0'), null)
  assert.equal(paisPorFaixaWmi('DAA'), null)
  assert.equal(paisPorFaixaWmi('KAA'), null)
  assert.equal(paisPorFaixaWmi(''), null)
  assert.equal(paisPorFaixaWmi(null), null)
})

test('digito verificador so se aplica a America do Norte', () => {
  assert.equal(checksumAplicavel('1FAHP3F20CL000000'), true)
  assert.equal(checksumAplicavel('3VWFE21C04M000000'), true)
  assert.equal(checksumAplicavel('7FARW2H55ME000000'), true)
  assert.equal(checksumAplicavel('JMYXTGA2WBZ000000'), false)
  assert.equal(checksumAplicavel('9BWZZZ377VT004251'), false)
  assert.equal(checksumAplicavel('7ATXXXXXXXX000000'), false)
})
