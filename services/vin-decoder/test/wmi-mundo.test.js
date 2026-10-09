// WMIs fora dos EUA (scripts/wmi-mundo.mjs). Bug real: I/MMC ASX 2011 com
// chassi JMY... saiu com a Origem do chassi vazia (o vPIC nao tem JMY).
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.VIN_DB_PATH = join(mkdtempSync(join(tmpdir(), 'vin-')), 'vin.db')

let decodeVin, WMI_MUNDO
before(async () => {
  await import('../scripts/overrides-br.mjs')
  const m = await import('../scripts/wmi-mundo.mjs')
  WMI_MUNDO = m.WMI_MUNDO
  m.aplicarWmiMundo()
  ;({ decodeVin } = await import('../src/decode.js'))
})

test('toda linha tem fonte e pais pela faixa ISO 3780', async () => {
  const { paisPorFaixaWmi } = await import('../src/paises.js')
  const vistos = new Set()
  for (const [code, nome, fonte] of WMI_MUNDO) {
    assert.match(code, /^[A-HJ-NPR-Z0-9]{3}$/, code)
    assert.ok(!vistos.has(code), `duplicado ${code}`); vistos.add(code)
    assert.ok(nome && fonte, code)
    assert.ok(paisPorFaixaWmi(code), `sem pais: ${code}`)
  }
})

test('bug do ASX: JMY decodifica Mitsubishi Motors, Japao, sem "invalido"', () => {
  const r = decodeVin('JMYXTGA2WBZ000000')
  assert.equal(r.fabricante, 'Mitsubishi Motors')
  assert.equal(r.pais, 'Japão')
  // A cidade (Okazaki, desde a v8 das plantas) e testada em plantas-mitsubishi.test.js.
  assert.equal(r.checksumOk, null)
  assert.equal(r.checksumAplicavel, false)
})

test('prioritarios: Mitsubishi Tailandia, chinesas, coreanas e Brasil', () => {
  const casos = {
    MMB: ['Mitsubishi Motors', 'Tailândia'], MMT: ['Mitsubishi Motors', 'Tailândia'], MMC: ['Mitsubishi Motors', 'Tailândia'],
    JMB: ['Mitsubishi Motors', 'Japão'], MR0: ['Toyota', 'Tailândia'], MRH: ['Honda', 'Tailândia'],
    LVV: ['Chery', 'China'], LJ1: ['JAC Motors', 'China'], LGW: ['Great Wall Motor (GWM)', 'China'], LC0: ['BYD', 'China'],
    KND: ['Kia', 'Coreia do Sul'], KM8: ['Hyundai', 'Coreia do Sul'],
    988: ['Stellantis (Jeep, Ram, Fiat)', 'Brasil'], '98R': ['Chery', 'Brasil'], '99A': ['Audi do Brasil', 'Brasil'],
  }
  for (const [wmi, [fab, pais]] of Object.entries(casos)) {
    const r = decodeVin(`${wmi}XXXXXXXX0000000`.slice(0, 17))
    assert.equal(r.fabricante, fab, wmi)
    assert.equal(r.pais, pais, wmi)
  }
})

test('override BR continua vencendo a tabela do mundo', () => {
  assert.equal(decodeVin('9BGXXXXXXXX000000').fabricante, 'General Motors do Brasil')
})

test('9A9 (pequeno fabricante, montadora so nas posicoes 12-14): pais sem montadora', () => {
  const r = decodeVin('9A9AB12345C000000')
  assert.equal(r.fabricante, null)
  assert.equal(r.pais, 'Brasil')
})
