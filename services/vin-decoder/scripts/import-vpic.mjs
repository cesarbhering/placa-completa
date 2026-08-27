#!/usr/bin/env node
// ============================================================
// Importa a base de WMI (World Manufacturer Identifier) do vPIC/NHTSA
// (dominio publico, API sem chave) pro SQLite local. Reproduzivel e
// re-rodavel: pode rodar de novo quando o vPIC atualizar, sem duplicar nada
// (upsert por `code`, PK da tabela wmi).
//
// ESCOLHA DE FONTE (documentada conforme pedido): usei a API publica REST
// (opcao "a" do despacho) em vez do dump .bak do SQL Server (opcao "b") ou
// de mirrors de terceiros (opcao "c"):
//   - (a) API: sem instalar SQL Server/ferramenta de conversao, dado
//     estruturado e ja normalizado pelo proprio NHTSA, atualizado, sem
//     dependencia de terceiro pra confiar na procedencia. Downside: um job
//     mais lento (paginado, milhares de chamadas) — aceitavel pra um import
//     que roda raramente (nao e caminho quente).
//   - (b) o dump .bak e Microsoft SQL Server proprietario: converter pra
//     SQLite exigiria uma ferramenta/etapa extra so pra rodar este import
//     uma vez, sem ganho real (a API expoe as mesmas tabelas Wmi/Manufacturer).
//   - (c) mirrors de terceiros: procedencia/atualizacao incertas, prefiro a
//     fonte primaria mesmo sendo mais lenta.
//
// Fluxo:
//   1. GetAllManufacturers (paginado) -> lista de fabricantes (Mfr_ID, Mfr_Name)
//   2. Pra cada fabricante: GetWMIsForManufacturer/{Mfr_ID} -> WMIs dele
//   3. Upsert em `wmi` (code, manufacturer_raw, display_name, country,
//      vpic_manufacturer_id)
//
// Uso: node scripts/import-vpic.mjs [--limit N] [--concurrency N]
// ============================================================
import { db } from '../src/db.js'

const BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles'
const args = process.argv.slice(2)
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? Number(args[i + 1]) : def
}
const LIMIT = flag('limit', Infinity) // pra testar com um subconjunto
const CONCURRENCY = flag('concurrency', 5)

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      if (i === retries - 1) throw e
      await new Promise((r) => setTimeout(r, 500 * (i + 1)))
    }
  }
}

// Deriva um nome mais legivel do nome cru do vPIC ("VOLKSWAGEN DO BRASIL
// IND. DE VEICULOS AUTOMOTORES LTDA" -> "Volkswagen do Brasil"). Regra
// generica: corta sufixos societarios/administrativos comuns, tira excesso
// de maiusculas. Overrides especificos (nomes BR bonitos, por exemplo)
// entram via tabela wmi_overrides, nao aqui — este e so o fallback razoavel
// pra tudo que nao tem override manual.
const SUFFIX_CUT = /\s+(LTDA\.?|LTD\.?|INC\.?|CORP(ORATION)?\.?|CO\.?|S\.?A\.?|GMBH|AG|N\.?V\.?|IND(\.|USTRIA)?\s+DE\s+VEICULOS.*|MOTOR\s+(COMPANY|CORPORATION)|AUTOMOTORES?\s.*|VEICULOS.*)$/i

function displayName(raw) {
  if (!raw) return null
  let s = String(raw).trim()
  // corta sufixos repetidamente (alguns nomes tem mais de um)
  let prev
  do {
    prev = s
    s = s.replace(SUFFIX_CUT, '').trim()
  } while (s !== prev && s.length > 3)
  // Title Case simples (mantem siglas curtas em maiusculo, ex: "GM", "BMW")
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

const upsertWmi = db.prepare(`
  INSERT INTO wmi (code, manufacturer_raw, display_name, country, vpic_manufacturer_id, updated_at)
  VALUES (@code, @manufacturer_raw, @display_name, @country, @vpic_manufacturer_id, datetime('now'))
  ON CONFLICT(code) DO UPDATE SET
    manufacturer_raw = excluded.manufacturer_raw,
    display_name = excluded.display_name,
    country = excluded.country,
    vpic_manufacturer_id = excluded.vpic_manufacturer_id,
    updated_at = excluded.updated_at
`)

async function getAllManufacturers() {
  const out = []
  let page = 1
  while (out.length < LIMIT) {
    const data = await fetchJson(`${BASE}/GetAllManufacturers?format=json&page=${page}`)
    const results = data?.Results || []
    if (!results.length) break
    out.push(...results)
    console.log(`[manufacturers] pagina ${page}: +${results.length} (total ${out.length})`)
    page++
    if (results.length < 100) break // ultima pagina (vPIC pagina de 100 em 100)
  }
  return out.slice(0, LIMIT)
}

async function importManufacturerWmis(mfr) {
  try {
    const data = await fetchJson(`${BASE}/GetWMIsForManufacturer/${mfr.Mfr_ID}?format=json`)
    const rows = data?.Results || []
    let count = 0
    for (const r of rows) {
      const code = String(r.WMI || '').trim().toUpperCase()
      if (!code || code.length > 3) continue
      upsertWmi.run({
        code,
        manufacturer_raw: mfr.Mfr_Name,
        display_name: displayName(mfr.Mfr_CommonName || mfr.Mfr_Name),
        country: r.Country || null,
        vpic_manufacturer_id: mfr.Mfr_ID,
      })
      count++
    }
    return count
  } catch (e) {
    console.warn(`[wmi] falhou pro fabricante ${mfr.Mfr_ID} (${mfr.Mfr_Name}):`, e.message)
    return 0
  }
}

async function pool(items, worker, concurrency) {
  let i = 0
  let totalWmi = 0
  async function next() {
    while (i < items.length) {
      const idx = i++
      totalWmi += await worker(items[idx])
      if (idx % 50 === 0) console.log(`[wmi] progresso: ${idx}/${items.length} fabricantes, ${totalWmi} WMIs ate agora`)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next))
  return totalWmi
}

async function main() {
  console.log('Importando fabricantes do vPIC...')
  const manufacturers = await getAllManufacturers()
  console.log(`${manufacturers.length} fabricantes encontrados. Importando WMIs (concurrency=${CONCURRENCY})...`)
  const total = await pool(manufacturers, importManufacturerWmis, CONCURRENCY)
  const finalCount = db.prepare('SELECT COUNT(*) AS n FROM wmi').get().n
  console.log(`Import concluido. ${total} WMIs processados nesta rodada, ${finalCount} WMIs na tabela no total.`)
}

main().catch((e) => {
  console.error('Import falhou:', e)
  process.exit(1)
})
