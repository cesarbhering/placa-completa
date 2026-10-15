// v9: BMW X5/X6/X7/XM (WBA) saem de Spartanburg (EUA), nao da Alemanha.
// Chassis REAIS da base de leiloes; o modelo vem como chega no registro.
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

const SPART = 'Spartanburg (Carolina do Sul)'
// [chassi, modelo, ano, cidade esperada (null = sem cidade), o que e]
const CASOS = [
  // Mesmo codigo '9' do caso real (X5 xDrive45e 2023 importado).
  ['WBACX6102L9C39172', 'I/BMW X5 XDRIVE45E', 2023, SPART, 'X5 xDrive45e 2023 (pos 11 9)'],
  ['WBACX6102L9C39172', 'I/BMW X7 XDRIVE40I', 2020, SPART, 'X7 2020'],
  ['WBACX6102L9C39172', 'I/BMW XM', 2024, SPART, 'XM 2024'],
  ['WBACX6102L9C39172', 'I/BMW X6M COMPETITION', 2022, SPART, 'X6 M 2022'],
  ['WBAFA51072LM32103', 'I/BMW X5 FA51', 2002, SPART, 'X5 2002 (pos 11 L)'],
  ['WBAKR6108E0G94864', 'I/BMW X5 XDRIVE30D', 2014, SPART, 'X5 2014 (pos 11 0)'],
  // Sem regra: X3 sai de Spartanburg, Rosslyn e Shenyang; curinga '9' fora.
  ['WBA71DP01P9N89474', 'I/BMW X3 XDRIVE30E', 2023, null, 'X3 2023 com codigo 9'],
  ['WBACX6102L9C39172', null, 2023, null, 'WBA 9 sem modelo'],
  // Fora da janela: X7 antes de 2019 nao existia.
  ['WBACX6102L9C39172', 'I/BMW X7', 2017, null, 'X7 fora da janela'],
]

for (const [vin, modelo, ano, cidade, oque] of CASOS) {
  test(`${oque}: ${cidade ?? 'sem cidade'}`, () => {
    const r = decodeVin(vin, { modelo, ano })
    assert.equal(r.valido, true)
    assert.equal(r.plantaDetalhe?.cidade ?? null, cidade)
    if (cidade) assert.equal(r.pais, 'Estados Unidos', 'pais = pais da fabrica')
    else assert.ok(r.fabricante && r.pais, 'montadora e pais continuam saindo')
  })
}
