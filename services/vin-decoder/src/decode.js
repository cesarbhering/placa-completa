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
import { paisPorFaixaWmi, checksumAplicavel } from './paises.js'
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
const getWmiMundo = db.prepare('SELECT * FROM wmi_mundo WHERE code = ?')
// Duas buscas: o codigo exato da posicao 11 e, se nao houver, o curinga '*'
// (WMI de fabrica unica, como o 9BD da Fiat, que so foi Betim).
const getPlant = db.prepare('SELECT * FROM plants WHERE wmi_code = ? AND position_11 IN (?, \'*\')  ORDER BY position_11 = ? DESC LIMIT 1')
const getRegrasModelo = db.prepare("SELECT * FROM plant_modelos WHERE wmi_code = ? AND position_11 IN (?, '*') ORDER BY position_11 = ? DESC, id")
const getYear = db.prepare('SELECT * FROM year_codes WHERE code = ?')

// Modelo do registro normalizado pra casar regra: maiusculo, sem acento, sem o
// prefixo de importado ("I/"), pontuacao virando espaco, com espaco nas pontas
// pra regex de palavra inteira ficar simples (" COROLLA ").
export function normalizarModelo(modelo) {
  const t = String(modelo || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/^I\s*\//, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
  return t ? ` ${t} ` : ''
}

const regexCache = new Map()
function re(p) {
  if (!regexCache.has(p)) regexCache.set(p, new RegExp(p))
  return regexCache.get(p)
}

function dentroDaJanelaDe(row, ano) {
  return (row.ano_de == null || ano == null || ano >= row.ano_de)
    && (row.ano_ate == null || ano == null || ano <= row.ano_ate)
}

// Dois niveis vao pra tela, por razoes diferentes: 'alta' e o codigo de
// posicao 11 (ou a regra de modelo) validado contra a base de leiloes;
// 'marca_unica_fabrica' e a marca que so tem um lugar onde montar, entao a
// cidade nao depende do codigo. Qualquer outro nivel ('ambigua') fica fora e,
// numa linha de posicao 11 exata, ainda BLOQUEIA o curinga '*' do WMI: e o
// jeito de dizer "este codigo nao e da fabrica unica" (van Boxer no 936).
const PUBLICAVEL = new Set(['alta', 'marca_unica_fabrica'])
const insertLog = db.prepare(
  'INSERT INTO decode_log (vin_hash, wmi_prefix, achou_wmi, fabricante, pais) VALUES (?, ?, ?, ?, ?)',
)

// Ano-modelo pelo ciclo de 30 anos do codigo (posicao 10 do VIN): o mesmo
// caractere serve pra 1980-2009, 2010-2039, 2040-2069 etc. Sem uma
// heuristica de regiao pra desempatar (a de pos7-numerica/alfabetica e
// NAFTA-only, nao vale pra VIN BR — era a causa do bug), a escolha
// deterministica e SEMPRE o candidato mais recente que nao passa de
// (ano atual + 1) — cobre veiculo 0km anunciado com ano-modelo do ano
// seguinte, sem nunca "adivinhar" um ano no futuro alem disso.
function melhorAnoDoCiclo(yearLow) {
  const limite = new Date().getFullYear() + 1
  const candidatos = [yearLow, yearLow + 30, yearLow + 60]
  const validos = candidatos.filter((c) => c <= limite)
  return validos.length ? Math.max(...validos) : yearLow
}

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

// opts.modelo: texto de marca/modelo do registro (so usado pela regra por
// modelo). opts.ano: ano-modelo do registro; quando vem, manda nas janelas de
// ano no lugar do ano do VIN (que e ambiguo no ciclo de 30 anos: um Escort
// 1995 de Sao Bernardo virava 2025 e perdia a cidade).
export function decodeVin(rawVin, opts = {}) {
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

  // WMI fora dos EUA (JMY, MMB, LVV, 988...) que o vPIC nao tem: tabela
  // curada com fonte (scripts/wmi-mundo.mjs). Vem antes do vPIC porque o
  // nome e curado (o vPIC devolve razao social crua, "Byd Auto Co.,").
  const mundo = getWmiMundo.get(wmi3)
  const achouWmi = !!row || !!override || !!mundo
  const fabricante = override?.display_name || mundo?.display_name || row?.display_name || row?.manufacturer_raw || null
  // Sem WMI na base, o pais ainda sai da faixa ISO 3780 (ver paises.js):
  // melhor "Japão" que um campo vazio num relatorio pago.
  const pais = override?.country || mundo?.country || row?.country || paisPorFaixaWmi(wmi3) || null
  const regiao = override?.region || row?.region || regiaoPorPrimeiroChar(vin[0])

  const yearRow = getYear.get(vin[9])
  // BUG achado num relatorio real (moto Yamaha 2018, chassi
  // 9C6RG3810J0006627, pos10='J'): a heuristica antiga (pos7 numerica =
  // 1980-2009, alfabetica = 2010+) e uma convencao NORTH AMERICA (NAFTA),
  // que NAO vale pra VIN brasileiro — devolvia 1988 pro que era 2018.
  // O codigo de ano se REPETE a cada 30 anos (J = 1988, 2018, 2048, ...).
  // Fix: gera os candidatos do ciclo (year_low, +30, +60) e escolhe o MAIS
  // RECENTE que nao passe de (ano atual + 1) — cobre carro 0km anunciado
  // com "ano modelo" do ano seguinte, sem nunca cair num ano futuro alem
  // disso nem regredir 30 anos por engano.
  const anoModelo = yearRow ? melhorAnoDoCiclo(yearRow.year_low) : null

  // A planta e procurada pelo WMI batido no VIN, nao so pelo codigo resolvido
  // na tabela wmi: a curadoria e por WMI real de chassi brasileiro, e o
  // resolvedCode pode ser um WMI de 2 caracteres.
  const plantRow = getPlant.get(wmi3, vin[10], vin[10])
    || (row?.code && row.code !== wmi3 ? getPlant.get(row.code, vin[10], vin[10]) : null)
  const anoRef = Number.isInteger(opts.ano) && opts.ano > 1900 && opts.ano < 2100 ? opts.ano : anoModelo
  // Fora da janela de anos, a cidade nao pode ser afirmada. E o caso da Ford
  // em Sao Bernardo: o mesmo codigo de posicao 11 aparece em carro de 2002 em
  // diante, que ja saia de Camacari. Nesse caso o relatorio mostra so a
  // montadora e o pais, que continuam verdadeiros (ou a regra por modelo
  // resolve, logo abaixo).
  let plantaOk = plantRow && dentroDaJanelaDe(plantRow, anoRef) && PUBLICAVEL.has(plantRow.confianca) ? plantRow : null

  // Regra por modelo: so quando a posicao 11 nao deu cidade e quem chamou
  // mandou o modelo. A primeira regra que casa (padrao sim, excluir nao, ano
  // dentro da janela) vence; regra de posicao 11 exata vem antes do curinga.
  const modeloNorm = normalizarModelo(opts.modelo)
  if (!plantaOk && modeloNorm) {
    for (const r of getRegrasModelo.all(wmi3, vin[10], vin[10])) {
      if (!re(r.padrao).test(modeloNorm)) continue
      if (r.excluir && re(r.excluir).test(modeloNorm)) continue
      if (!dentroDaJanelaDe(r, anoRef)) continue
      if (PUBLICAVEL.has(r.confianca)) plantaOk = r
      break
    }
  }
  // String legada (o relatorio antigo espera texto) mais o detalhe estruturado.
  const planta = plantaOk?.plant_name || null
  const plantaDetalhe = plantaOk
    ? { cidade: plantaOk.cidade || null, uf: plantaOk.uf || null, pais: plantaOk.pais || null }
    : null

  const vinHash = crypto.createHash('sha256').update(vin).digest('hex').slice(0, 16)
  try {
    insertLog.run(vinHash, wmi3, achouWmi ? 1 : 0, fabricante, pais)
  } catch { /* log e best-effort, nunca derruba o decode */ }

  return {
    valido: true,
    // O digito verificador so e obrigatorio na America do Norte. Fora disso
    // vem null ("nao se aplica"), nunca false: false sugeria chassi invalido
    // pra um chassi japones ou brasileiro perfeitamente correto.
    checksumOk: checksumAplicavel(vin) ? checkDigitOk(vin) : null,
    checksumAplicavel: checksumAplicavel(vin),
    wmi: row?.code || wmi3,
    fabricante,
    pais,
    regiao,
    anoModelo,
    planta,
    plantaDetalhe,
    vds: vin.slice(3, 9),
    serial: vin.slice(11, 17),
  }
}
