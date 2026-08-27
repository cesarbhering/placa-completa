#!/usr/bin/env node
// Curadoria de plantas de fabricacao (posicao 11 do VIN + WMI do fabricante).
// Roda depois de import-vpic.mjs / overrides-br.mjs. Idempotente (upsert por
// wmi_code+position_11).
//
// REGRA (do Cesar): SO entra codigo com fonte publica confiavel — mostrar
// planta ERRADA e pior que nao mostrar. Na duvida, fica de fora.
//
// Por isso esta lista comeca PEQUENA: e o unico codigo que temos
// confirmado contra dado real (vPIC DecodeVin, campo PlantCity/PlantCountry,
// validado pelo Lead contra um chassi de verdade — 3C3AFFAR0CT267279).
// Pesquisei fontes publicas pros codigos de posicao 11 das plantas
// brasileiras que o Cesar pediu (Fiat Betim/Goiana, VW Taubate/Anchieta/SJP,
// GM, Honda, Toyota, Hyundai, Renault) e so achei blogs/sites de duvidosa
// autoridade (nao-oficiais, sem citar a fonte primaria) — nao confio o
// suficiente pra por num relatorio que o cliente paga e le como verdade.
//
// Como destravar: qualquer um com acesso ao vPIC (nosso IP esta bloqueado
// la agora) pode rodar DecodeVin num chassi real de cada fabrica confirmada
// (ex.: um Fiat Argo de Betim com nota fiscal/procedencia conhecida) e ler
// o campo PlantCity/PlantCountry da resposta — ai sim vira um override aqui
// com fonte confiavel. ATE la, estes campos ficam de fora de proposito.
import { db } from '../src/db.js'

const PLANTS = [
  // [wmi_code, position_11, plant_name]
  // Chrysler/Dodge/RAM (Mexico) — confirmado contra vPIC DecodeVin real
  // (3C3AFFAR0CT267279 -> PlantCity: TOLUCA, PlantCountry: MEXICO).
  ['3C3', 'T', 'Toluca, México'],
]

const upsert = db.prepare(`
  INSERT INTO plants (wmi_code, position_11, plant_name)
  VALUES (?, ?, ?)
  ON CONFLICT(wmi_code, position_11) DO UPDATE SET plant_name = excluded.plant_name
`)

const run = db.transaction((rows) => { for (const r of rows) upsert.run(...r) })
run(PLANTS)
console.log(`${PLANTS.length} planta(s) aplicada(s). Lista pequena de proposito — ver comentario no topo do arquivo.`)
