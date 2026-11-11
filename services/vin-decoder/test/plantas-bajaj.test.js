import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.VIN_DB_PATH = join(mkdtempSync(join(tmpdir(), 'vin-')), 'vin.db')

let decodeVin, PLANTS_VERSAO
before(async () => {
  await import('../scripts/overrides-br.mjs')
  await import('../scripts/wmi-mundo.mjs')
  const plantas = await import('../scripts/plants-br.mjs')
  plantas.aplicarPlantas()
  PLANTS_VERSAO = plantas.PLANTS_VERSAO
  ;({ decodeVin } = await import('../src/decode.js'))
})

// Chassis SINTETICOS (so o WMI 92T e real); nenhum chassi de veiculo real.
test('Bajaj 92T: fabricante, Brasil e Manaus (AM)', () => {
  const r = decodeVin('92TABC12XTM000001', { modelo: 'BAJAJ/PULSAR N150', ano: 2026 })
  assert.equal(r.valido, true)
  assert.equal(r.wmi, '92T')
  assert.equal(r.fabricante, 'Bajaj do Brasil')
  assert.equal(r.pais, 'Brasil')
  assert.equal(r.plantaDetalhe?.cidade, 'Manaus')
  assert.equal(r.plantaDetalhe?.uf, 'AM')
})

test('Bajaj 92T: qualquer codigo de planta cai em Manaus (fabrica unica)', () => {
  for (const pos11 of ['M', 'A', '1', 'Z']) {
    const r = decodeVin(`92TDEF34XS${pos11}000002`, { modelo: 'BAJAJ/DOMINAR 400', ano: 2025 })
    assert.equal(r.plantaDetalhe?.cidade, 'Manaus', pos11)
    assert.equal(r.plantaDetalhe?.uf, 'AM', pos11)
  }
})

test('Bajaj 92T: sem modelo nem ano tambem resolve', () => {
  const r = decodeVin('92TGHJ56XTM000003')
  assert.equal(r.fabricante, 'Bajaj do Brasil')
  assert.equal(r.plantaDetalhe?.cidade, 'Manaus')
})

test('PLANTS_VERSAO subiu pra 11', () => {
  assert.ok(PLANTS_VERSAO >= 11)
})
