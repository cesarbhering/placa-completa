// Versao (acabamento) e motorizacao que ja vem no NOME do veiculo no registro.
//
// Caso DMV4C01: "TOYOTA/COROLLA XEI18VVT" 2004. A shortlist ambigua trouxe
// XEi Aut, XEi Mec e SE-G Aut. O nome diz XEi: o SE-G nao tinha nada a ver, a
// duvida real era so o cambio. Aqui sai a versao do nome (inclusive colada,
// "XEI18VVT") e a motorizacao ("1.8"), pra filtrar candidatos FIPE no funil e
// na lista exibida. Usado no servidor e na tela.

// Versoes/acabamentos conhecidos, ja normalizados (sem hifen/ponto, caixa alta).
const VERSOES = new Set([
  // Toyota
  'XEI', 'XLI', 'GLI', 'SEG', 'ALTIS', 'XRS', 'XRX', 'XS', 'XLS', 'SRV', 'SRX', 'SR',
  // Honda
  'LX', 'LXS', 'LXL', 'LXR', 'EX', 'EXS', 'EXL', 'EXR', 'DX', 'TOURING',
  // GM
  'LS', 'LT', 'LTZ', 'PREMIER', 'MIDNIGHT', 'ACTIV', 'JOY', 'MAXX', 'SS', 'RS',
  // VW
  'TRENDLINE', 'COMFORTLINE', 'HIGHLINE', 'TREND', 'COMFORT', 'HIGHL', 'CROSS', 'ROBUST', 'RB', 'EXTREME',
  // Fiat
  'ATTRACTIVE', 'ESSENCE', 'ABSOLUTE', 'FREEDOM', 'VOLCANO', 'RANCH', 'ENDURANCE',
  'DRIVE', 'PRECISION', 'ADVENTURE', 'WAY', 'ELX', 'HLX', 'FIRE', 'TREKKING',
  // Ford
  'SE', 'SEL', 'TITANIUM', 'FREESTYLE', 'XLT', 'STORM',
  // Renault
  'EXPRESSION', 'DYNAMIQUE', 'PRIVILEGE', 'AUTHENTIQUE', 'INTENSE', 'ZEN', 'ICONIC',
  // Hyundai / Kia
  'GLS', 'PLATINUM', 'ULTIMATE',
  // Nissan
  'SV', 'SL', 'EXCLUSIVE', 'ADVANCE',
  // Jeep / Peugeot / Citroen
  'LONGITUDE', 'LIMITED', 'SPORT', 'TRAILHAWK', 'ALLURE', 'GRIFFE', 'ACTIVE', 'TENDANCE', 'FEEL', 'SHINE',
])

// Abreviacao do registro -> nomes possiveis na FIPE.
const SINONIMOS: Record<string, string[]> = {
  TREND: ['TREND', 'TRENDLINE'],
  COMFORT: ['COMFORT', 'COMFORTLINE'],
  HIGHL: ['HIGHLINE'],
  // VW: "SAVEIRO CS RB MF" = Robust.
  RB: ['ROBUST'],
}

const norm = (t: string) => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Palavras do nome sem a marca: "I/TOYOTA COROLLA XEI18VVT" -> COROLLA, XEI18VVT. */
function palavrasDoNome(descricao: string): string[] {
  let d = String(descricao || '').toUpperCase().replace(/^I\s*\//, '')
  // "TOYOTA/COROLLA X": marca antes da barra. Importado sem segunda barra
  // ("I/BMW 320I"): a marca e a primeira palavra.
  if (d.includes('/')) return d.slice(d.indexOf('/') + 1).split(/\s+/).filter(Boolean)
  return d.split(/\s+/).filter(Boolean).slice(1)
}

export interface VersaoDoNome {
  /** Versoes aceitas na FIPE (normalizadas). Vazio = nome sem versao reconhecida. */
  versoes: string[]
  /** Motorizacao do nome ("1.8"), quando houver. */
  motor: string | null
}

export function versaoDoNome(descricao: string | null | undefined): VersaoDoNome {
  const palavras = palavrasDoNome(String(descricao || ''))
  let versoes: string[] = []
  let motor: string | null = null
  // A 1a palavra e o modelo (COROLLA, GOL); versao vem depois.
  for (const bruta of palavras.slice(1)) {
    const m = bruta.match(/^(\d)\.(\d)/)
    if (m && !motor) { motor = `${m[1]}.${m[2]}`; continue }
    const n = norm(bruta)
    if (!versoes.length) {
      if (VERSOES.has(n)) versoes = SINONIMOS[n] || [n]
      else {
        // Colada na motorizacao: "XEI18VVT" -> XEI + 1.8.
        const colada = n.match(/^([A-Z]{2,})(\d)(\d)(?:[A-Z]*)$/)
        if (colada && VERSOES.has(colada[1])) {
          versoes = SINONIMOS[colada[1]] || [colada[1]]
          if (!motor) motor = `${colada[2]}.${colada[3]}`
        }
        // Motorizacao antes da versao: "MARCH 16SV" -> 1.6 + SV.
        const antes = n.match(/^(\d)(\d)([A-Z]{2,})$/)
        if (!versoes.length && antes && VERSOES.has(antes[3])) {
          versoes = SINONIMOS[antes[3]] || [antes[3]]
          if (!motor) motor = `${antes[1]}.${antes[2]}`
        }
      }
    }
  }
  return { versoes, motor }
}

/** O nome FIPE tem a versao? Compara palavra inteira normalizada: LT nao casa com LTZ; SE-G casa com SEG. */
export function candidatoTemVersaoDoNome(modelo: string, versoes: string[]): boolean {
  if (!versoes.length) return true
  const palavras = String(modelo || '').split(/[\s/]+/).map(norm)
  return palavras.some((p) => versoes.includes(p))
}

export function candidatoTemMotor(modelo: string, motor: string | null): boolean {
  if (!motor) return true
  return new RegExp(`(^|[^\\d.])${motor.replace('.', '\\.')}(?!\\d)`).test(String(modelo || ''))
}

/**
 * Filtra pela versao e motorizacao do nome. Cada filtro so vale se deixar
 * alguem: zerou, volta a lista de antes (comportamento de sempre).
 */
export function filtrarPelaVersaoDoNome<T extends { modelo: string }>(lista: T[], descricao: string | null | undefined): T[] {
  const { versoes, motor } = versaoDoNome(descricao)
  let restantes = lista
  if (versoes.length) {
    const porVersao = restantes.filter((c) => candidatoTemVersaoDoNome(c.modelo, versoes))
    if (porVersao.length) restantes = porVersao
  }
  if (motor) {
    const porMotor = restantes.filter((c) => candidatoTemMotor(c.modelo, motor))
    if (porMotor.length) restantes = porMotor
  }
  return restantes
}

// ---------------------------------------------------------------------------
// Nome do MODELO e cabine (casos TTR6F65, FZK5F28, GMF8I88): TRACKER nunca
// lista ONIX, PCX nao lista CB/NC/XRE, SAVEIRO CS nao lista cabine dupla.
// ---------------------------------------------------------------------------

// Prefixos que nao sao o modelo: "VW/NOVO GOL", "FIAT/NOVA STRADA".
const PREFIXO_NAO_MODELO = new Set(['NOVO', 'NOVA', 'NEW', 'NOUVEAU'])

/** "CHEV/TRACKER T A" -> TRACKER; "VW/NOVO GOL 1.0" -> GOL. Normalizado. */
export function modeloDoNome(descricao: string | null | undefined): string | null {
  const palavras = palavrasDoNome(String(descricao || '')).map(norm).filter(Boolean)
  const p = palavras[0] && PREFIXO_NAO_MODELO.has(palavras[0]) ? palavras[1] : palavras[0]
  return p && p.length >= 2 ? p : null
}

/**
 * O nome FIPE e do mesmo modelo? Olha as duas primeiras palavras do nome FIPE
 * (onde o modelo fica: "ONIX HATCH LT", "Gol (novo)", "C-180"). Aceita prefixo
 * nos dois sentidos pra abreviacao: 320I ~ 320iA, HB20 ~ HB20S.
 */
export function candidatoEDoModelo(modelo: string, nome: string | null): boolean {
  if (!nome) return true
  const palavras = String(modelo || '').split(/[\s/(]+/).map(norm).filter(Boolean).slice(0, 2)
  return palavras.some((w) => w.startsWith(nome) || (w.length >= 3 && nome.startsWith(w)))
}

export function cabineDoNome(descricao: string | null | undefined): 'simples' | 'dupla' | null {
  const d = String(descricao ?? '').toUpperCase()
  if (/\bCD\b|CABINE DUPLA/.test(d)) return 'dupla'
  if (/\bCS\b|CABINE SIMPLES/.test(d)) return 'simples'
  return null
}

export function candidatoTemCabine(modelo: string, cabine: 'simples' | 'dupla' | null): boolean {
  if (!cabine) return true
  const temCd = /\bCD\b|CABINE DUPLA/i.test(modelo)
  const temCs = /\bCS\b|CABINE SIMPLES/i.test(modelo)
  return cabine === 'simples' ? !temCd : !temCs
}

/** Mantem so os do mesmo modelo do nome. Zerou: volta a lista (fail-safe do funil). */
export function filtrarPeloModeloDoNome<T extends { modelo: string }>(lista: T[], descricao: string | null | undefined): T[] {
  const nome = modeloDoNome(descricao)
  if (!nome) return lista
  const mesmos = lista.filter((c) => candidatoEDoModelo(c.modelo, nome))
  return mesmos.length ? mesmos : lista
}

/**
 * Lista de versoes compativeis EXIBIDA no relatorio. Diferente do funil, aqui
 * nenhuma versao do modelo do nome = nada a mostrar: um TRACKER nao pode
 * listar ONIX nem como "compativel". As outras regras (cabine, versao,
 * motorizacao) voltam a lista de antes quando zeram.
 */
export function versoesParaExibir<T extends { modelo: string }>(lista: T[], descricao: string | null | undefined): T[] {
  const nome = modeloDoNome(descricao)
  let restantes = nome ? lista.filter((c) => candidatoEDoModelo(c.modelo, nome)) : lista
  if (!restantes.length) return []
  const cabine = cabineDoNome(descricao)
  if (cabine) {
    const porCabine = restantes.filter((c) => candidatoTemCabine(c.modelo, cabine))
    if (porCabine.length) restantes = porCabine
  }
  return filtrarPelaVersaoDoNome(restantes, descricao)
}

/**
 * Funil pelo nome inteiro (modelo, cabine, versao, motorizacao), cada passo
 * voltando a lista de antes quando zera. Usado onde nao ha funil completo: o
 * melhor score da fonte livre no fallback (fipe-api fora/lenta). Sem isso o
 * fallback de uma "SAVEIRO CS" era a Saveiro Extreme CD.
 */
export function filtrarPeloNomeDoVeiculo<T>(lista: T[], descricao: string | null | undefined, nomeDe: (x: T) => string): T[] {
  const comModelo = lista.map((x) => ({ x, modelo: nomeDe(x) }))
  let r = filtrarPeloModeloDoNome(comModelo, descricao)
  const cabine = cabineDoNome(descricao)
  if (cabine) {
    const porCabine = r.filter((c) => candidatoTemCabine(c.modelo, cabine))
    if (porCabine.length) r = porCabine
  }
  return filtrarPelaVersaoDoNome(r, descricao).map((c) => c.x)
}
