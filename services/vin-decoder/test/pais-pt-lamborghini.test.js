// Caso FUG0A96 (Lamborghini Huracan Spyder 2018, chassi ZHW...): pais saia
// "ITALY" do vPIC e sem planta.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { paisVpicPt, PAISES_VPIC_PT } from '../src/paises.js'

process.env.VIN_DB_PATH = join(mkdtempSync(join(tmpdir(), 'vin-')), 'vin.db')

let decodeVin
before(async () => {
  await import('../scripts/overrides-br.mjs')
  const { aplicarPlantas } = await import('../scripts/plants-br.mjs')
  aplicarPlantas()
  ;({ decodeVin } = await import('../src/decode.js'))
})

test('pais do vPIC em portugues', () => {
  assert.equal(paisVpicPt('ITALY'), 'Itália')
  assert.equal(paisVpicPt('UNITED STATES (USA)'), 'Estados Unidos')
  assert.equal(paisVpicPt('UNITED KINGDOM (UK)'), 'Reino Unido')
  assert.equal(paisVpicPt('france'), 'França')
  assert.equal(paisVpicPt('ATLANTIS'), null)
  assert.equal(paisVpicPt(null), null)
  for (const v of Object.values(PAISES_VPIC_PT)) assert.notEqual(v, v.toUpperCase(), `${v} ainda em caixa alta`)
})

test('Lamborghini ZHW: Itália, planta Sant\'Agata Bolognese', () => {
  const r = decodeVin('ZHWER1ZF0JLA00000', { modelo: 'LAMBORGHINI/HURAC SPYD', ano: 2018 })
  assert.equal(r.pais, 'Itália')
  assert.equal(r.plantaDetalhe?.cidade, "Sant'Agata Bolognese")
  assert.equal(r.plantaDetalhe?.pais, 'Itália')
})
