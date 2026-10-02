// Tabela v5: regra por modelo (Toyota 9BR), GM B/C, Ford B ate 2019, vans da
// Iveco, novos WMIs. Chassi REAL tirado da base de leiloes, com o modelo do
// jeito que chega no registro.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.VIN_DB_PATH = join(mkdtempSync(join(tmpdir(), 'vin-')), 'vin.db')

let decodeVin, normalizarModelo
before(async () => {
  await import('../scripts/overrides-br.mjs')
  const { aplicarPlantas } = await import('../scripts/plants-br.mjs')
  aplicarPlantas()
  ;({ decodeVin, normalizarModelo } = await import('../src/decode.js'))
})

// [chassi, modelo do registro, ano, cidade esperada (null = sem cidade), o que e]
const CASOS = [
  // O caso que abriu o trabalho: relatorio RZJ5F09, Yaris 2022.
  ['9BRCCAA3XP8173354', 'TOYOTA/YARIS HA XLS15', 2022, 'Sorocaba', 'Yaris 2022 (RZJ5F09)'],
  ['9BRBC3F31R8245559', 'TOYOTA/YARIS SEDA', 2024, 'Sorocaba', 'Yaris sedã 2024, mesmo codigo 8 do Corolla'],
  ['9BR53ZEC138500622', 'TOYOTA/COROLLA XLI16VVT', 2003, 'Indaiatuba', 'Corolla 2003'],
  ['9BRB29BT0D2001117', 'TOYOTA/ETIOS SEDA', 2013, 'Sorocaba', 'Etios 2013'],
  ['9BRK3AAG1P0037529', 'TOYOTA/COROLLA CROSS XRE', 2023, 'Sorocaba', 'Corolla Cross 2023'],
  ['9BRK3AAG1P0037529', 'TOYOTA/COROLLACROSS XRE', 2023, 'Sorocaba', 'Corolla Cross escrito junto'],
  // Corolla de 2027 em diante: a fabrica mudou pra Sorocaba, fica sem cidade.
  ['9BR53ZEC138500622', 'TOYOTA/COROLLA XEI', 2027, null, 'Corolla 2027, fora da janela de Indaiatuba'],
  // Sem modelo, a Toyota continua sem cidade: a posicao 11 nao decide.
  ['9BRCCAA3XP8173354', null, 2022, null, 'Yaris sem modelo no pedido'],
  // GM: B = Sao Caetano, C = Sao Jose dos Campos.
  ['9BGJA75Z0DB193399', 'CHEV/SPIN 1.8L MT', 2013, 'São Caetano do Sul', 'Spin 2013'],
  ['9BG5JG08SEB001065', 'GM/MONZA', 1984, 'São Caetano do Sul', 'Monza 1984'],
  ['9BG121ARTTC924702', 'GM/S10', 1996, 'São José dos Campos', 'S10 1996'],
  ['9BGX275005C249757', 'GM/MERIVA JOY', 2005, 'São José dos Campos', 'Meriva 2005'],
  // Ford B e Sao Bernardo ate 2019, nao so ate 2001.
  ['9BFBLZGDA7B585467', 'FORD/KA', 2007, 'São Bernardo do Campo', 'Ka 2007'],
  ['9BFZC52P0AB894745', 'FORD/COURIER L 1.6 FLEX', 2010, 'São Bernardo do Campo', 'Courier 2010'],
  // Vans da Iveco: saiam do 935/936 como Porto Real por causa do curinga.
  ['936231BZ221006905', 'PEUGEOT/BOXER FURG', 2002, 'Sete Lagoas', 'Boxer 2002'],
  ['935Z6MMWCE2133401', 'CITROEN/JUMPER M35LH 2.3', 2014, 'Sete Lagoas', 'Jumper 2014'],
  ['9BW30Z55ZRB5N1183', 'VW/LOGUS CL 1.8', 1994, 'São Bernardo do Campo', 'Logus 1994 (Autolatina)'],
  ['9BW7J82649R912575', 'VW/31-320 E CONSTELLATION', 2009, 'Resende', 'Constellation 2009'],
  ['95PAAL51BLB001591', 'CAOA CHERY/TIGGO 7', 2020, 'Anápolis', 'Tiggo 7 2020'],
  ['98RDA11B1FA000963', 'CHERY/CELER 1.5', 2015, 'Jacareí', 'Celer 2015'],
  ['99KC3200ALM100120', 'JTZ/AGILITY 200', 2020, 'Manaus', 'JTZ 2020'],
  ['9BM934241JS042522', 'M.BENZ/ACTROS 2651', 2018, 'Juiz de Fora', 'Actros 2018'],
  ['WV1D842H0CA071516', 'I/VW AMAROK HIGHLINE', 2012, 'General Pacheco', 'Amarok argentina'],
  ['8AG244CAXWA101195', 'I/GM SILVERADO', 1998, null, 'Silverado argentina pre-Alvear'],
]

for (const [vin, modelo, ano, cidade, oque] of CASOS) {
  test(`${oque}: ${cidade ?? 'sem cidade'}`, () => {
    const r = decodeVin(vin, { modelo, ano })
    assert.equal(r.valido, true)
    assert.equal(r.plantaDetalhe?.cidade ?? null, cidade)
    if (!cidade) assert.ok(r.fabricante && r.pais, 'montadora e pais continuam saindo')
  })
}

test('ano do registro manda na janela: Escort 1995 nao vira 2025 e perde a cidade', () => {
  // Posicao 10 'S' = 1995 ou 2025; sozinho o decoder escolhe 2025 e a janela
  // de Sao Bernardo (ate 2001) derrubava a cidade.
  const vin = '9BFZZZ54ZSB636905' // Escort 1.6i GL 1995, real
  assert.equal(decodeVin(vin).plantaDetalhe, null)
  assert.equal(decodeVin(vin, { ano: 1995 }).plantaDetalhe?.cidade, 'São Bernardo do Campo')
})

test('normalizarModelo tira acento, prefixo de importado e pontuacao', () => {
  assert.equal(normalizarModelo('I/Toyota Corolla-Cross XRÉ'), ' TOYOTA COROLLA CROSS XRE ')
  assert.equal(normalizarModelo(null), '')
})

test('linha que sai do arquivo sai do banco (tabela e substituida, nao so upsert)', async () => {
  const { db } = await import('../src/db.js')
  db.prepare("INSERT INTO plants (wmi_code, position_11, plant_name, confianca) VALUES ('ZZZ', '*', 'lixo', 'alta')").run()
  const { aplicarPlantas } = await import('../scripts/plants-br.mjs')
  aplicarPlantas()
  assert.equal(db.prepare("SELECT count(*) c FROM plants WHERE wmi_code = 'ZZZ'").get().c, 0)
})

// Pais de FABRICACAO e o da planta, nao o da sede da marca (01/out): a marca
// fica no fabricante. Regra pedida no caso do Audi Q3 2016 feito em Martorell.
test('pais de fabricacao = pais da planta quando ela e conhecida', () => {
  const r = decodeVin('W1KXXXXXXXN000000')
  assert.equal(r.plantaDetalhe?.cidade, 'Kecskemét')
  assert.equal(r.pais, 'Hungria')
})
