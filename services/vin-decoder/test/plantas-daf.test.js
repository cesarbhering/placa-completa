// v10: DAF Caminhoes Brasil (WMI 98P) so tem a fabrica de Ponta Grossa (PR).
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.VIN_DB_PATH = join(mkdtempSync(join(tmpdir(), 'vin-')), 'vin.db')

let decodeVin
before(async () => {
  await import('../scripts/overrides-br.mjs')
  await import('../scripts/wmi-mundo.mjs')
  const { aplicarPlantas } = await import('../scripts/plants-br.mjs')
  aplicarPlantas()
  ;({ decodeVin } = await import('../src/decode.js'))
})

test('DAF 98P: fabricante, Brasil e Ponta Grossa (PR)', () => {
  // Chassi real da base de leiloes (DAF XF).
  const r = decodeVin('98PACM410PB135121', { modelo: 'DAF/XF FTS 480', ano: 2021 })
  assert.equal(r.valido, true)
  assert.equal(r.fabricante, 'DAF Caminhões Brasil')
  assert.equal(r.pais, 'Brasil')
  assert.equal(r.plantaDetalhe?.cidade, 'Ponta Grossa')
  assert.equal(r.plantaDetalhe?.uf, 'PR')
})
