// Mitsubishi: JMY (Japao, exportacao pra America do Sul) nao existe no vPIC.
// Posicao 11 pela tabela da marca, conferida na base de leiloes. Chassis REAIS
// da base (leiloes-poc-db), nunca de cliente.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.VIN_DB_PATH = join(mkdtempSync(join(tmpdir(), 'vin-')), 'vin.db')

let decodeVin
before(async () => {
  await import('../scripts/overrides-br.mjs')
  const { aplicarPlantas } = await import('../scripts/plants-br.mjs')
  aplicarPlantas()
  ;({ decodeVin } = await import('../src/decode.js'))
})

const CASOS = [
  ['JMYXLCW6W8ZA00951', 'Okazaki', 'Outlander 2008'],
  ['JMYLMCX4ACU000543', 'Kurashiki (Mizushima)', 'Lancer Ralliart 2012'],
  ['JMY0NK9703JA00136', 'Sakahogi (Pajero Manufacturing)', 'Pajero Sport 2003'],
]

for (const [vin, cidade, oque] of CASOS) {
  test(`${oque}: ${vin} sai de ${cidade}, Japão`, () => {
    const r = decodeVin(vin)
    assert.equal(r.valido, true)
    assert.equal(r.plantaDetalhe?.cidade, cidade)
    assert.equal(r.plantaDetalhe?.pais, 'Japão')
  })
}

test('JMY com codigo sem confirmacao (P) fica sem cidade', () => {
  assert.equal(decodeVin('JMY0NK9703PA00136').plantaDetalhe, null)
})

test('HPE Catalao (93X) continua nacional: Catalão (GO)', () => {
  const r = decodeVin('93XATGA2WLCK43531') // ASX HPE, chassi real da base
  assert.equal(r.plantaDetalhe?.cidade, 'Catalão')
  assert.equal(r.plantaDetalhe?.uf, 'GO')
  assert.equal(r.plantaDetalhe?.pais, 'Brasil')
})
