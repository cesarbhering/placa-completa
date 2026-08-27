// Decodificacao de VIN/chassi (ISO 3779), 17 caracteres.
//
// Layout padrao:
//   1-3   WMI  (World Manufacturer Identifier)
//   4-9   VDS  (Vehicle Descriptor Section)
//   9     check digit (so significativo pra VINs North America — informativo)
//   10    ano-modelo
//   11    planta de fabricacao (por fabricante, sem padrao publico unificado)
//   12-17 serial
//
// VIN nao usa I, O, Q (confundem com 1/0) — validado aqui.

import { db } from './db.js'
import crypto from 'node:crypto'

const VALID_CHARS = /^[A-HJ-NPR-Z0-9]{17}$/

// Tabela de transliteracao letra->numero pro calculo do check digit (posicao
// 9), algoritmo padrao SAE J853 / NHTSA. So vale de fato pra VINs North
// America (regiao 1-5, alguns J/K/L/M/N/R/S) — em qualquer outro caso o
// resultado e so informativo, nunca bloqueia o decode (chassi BR real bate
// "invalido" com frequencia e isso NAO significa que o chassi esteja errado).
const TRANSLIT = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
}
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]

function charValue(c) {
  if (/[0-9]/.test(c)) return Number(c)
  return TRANSLIT[c] ?? null
}

function checkDigitOk(vin) {
  let sum = 0
  for (let i = 0; i < 17; i++) {
    const v = charValue(vin[i])
    if (v === null) return false
    sum += v * WEIGHTS[i]
  }
  const remainder = sum % 11
  const expected = remainder === 10 ? 'X' : String(remainder)
  return vin[8] === expected
}

const getWmiExact = db.prepare('SELECT * FROM wmi WHERE code = ?')
const getWmiOverride = db.prepare('SELECT * FROM wmi_overrides WHERE code = ?')
const getPlant = db.prepare('SELECT plant_name FROM plants WHERE wmi_code = ? AND position_11 = ?')
const getYear = db.prepare('SELECT * FROM year_codes WHERE code = ?')
const insertLog = db.prepare(
  'INSERT INTO decode_log (vin_hash, wmi_prefix, achou_wmi, fabricante, pais) VALUES (?, ?, ?, ?, ?)',
)

// Regiao pelo 1o caractere do WMI (fallback quando o WMI completo nao esta
// na base — ainda da algo util em vez de nada).
function regiaoPorPrimeiroChar(c) {
  if (/[1-5]/.test(c)) return 'América do Norte'
  if (/[6-7]/.test(c)) return 'Oceania'
  if (/[8-9]/.test(c) || c === '0') return 'América do Sul'
  if (/[A-H]/.test(c)) return 'África'
  if (/[J-R]/.test(c)) return 'Ásia'
  if (/[S-Z]/.test(c)) return 'Europa'
  return null
}

export function decodeVin(rawVin) {
  const vin = String(rawVin || '').trim().toUpperCase()

  if (!VALID_CHARS.test(vin)) {
    return { valido: false, motivo: 'Chassi precisa ter 17 caracteres validos (sem I, O, Q).' }
  }

  const wmi3 = vin.slice(0, 3)
  const wmi2 = vin.slice(0, 2)
  // Tenta 3 chars primeiro (padrao), depois 2 (fabricantes de baixo volume
  // usam WMI de 2 chars + o 12o caractere do VIN pra completar — o vPIC
  // registra esses como codigo de 2 chars mesmo).
  const row = getWmiExact.get(wmi3) || getWmiExact.get(wmi2)
  // Override e consultado pelo codigo BATIDO no VIN (wmi3/wmi2), NAO pelo
  // codigo do row — antes so olhava o override quando `row` ja existia
  // (linha `row ? getWmiOverride.get(row.code) : null`), entao override
  // nao funcionava como fallback sozinho pra WMI ainda ausente da tabela
  // `wmi` (ex: seed do vPIC incompleto/nao rodado ainda). Override PRECISA
  // valer standalone: e a curadoria manual dos WMIs BR principais, tem que
  // resolver mesmo com a tabela `wmi` vazia.
  const override = getWmiOverride.get(wmi3) || (row ? getWmiOverride.get(row.code) : null) || getWmiOverride.get(wmi2)

  const achouWmi = !!row || !!override
  const fabricante = override?.display_name || row?.display_name || row?.manufacturer_raw || null
  const pais = override?.country || row?.country || null
  const regiao = override?.region || row?.region || regiaoPorPrimeiroChar(vin[0])

  const yearRow = getYear.get(vin[9])
  // posicao 7 numerica = 1980-2009; alfabetica = 2010+ (heuristica padrao).
  const anoModelo = yearRow
    ? (/[0-9]/.test(vin[6]) ? yearRow.year_low : yearRow.year_high)
    : null

  const resolvedCode = row?.code || (override ? wmi3 : null)
  const plantRow = resolvedCode ? getPlant.get(resolvedCode, vin[10]) : null
  const planta = plantRow?.plant_name || null

  const vinHash = crypto.createHash('sha256').update(vin).digest('hex').slice(0, 16)
  try {
    insertLog.run(vinHash, wmi3, achouWmi ? 1 : 0, fabricante, pais)
  } catch { /* log e best-effort, nunca derruba o decode */ }

  return {
    valido: true,
    checksumOk: checkDigitOk(vin),
    wmi: row?.code || wmi3,
    fabricante,
    pais,
    regiao,
    anoModelo,
    planta,
    vds: vin.slice(3, 9),
    serial: vin.slice(11, 17),
  }
}
