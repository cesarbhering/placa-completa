// Plantas de fabricacao, testadas com chassi REAL tirado da base de leiloes
// (leiloes-poc-db). Fixture de chassi de verdade, nao inventado: um VIN
// sintetico casaria com qualquer regra que a gente escrevesse, inclusive uma
// errada.
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

// [chassi, cidade esperada, uf, o que e]
const CONFIRMADOS = [
  ['9BWAA05U0CT015779', 'Taubaté', 'SP', 'Gol 2011'],
  ['9BWCA05W08T224148', 'Taubaté', 'SP', 'Gol 2008'],
  ['9BWZZZ237XP013489', 'São Bernardo do Campo', 'SP', 'Kombi 1999'],
  ['9BWAB05U3CP061256', 'São Bernardo do Campo', 'SP', 'Gol 1.6 2011'],
  ['9BWAA05Z2C4144354', 'São José dos Pinhais', 'PR', 'Fox 2012'],
  ['9BD146047T5828979', 'Betim', 'MG', 'Uno Mille 1996'],
  ['9BD358A4NLYK19556', 'Betim', 'MG', 'Argo 2019'],
  ['9BGRM69809G107637', 'Gravataí', 'RS', 'Prisma 2008'],
  ['9BFZF10B268432358', 'Camaçari', 'BA', 'Fiesta 2005'],
  ['93HEJ8650WZ203362', 'Sumaré', 'SP', 'Civic 1998'],
  ['93HGD37806Z100274', 'Sumaré', 'SP', 'Fit 2005'],
  ['9C2HB0210ER439002', 'Manaus', 'AM', 'Pop 100 2014'],
  ['9C6KE013010005797', 'Manaus', 'AM', 'YBR 125 2001'],
  ['93YBSR6RHCJ857820', 'São José dos Pinhais', 'PR', 'Sandero 2011'],
  ['93YLSR76HDJ537432', 'São José dos Pinhais', 'PR', 'Logan 2012'],
  ['94DBFAN17LB110153', 'Resende', 'RJ', 'Versa 2020'],
  ['9BHBH51DBDP118185', 'Piracicaba', 'SP', 'HB20 2013'],
  ['935FCN6A85B727858', 'Porto Real', 'RJ', 'C3 2005'],
  ['9362AKFW95B024473', 'Porto Real', 'RJ', 'Peugeot 206 2005'],
  ['9BMMF33E81A031127', 'Juiz de Fora', 'MG', 'Classe A 2001'],
]

for (const [vin, cidade, uf, oque] of CONFIRMADOS) {
  test(`${oque}: ${vin} sai de ${cidade}`, () => {
    const r = decodeVin(vin)
    assert.equal(r.valido, true)
    assert.equal(r.plantaDetalhe?.cidade, cidade)
    assert.equal(r.plantaDetalhe?.uf, uf)
    assert.equal(r.plantaDetalhe?.pais, 'Brasil')
  })
}

// O que a base NAO confirmou nao pode ganhar cidade por descuido. Estes testes
// existem pra falhar no dia em que alguem acrescentar a linha sem refazer a
// validacao.
const SEM_CIDADE = [
  ['8AG244CAXWA101195', 'Silverado argentina 1998: Cordoba, antes de Alvear (bloqueia o curinga do 8AG)'],
]

// Marcas com uma unica fabrica no Brasil: a cidade nao depende da posicao 11,
// depende de a marca so ter um lugar onde montar. Um chassi real de cada.
const MARCA_UNICA = [
  ['9CDNF41AJ7M032804', 'Suzuki/JTA Intruder 2007'],
  ['95VAC1B899M003237', 'Dafra Super 100 2009'],
  ['94J2XECE77M021384', 'Sundown Hunter 2007'],
  ['93FACECACCM000375', 'Kasinski MV Action 2012'],
]

for (const [vin, oque] of MARCA_UNICA) {
  test(`${oque}: fabrica unica no Brasil, sai de Manaus`, () => {
    const r = decodeVin(vin)
    assert.equal(r.valido, true)
    assert.equal(r.plantaDetalhe?.cidade, 'Manaus')
    assert.equal(r.plantaDetalhe?.uf, 'AM')
  })
}

for (const [vin, motivo] of SEM_CIDADE) {
  test(`sem cidade: ${motivo}`, () => {
    const r = decodeVin(vin)
    assert.equal(r.valido, true)
    assert.equal(r.plantaDetalhe, null)
    // Montadora e pais continuam saindo: eles nao dependem da planta.
    assert.ok(r.fabricante, 'montadora deveria continuar preenchida')
    assert.ok(r.pais)
  })
}
