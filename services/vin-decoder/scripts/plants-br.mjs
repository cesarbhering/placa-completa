#!/usr/bin/env node
// Curadoria de plantas de fabricacao (WMI + posicao 11 do VIN).
// Roda depois de import-vpic.mjs / overrides-br.mjs. Idempotente.
//
// REGRA (do Cesar): mostrar planta ERRADA e pior que nao mostrar. Nenhuma
// cidade entra aqui por parecer certa.
//
// Cada linha desta lista passou por DOIS filtros:
//   1. fonte publica dizendo que a montadora produz aquele modelo naquela
//      cidade;
//   2. a nossa base de leiloes (773.888 chassis unicos de 17 caracteres,
//      leiloes-poc-db) concordando: os modelos e anos que aparecem naquele
//      (WMI, posicao 11) sao compativeis com a planta, com menos de 2% de
//      contradicao e no minimo 30 veiculos de amostra.
//
// O relatorio completo da validacao, incluindo o que NAO passou, esta em
// docs/validacao-plantas.md. Codigo que nao passou simplesmente nao esta
// aqui: o relatorio mostra montadora e pais, sem cidade. Os casos mais
// instrutivos:
//   - GM (9BG B e C): misturam modelo de Sao Caetano com modelo de Sao Jose
//     dos Campos em volume grande dos dois lados. So Gravatai e afirmavel.
//   - Toyota (9BR): o codigo que seria Sorocaba tem 113 Corolla dentro.
//     37% de contradicao, hipotese derrubada.
//
// position_11 = '*' significa que o WMI inteiro e de uma fabrica so.
import { db } from '../src/db.js'

const IBGE = 'IBGE, Cadastro Central de Empresas, e comunicacao oficial da montadora'

const PLANTS = [
  // [wmi, pos11, nome, cidade, uf, pais, ano_de, ano_ate, fonte]

  // Volkswagen. Taubate faz a familia Gol; Anchieta faz Santana, Kombi e o
  // Gol antigo; Sao Jose dos Pinhais faz Fox, Golf e T-Cross.
  ['9BW', 'T', 'Taubaté (SP)', 'Taubaté', 'SP', 'Brasil', null, null, IBGE],
  ['9BW', 'P', 'São Bernardo do Campo (SP)', 'São Bernardo do Campo', 'SP', 'Brasil', null, null, IBGE],
  ['9BW', '4', 'São José dos Pinhais (PR)', 'São José dos Pinhais', 'PR', 'Brasil', null, null, IBGE],

  // Fiat. O 9BD inteiro e Betim: ate a chegada de Goiana (WMI proprio, 988)
  // a marca so tinha essa fabrica de automovel no Brasil.
  ['9BD', '*', 'Betim (MG)', 'Betim', 'MG', 'Brasil', null, null, IBGE],
  ['988', 'K', 'Goiana (PE)', 'Goiana', 'PE', 'Brasil', null, null, IBGE],

  // GM. So Gravatai passou: Celta, Prisma e Onix e nada mais.
  ['9BG', 'G', 'Gravataí (RS)', 'Gravataí', 'RS', 'Brasil', null, null, IBGE],

  // Ford. Camacari abriu em 2001 e assumiu Fiesta, Ka e EcoSport. Os codigos
  // de Sao Bernardo aparecem tambem em carro de 2002 em diante, que ja saia
  // da Bahia, entao a cidade so e afirmada ate 2001.
  ['9BF', '8', 'Camaçari (BA)', 'Camaçari', 'BA', 'Brasil', 2001, null, IBGE],
  ['9BF', 'B', 'São Bernardo do Campo (SP)', 'São Bernardo do Campo', 'SP', 'Brasil', null, 2001, IBGE],
  ['9BF', 'D', 'São Bernardo do Campo (SP)', 'São Bernardo do Campo', 'SP', 'Brasil', null, 2001, IBGE],
  ['9BF', 'E', 'São Bernardo do Campo (SP)', 'São Bernardo do Campo', 'SP', 'Brasil', null, 2001, IBGE],
  ['9BF', 'F', 'São Bernardo do Campo (SP)', 'São Bernardo do Campo', 'SP', 'Brasil', null, 2001, IBGE],
  ['9BF', 'G', 'São Bernardo do Campo (SP)', 'São Bernardo do Campo', 'SP', 'Brasil', null, 2001, IBGE],
  ['9BF', 'H', 'São Bernardo do Campo (SP)', 'São Bernardo do Campo', 'SP', 'Brasil', null, 2001, IBGE],
  ['9BF', 'P', 'São Bernardo do Campo (SP)', 'São Bernardo do Campo', 'SP', 'Brasil', null, 2001, IBGE],

  // Honda. A propria base separou as duas fabricas de automovel: o codigo K
  // so aparece de 2020 em diante, que e quando Itirapina entrou em operacao.
  ['93H', 'Z', 'Sumaré (SP)', 'Sumaré', 'SP', 'Brasil', null, null, IBGE],
  ['93H', 'K', 'Itirapina (SP)', 'Itirapina', 'SP', 'Brasil', 2019, null, IBGE],
  ['9C2', 'R', 'Manaus (AM)', 'Manaus', 'AM', 'Brasil', null, null, IBGE],

  // Yamaha.
  ['9C6', '0', 'Manaus (AM)', 'Manaus', 'AM', 'Brasil', null, null, IBGE],

  // Renault e Nissan. A Frontier e a Livina saiam da fabrica da Renault em
  // Sao Jose dos Pinhais; Versa, Kicks e March sao de Resende, que abriu em
  // 2014 e aparece na base com codigo proprio a partir dai.
  ['93Y', 'J', 'São José dos Pinhais (PR)', 'São José dos Pinhais', 'PR', 'Brasil', null, null, IBGE],
  ['94D', 'J', 'São José dos Pinhais (PR)', 'São José dos Pinhais', 'PR', 'Brasil', null, null, IBGE],
  ['94D', 'B', 'Resende (RJ)', 'Resende', 'RJ', 'Brasil', 2014, null, IBGE],

  // Hyundai, Mitsubishi, Stellantis Porto Real, Iveco, Volvo, Mercedes.
  ['9BH', 'P', 'Piracicaba (SP)', 'Piracicaba', 'SP', 'Brasil', null, null, IBGE],
  ['93X', 'C', 'Catalão (GO)', 'Catalão', 'GO', 'Brasil', null, null, IBGE],
  ['935', 'B', 'Porto Real (RJ)', 'Porto Real', 'RJ', 'Brasil', null, null, IBGE],
  ['936', 'B', 'Porto Real (RJ)', 'Porto Real', 'RJ', 'Brasil', null, null, IBGE],
  ['93Z', '8', 'Sete Lagoas (MG)', 'Sete Lagoas', 'MG', 'Brasil', null, null, IBGE],
  ['9BV', 'E', 'Curitiba (PR)', 'Curitiba', 'PR', 'Brasil', null, null, IBGE],
  ['9BM', 'A', 'Juiz de Fora (MG)', 'Juiz de Fora', 'MG', 'Brasil', null, null, IBGE],
  ['9BM', 'B', 'São Bernardo do Campo (SP)', 'São Bernardo do Campo', 'SP', 'Brasil', null, null, IBGE],

  // Fora do Brasil: unico codigo confirmado contra o vPIC real
  // (3C3AFFAR0CT267279, PlantCity TOLUCA).
  ['3C3', 'T', 'Toluca, México', 'Toluca', null, 'México', null, null, 'vPIC/NHTSA DecodeVin'],
]

const upsert = db.prepare(`
  INSERT INTO plants (wmi_code, position_11, plant_name, cidade, uf, pais, ano_de, ano_ate, fonte, confianca)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'alta')
  ON CONFLICT(wmi_code, position_11) DO UPDATE SET
    plant_name = excluded.plant_name, cidade = excluded.cidade, uf = excluded.uf,
    pais = excluded.pais, ano_de = excluded.ano_de, ano_ate = excluded.ano_ate,
    fonte = excluded.fonte, confianca = excluded.confianca
`)

const run = db.transaction((rows) => { for (const r of rows) upsert.run(...r) })
run(PLANTS)
console.log(`${PLANTS.length} planta(s) aplicada(s). Só entra codigo validado contra a base de leiloes (ver docs/validacao-plantas.md).`)
