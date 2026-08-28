import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paisPorFaixaWmi } from '../src/paises.js'

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

test('fora das faixas conferidas, nao chuta pais', () => {
  assert.equal(paisPorFaixaWmi('WVW'), null)
  assert.equal(paisPorFaixaWmi('1FA'), null)
  assert.equal(paisPorFaixaWmi('8H0'), null)
  assert.equal(paisPorFaixaWmi(''), null)
  assert.equal(paisPorFaixaWmi(null), null)
})
