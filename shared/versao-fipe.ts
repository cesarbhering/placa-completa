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
  'TRENDLINE', 'COMFORTLINE', 'HIGHLINE', 'TREND', 'COMFORT', 'HIGHL', 'CROSS',
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
}

const norm = (t: string) => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Palavras do nome sem a marca: "I/TOYOTA COROLLA XEI18VVT" -> COROLLA, XEI18VVT. */
function palavrasDoNome(descricao: string): string[] {
  let d = String(descricao || '').toUpperCase().replace(/^I\s*\//, '')
  if (d.includes('/')) d = d.slice(d.indexOf('/') + 1)
  return d.split(/\s+/).filter(Boolean)
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
