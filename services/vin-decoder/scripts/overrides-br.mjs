#!/usr/bin/env node
// Overrides pros WMIs mais relevantes pro Brasil: nomes amigaveis (o vPIC
// devolve razao social crua) e correcao de pais quando o vPIC erra/nao tem
// (comum pra fabricantes que produzem localmente sob WMI de outro pais).
// Roda DEPOIS do import-vpic.mjs. Idempotente (upsert por code).
//
// AUDITORIA (achado num relatorio real: 9C6 saiu "Peugeot Brasil" quando o
// veiculo era uma Yamaha — erro grave de dado pro cliente pagante).
// Reconferi as 29 entradas originais contra 2 fontes:
//   (a) vPIC DecodeWMI ao vivo (https://vpic.nhtsa.dot.gov/api/vehicles/decodewmi/{wmi})
//       — autoritativo, mas so cobre WMI que aparece no mercado dos EUA
//       (a maioria dos WMI genuinamente-so-Brasil NAO esta la).
//   (b) tabela WMI publica derivada da Wikipedia (github.com/WALL-E/vin-decoder,
//       csv/wmi-from-wiki.csv) — segunda fonte, cobertura parcial tambem.
//
// Resultado: 3 entradas estavam ERRADAS (confirmado via vPIC), 2 estavam
// TROCADAS entre si (Renault/Audi), 2 batiam com uma fonte so mas
// DIVERGIAM da minha entrada original (LSJ/LGB — troquei pra fonte
// externa, que e mais confiavel que um palpite sem fonte nenhuma), e 3
// NAO tinham fonte nenhuma confirmando (Nissan BR, Volvo caminhoes BR,
// Iveco BR) — REMOVIDAS: mostrar fabricante errado e pior que nao
// mostrar nada (regra do Cesar, ja aplicada nas plantas em plants-br.mjs).
//
//   9BV: era "Audi Brasil"      -> na verdade "Volvo do Brasil" (vPIC confirma)
//   9C2: era "Citroën do Brasil" -> na verdade "Moto Honda da Amazônia" (vPIC confirma)
//   9C6: era "Peugeot Brasil"    -> na verdade "Yamaha Motor da Amazônia" (vPIC confirma)
//   93U/93Y: estavam TROCADAS — 93U e Audi Brasil, 93Y e Renault Brasil
//            (fonte wiki; eu tinha invertido: 93U=Renault, 93Y=Hyundai)
//   LSJ: era "Volvo (China)"  -> fonte wiki diz "MG (China)"
//   LGB: era "BYD (China)"    -> fonte wiki diz "Dong Feng (China)"
//   93K (Nissan BR), 9BB (Volvo caminhoes BR), 9BZ (Iveco BR): REMOVIDAS,
//     sem fonte confirmando nenhuma das duas (nem vPIC nem wiki tem).
//     Idem "Hyundai Motor Brasil": o WMI que eu tinha pra ela (93Y) na
//     verdade e Renault — sem outro WMI BR confirmado pra Hyundai,
//     REMOVIDA tambem ate achar a fonte certa.
//
// As entradas que batiam com vPIC E/OU wiki ficam como estavam.
import { db } from '../src/db.js'

const OVERRIDES = [
  // ---- Fabricado no Brasil (confirmado: vPIC e/ou tabela wiki) ----
  ['9BW', 'Volkswagen do Brasil', 'Brasil', 'América do Sul'],
  ['9BD', 'Fiat Automóveis', 'Brasil', 'América do Sul'],
  ['9BG', 'General Motors do Brasil', 'Brasil', 'América do Sul'],
  ['9BF', 'Ford Brasil', 'Brasil', 'América do Sul'], // vPIC: FORD MOTOR COMPANY BRASIL LTDA.
  ['9BR', 'Toyota do Brasil', 'Brasil', 'América do Sul'],
  ['93H', 'Honda Automóveis do Brasil', 'Brasil', 'América do Sul'],
  ['9BS', 'Scania Brasil', 'Brasil', 'América do Sul'],
  ['9BM', 'Mercedes-Benz do Brasil', 'Brasil', 'América do Sul'],
  ['9BV', 'Volvo do Brasil Veículos', 'Brasil', 'América do Sul'], // vPIC: VOLVO DO BRASIL VEICULOS LTDA (corrigido — nao e Audi)
  ['9C2', 'Moto Honda da Amazônia', 'Brasil', 'América do Sul'], // vPIC: MOTO HONDA DA AMAZONIA LTDA. (corrigido — nao e Citroën)
  ['9C6', 'Yamaha Motor da Amazônia', 'Brasil', 'América do Sul'], // vPIC: YAMAHA MOTOR CORPORATION, planta Amazonas (corrigido — nao e Peugeot)
  ['93U', 'Audi Brasil', 'Brasil', 'América do Sul'], // fonte wiki (corrigido — nao e Renault)
  ['93Y', 'Renault do Brasil', 'Brasil', 'América do Sul'], // fonte wiki (corrigido — nao e Hyundai)
  ['98P', 'DAF Caminhões Brasil', 'Brasil', 'América do Sul'], // fabrica unica em Ponta Grossa (PR); base de leiloes: 98P = DAF XF/CF
  // ---- Mercosul: Argentina (fonte: tabela wiki, csv/wmi-from-wiki.csv) ----
  // Achado num relatorio real (I/VW SPACEFOX, chassi 8AW...): o vPIC nao
  // tem nenhum WMI 8A* (Count 0 no decodewmi), entao esses vinham sem
  // fabricante e sem pais. So entram os codes que a tabela wiki lista.
  ['8AW', 'Volkswagen Argentina', 'Argentina', 'América do Sul'],
  ['8AP', 'Fiat Argentina', 'Argentina', 'América do Sul'],
  ['8AF', 'Ford Argentina', 'Argentina', 'América do Sul'],
  ['8AG', 'Chevrolet Argentina', 'Argentina', 'América do Sul'],
  ['8AD', 'Peugeot Argentina', 'Argentina', 'América do Sul'],
  ['8AJ', 'Toyota Argentina', 'Argentina', 'América do Sul'],
  ['8AK', 'Suzuki Argentina', 'Argentina', 'América do Sul'],
  ['8A1', 'Renault Argentina', 'Argentina', 'América do Sul'],
  // ---- Importados comuns no BR (confirmado via vPIC) ----
  ['JHM', 'Honda (Japão)', 'Japão', 'Ásia'],
  ['JTD', 'Toyota (Japão)', 'Japão', 'Ásia'],
  ['JN1', 'Nissan (Japão)', 'Japão', 'Ásia'],
  ['WVW', 'Volkswagen (Alemanha)', 'Alemanha', 'Europa'],
  ['WBA', 'BMW (Alemanha)', 'Alemanha', 'Europa'],
  ['WDB', 'Mercedes-Benz (Alemanha)', 'Alemanha', 'Europa'],
  ['WAU', 'Audi (Alemanha)', 'Alemanha', 'Europa'],
  ['KMH', 'Hyundai (Coreia do Sul)', 'Coreia do Sul', 'Ásia'],
  ['KNA', 'Kia (Coreia do Sul)', 'Coreia do Sul', 'Ásia'],
  ['LSJ', 'MG (China)', 'China', 'Ásia'], // fonte wiki (corrigido — nao e Volvo)
  ['LGB', 'Dong Feng (China)', 'China', 'Ásia'], // fonte wiki (corrigido — nao e BYD)
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

// Limpa entradas da rodada ANTERIOR que a auditoria removeu (sem fonte
// confirmando) — sem isso, quem ja rodou este script uma vez em prod fica
// com o dado errado/sem-fonte preso na tabela pra sempre (upsert so
// atualiza/insere, nunca remove um code que saiu do array OVERRIDES).
const REMOVIDOS_NA_AUDITORIA = ['93K', '9BB', '9BZ']
const remover = db.prepare('DELETE FROM wmi_overrides WHERE code = ?')
const runRemocao = db.transaction((codes) => { for (const c of codes) remover.run(c) })
runRemocao(REMOVIDOS_NA_AUDITORIA)

const run = db.transaction((rows) => { for (const r of rows) upsert.run(...r) })
run(OVERRIDES)
console.log(`${OVERRIDES.length} overrides aplicados, ${REMOVIDOS_NA_AUDITORIA.length} removidos (sem fonte confirmando).`)
