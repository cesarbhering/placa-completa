// SQLite local (better-sqlite3, sincrono e simples — o volume inteiro do
// vPIC cabe tranquilo num arquivo, sem precisar de servidor de banco a
// parte). Path configuravel por env pra bater com o volume que o infra monta
// no container (default /data/vin.db).
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const DB_PATH = process.env.VIN_DB_PATH || '/data/vin.db'

mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
  -- WMI (World Manufacturer Identifier, posicoes 1-3 do VIN): a base
  -- principal, importada da API publica do vPIC/NHTSA (dominio publico).
  -- code pode ser de 3 caracteres (WMI completo) OU menos quando o
  -- fabricante usa um WMI curto + o 12o char do VIN completa (raro fora dos
  -- EUA/pouco volume) — fica pro override cobrir esses casos especiais.
  CREATE TABLE IF NOT EXISTS wmi (
    code TEXT PRIMARY KEY,
    manufacturer_raw TEXT,
    display_name TEXT,
    country TEXT,
    region TEXT,
    vpic_manufacturer_id INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Override local: corrige/melhora uma entrada especifica (nome amigavel
  -- BR, pais/regiao errados no vPIC, etc) SEM precisar tocar no dump
  -- importado — o import roda de novo (re-rodavel) e os overrides continuam
  -- valendo, aplicados por cima na hora do decode.
  CREATE TABLE IF NOT EXISTS wmi_overrides (
    code TEXT PRIMARY KEY,
    display_name TEXT,
    country TEXT,
    region TEXT,
    notes TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Planta de fabricacao por fabricante + posicao 11 do VIN. O vPIC nao tem
  -- um mapa confiavel disso (varia por fabricante/pais, sem padrao publico
  -- unificado) — comeca vazia, povoada via override manual conforme
  -- confirmarmos casos reais.
  -- Chave-valor de controle interno (versao da tabela curada de plantas, etc).
  CREATE TABLE IF NOT EXISTS meta (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS plants (
    wmi_code TEXT NOT NULL,
    -- '*' quando o WMI inteiro pertence a uma unica fabrica (Fiat 9BD e so
    -- Betim, entao a posicao 11 nao precisa decidir nada).
    position_11 TEXT NOT NULL,
    plant_name TEXT NOT NULL,
    cidade TEXT,
    uf TEXT,
    pais TEXT,
    -- Ate quando este codigo vale. Ford Sao Bernardo e o caso: o mesmo codigo
    -- aparece depois de 2001 em carro que ja saia de Camacari, entao a cidade
    -- so pode ser afirmada ate o ano limite.
    ano_de INTEGER,
    ano_ate INTEGER,
    fonte TEXT,
    -- 'alta' e o unico nivel que vai pra tela do cliente.
    confianca TEXT NOT NULL DEFAULT 'alta',
    PRIMARY KEY (wmi_code, position_11)
  );

  -- Regra por MODELO, pra quando a posicao 11 nao separa a fabrica. Toyota
  -- 9BR e o caso: o mesmo codigo sai em Corolla (Indaiatuba) e em Yaris
  -- (Sorocaba). Quem chama o decode manda o modelo do registro (SENATRAN,
  -- "TOYOTA/YARIS HA XLS15"); a regra casa um padrao (regex) no texto
  -- normalizado. So entra em cena quando a posicao 11 nao deu cidade.
  CREATE TABLE IF NOT EXISTS plant_modelos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wmi_code TEXT NOT NULL,
    -- '*' = qualquer posicao 11 do WMI; senao, a regra vale so naquele codigo.
    position_11 TEXT NOT NULL DEFAULT '*',
    padrao TEXT NOT NULL,
    -- Regex que, se casar, derruba a regra (Corolla sim, Corolla Cross nao).
    excluir TEXT,
    plant_name TEXT NOT NULL,
    cidade TEXT,
    uf TEXT,
    pais TEXT,
    ano_de INTEGER,
    ano_ate INTEGER,
    fonte TEXT,
    confianca TEXT NOT NULL DEFAULT 'alta'
  );
  CREATE INDEX IF NOT EXISTS plant_modelos_wmi_idx ON plant_modelos (wmi_code);

  -- Ano-modelo pela posicao 10 do VIN (ISO 3779 / SAE J853). Ciclo de 30
  -- anos: o mesmo caractere serve pra duas decadas (ex: 'A' = 1980 OU 2010).
  -- year_low/year_high dao as duas leituras; o decode escolhe pela posicao 7
  -- (numerica = 1980-2009, alfabetica = 2010+), heuristica padrao da industria.
  CREATE TABLE IF NOT EXISTS year_codes (
    code TEXT PRIMARY KEY,
    year_low INTEGER NOT NULL,
    year_high INTEGER NOT NULL
  );

  -- Log de TODO decode (mesmo os que falham em achar o WMI): alimenta a
  -- curadoria de WMIs desconhecidos e as metricas agregadas que o @infra
  -- envia pro Supabase num timer diario (so agregados sobem pra nuvem — o
  -- log individual, com o hash do VIN, fica so aqui local).
  CREATE TABLE IF NOT EXISTS decode_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vin_hash TEXT NOT NULL,
    wmi_prefix TEXT NOT NULL,
    achou_wmi INTEGER NOT NULL,
    fabricante TEXT,
    pais TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS decode_log_created_idx ON decode_log (created_at);
  CREATE INDEX IF NOT EXISTS decode_log_wmi_idx ON decode_log (wmi_prefix);
`)

// year_codes: tabela fixa, sempre a mesma (padrao ISO 3779) — populada aqui
// direto (nao depende de import externo, e sempre igual).
const YEAR_CODES = [
  ['A', 1980, 2010], ['B', 1981, 2011], ['C', 1982, 2012], ['D', 1983, 2013],
  ['E', 1984, 2014], ['F', 1985, 2015], ['G', 1986, 2016], ['H', 1987, 2017],
  ['J', 1988, 2018], ['K', 1989, 2019], ['L', 1990, 2020], ['M', 1991, 2021],
  ['N', 1992, 2022], ['P', 1993, 2023], ['R', 1994, 2024], ['S', 1995, 2025],
  ['T', 1996, 2026], ['V', 1997, 2027], ['W', 1998, 2028], ['X', 1999, 2029],
  ['Y', 2000, 2030], ['1', 2001, 2031], ['2', 2002, 2032], ['3', 2003, 2033],
  ['4', 2004, 2034], ['5', 2005, 2035], ['6', 2006, 2036], ['7', 2007, 2037],
  ['8', 2008, 2038], ['9', 2009, 2039],
]
const insertYear = db.prepare('INSERT OR IGNORE INTO year_codes (code, year_low, year_high) VALUES (?, ?, ?)')
const insertYears = db.transaction((rows) => { for (const r of rows) insertYear.run(...r) })
insertYears(YEAR_CODES)

// Banco antigo ja tem `plants` com so tres colunas. CREATE TABLE IF NOT EXISTS
// nao acrescenta coluna, entao a adicao e feita aqui, uma vez, ignorando o erro
// de coluna repetida (e o jeito de "add column if not exists" no SQLite).
for (const coluna of [
  'cidade TEXT', 'uf TEXT', 'pais TEXT',
  'ano_de INTEGER', 'ano_ate INTEGER',
  'fonte TEXT', "confianca TEXT NOT NULL DEFAULT 'alta'",
]) {
  try { db.exec(`ALTER TABLE plants ADD COLUMN ${coluna}`) } catch { /* ja existe */ }
}
