#!/usr/bin/env node
// Overrides pros WMIs mais relevantes pro Brasil: nomes amigaveis (o vPIC
// devolve razao social crua) e correcao de pais quando o vPIC erra/nao tem
// (comum pra fabricantes que produzem localmente sob WMI de outro pais).
// Roda DEPOIS do import-vpic.mjs. Idempotente (upsert por code).
//
// Curadoria inicial: fabricantes com planta no Brasil + os WMIs de
// importados mais comuns no mercado BR. Lista cresce conforme a curadoria
// dos decode_log de WMI desconhecido apontar o que falta.
import { db } from '../src/db.js'

const OVERRIDES = [
  // ---- Fabricado no Brasil ----
  ['9BW', 'Volkswagen do Brasil', 'Brasil', 'América do Sul'],
  ['9BD', 'Fiat Automóveis', 'Brasil', 'América do Sul'],
  ['9BG', 'General Motors do Brasil', 'Brasil', 'América do Sul'],
  ['9BF', 'Ford Brasil', 'Brasil', 'América do Sul'],
  ['9BR', 'Toyota do Brasil', 'Brasil', 'América do Sul'],
  ['93H', 'Honda Automóveis do Brasil', 'Brasil', 'América do Sul'],
  ['93Y', 'Hyundai Motor Brasil', 'Brasil', 'América do Sul'],
  ['9BS', 'Scania Brasil', 'Brasil', 'América do Sul'],
  ['9BM', 'Mercedes-Benz do Brasil', 'Brasil', 'América do Sul'],
  ['9BV', 'Audi Brasil', 'Brasil', 'América do Sul'],
  ['9C2', 'Citroën do Brasil', 'Brasil', 'América do Sul'],
  ['9C6', 'Peugeot Brasil', 'Brasil', 'América do Sul'],
  ['93U', 'Renault do Brasil', 'Brasil', 'América do Sul'],
  ['93K', 'Nissan do Brasil', 'Brasil', 'América do Sul'],
  ['9BB', 'Volvo do Brasil (caminhões)', 'Brasil', 'América do Sul'],
  ['9BZ', 'Iveco Brasil', 'Brasil', 'América do Sul'],
  // ---- Importados comuns no BR ----
  ['JHM', 'Honda (Japão)', 'Japão', 'Ásia'],
  ['JTD', 'Toyota (Japão)', 'Japão', 'Ásia'],
  ['JN1', 'Nissan (Japão)', 'Japão', 'Ásia'],
  ['WVW', 'Volkswagen (Alemanha)', 'Alemanha', 'Europa'],
  ['WBA', 'BMW (Alemanha)', 'Alemanha', 'Europa'],
  ['WDB', 'Mercedes-Benz (Alemanha)', 'Alemanha', 'Europa'],
  ['WAU', 'Audi (Alemanha)', 'Alemanha', 'Europa'],
  ['KMH', 'Hyundai (Coreia do Sul)', 'Coreia do Sul', 'Ásia'],
  ['KNA', 'Kia (Coreia do Sul)', 'Coreia do Sul', 'Ásia'],
  ['LSJ', 'Volvo (China)', 'China', 'Ásia'],
  ['LGB', 'BYD (China)', 'China', 'Ásia'],
  ['1FA', 'Ford (EUA)', 'Estados Unidos', 'América do Norte'],
  ['1GC', 'Chevrolet (EUA)', 'Estados Unidos', 'América do Norte'],
]

const upsert = db.prepare(`
  INSERT INTO wmi_overrides (code, display_name, country, region, updated_at)
  VALUES (?, ?, ?, ?, datetime('now'))
  ON CONFLICT(code) DO UPDATE SET
    display_name = excluded.display_name,
    country = excluded.country,
    region = excluded.region,
    updated_at = excluded.updated_at
`)

const run = db.transaction((rows) => { for (const r of rows) upsert.run(...r) })
run(OVERRIDES)
console.log(`${OVERRIDES.length} overrides aplicados.`)
