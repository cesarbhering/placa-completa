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
  'LS', 'LT', 'LTZ', 'PREMIER', 'MIDNIGHT', 'ACTIV', 'JOY', 'MAXX', 'SS', 'RS', 'SPIRIT', 'LIFE',
  // VW
  'TRENDLINE', 'COMFORTLINE', 'HIGHLINE', 'TREND', 'COMFORT', 'HIGHL', 'CROSS', 'ROBUST', 'RB', 'EXTREME',
  'LAUNCHING', 'GTS', 'GTI', 'SENSE',
  // Fiat
  'ATTRACTIVE', 'ESSENCE', 'ABSOLUTE', 'FREEDOM', 'VOLCANO', 'RANCH', 'ENDURANCE',
  'DRIVE', 'PRECISION', 'ADVENTURE', 'WAY', 'ELX', 'HLX', 'FIRE', 'TREKKING',
  'IMPETUS', 'AUDACE', 'ATTRACTION', 'ABARTH',
  // Ford
  'SE', 'SEL', 'TITANIUM', 'FREESTYLE', 'XLT', 'STORM',
  // Renault
  'EXPRESSION', 'DYNAMIQUE', 'PRIVILEGE', 'AUTHENTIQUE', 'INTENSE', 'ZEN', 'ICONIC',
  // Hyundai / Kia
  'GLS', 'PLATINUM', 'ULTIMATE', 'EVOLUTION', 'VISION',
  // Toyota (mais)
  'XRE', 'GR',
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

/**
 * Siglas de versao que o cadastro usa e o nome FIPE escreve por extenso, por
 * marca (pedido do Cesar, 14/out). Caso FPL1A52: "VW/NIVUS HL TSI AD" 2021
 * ficou ambiguo entre Comfortline, Highline e Launching Ed.; HL = Highline.
 * So vale na marca certa: "LE" ou "CL" soltos em outra marca nao sao isto.
 */
export const SIGLAS_POR_MARCA: Record<string, { rotulo: string; siglas: Record<string, string[]> }> = {
  VW: {
    rotulo: 'VW',
    siglas: {
      HL: ['HIGHLINE'], CL: ['COMFORTLINE'], TL: ['TRENDLINE'],
      LE: ['LAUNCHING'], LAUNCH: ['LAUNCHING'], LAUNCHING: ['LAUNCHING'],
      GTS: ['GTS'], GTI: ['GTI'],
    },
  },
  // Chevrolet (caso RPD2B20, 14/out): "CHEV/ONIX 10TAT PR2" = Onix Premier (a FIPE
  // escreve "PREM."). PR/PR1/PR2 = Premier e Premier II.
  GM: {
    rotulo: 'Chevrolet',
    siglas: {
      PR: ['PREM', 'PREMIER'], PR1: ['PREM', 'PREMIER'], PR2: ['PREM', 'PREMIER'],
      PREM: ['PREM', 'PREMIER'], PREMIER: ['PREM', 'PREMIER'],
      LT: ['LT'], LTZ: ['LTZ'], LS: ['LS'], RS: ['RS'], ACTIV: ['ACTIV'], MIDNIGHT: ['MIDNIGHT'],
    },
  },
}
// Como a marca aparece no cadastro.
const MARCA_SIGLAS: Record<string, string> = {
  VW: 'VW', VOLKSWAGEN: 'VW', VOLKS: 'VW', VOLKSWAGE: 'VW',
  GM: 'GM', CHEV: 'GM', CHEVROLET: 'GM', GMCHEVROLET: 'GM',
}

/**
 * Codigo GM de motor/cambio no nome do cadastro: "10TAT" = 1.0 turbo automatico,
 * "10TMT" = 1.0 turbo manual, "10MT" = 1.0 manual, "12AT"/"14AT"/"18AT".
 * So na Chevrolet (em outra marca "10AT" poderia ser outra coisa).
 */
export function codigoMotorGM(descricao: string | null | undefined): { motor: string; turbo: boolean; cambio: 'manual' | 'automatico' } | null {
  if (MARCA_SIGLAS[marcaDoNome(descricao)] !== 'GM') return null
  for (const p of palavrasDoNome(String(descricao || '')).map(norm)) {
    const m = p.match(/^(\d)(\d)(T?)(AT|MT)$/)
    if (m) return { motor: `${m[1]}.${m[2]}`, turbo: m[3] === 'T', cambio: m[4] === 'AT' ? 'automatico' : 'manual' }
  }
  return null
}

/**
 * Mercedes-Benz carros: o cadastro cola classe, numero e sufixo no nome do
 * modelo ("I/M.BENZ GLA200FF", "C200CGI", "E250CDI", "GLC300 4M"). O prefixo
 * "I/" e Importado (sai em marcaDoNome/marcaDoRegistro). Os sufixos NAO sao
 * versao, sao fatos:
 *   FF = Flex Fuel (so versoes Flex), CGI = gasolina com injecao direta,
 *   CDI/BLUETEC/D = diesel, 4M/4MATIC = tracao integral, BE = BlueEfficiency.
 * Caso QGH1J91 (14/out): GLA200FF flex trouxe tambem o GLA 200 so gasolina.
 */
export interface FatosMercedes {
  classe: string
  numero: string
  flex: boolean
  diesel: boolean
  cgi: boolean
  tracao4m: boolean
  be: boolean
}
const MARCAS_MB = new Set(['MBENZ', 'MERCEDES', 'MERCEDESBENZ', 'MB'])
export function fatosMercedes(descricao: string | null | undefined): FatosMercedes | null {
  if (!MARCAS_MB.has(marcaDoNome(descricao))) return null
  const palavras = palavrasDoNome(String(descricao || '')).map(norm)
  const m = (palavras[0] || '').match(/^([A-Z]{1,4})(\d{2,3})([A-Z0-9]*)$/)
  if (!m) return null
  const suf = [m[3], ...palavras.slice(1)].join(' ')
  const tem = (re: RegExp) => re.test(suf)
  return {
    classe: m[1], numero: m[2],
    flex: tem(/(^|\s|\d)FF(\s|$)|^FF/),
    diesel: tem(/CDI|BLUETEC|(^|\s)D(\s|$)/),
    cgi: tem(/CGI/),
    tracao4m: tem(/4M(ATIC)?/),
    be: tem(/(^|\s|I)BE(\s|$)|BLUEEFFICIENCY/),
  }
}

/** Texto da legenda dos sufixos Mercedes, pro prompt do juiz FIPE. */
export const LEGENDA_MERCEDES = 'Mercedes-Benz: prefixo "I/" no cadastro = importado; o numero vem colado na classe ("GLA200" = GLA 200 / GLA-200); sufixos colados nao sao versao: FF = Flex Fuel (so versoes Flex), CGI = gasolina com injecao direta, CDI = diesel, 4M/4MATIC = tracao integral, BE = BlueEfficiency.'

/**
 * Picape GM (S10): sufixo colado de cabine e tracao no nome do cadastro.
 * Cesar 14/out (caso PQH4374, "CHEVROLET/S10 LS DS4" 2015):
 *   DS4 = cabine dupla 4x4; DS2 = cabine dupla 4x2; CD4/CD2 idem;
 *   CS4 = cabine simples 4x4; CS2 = cabine simples 4x2.
 * Na S10, o "D" de DS(4|2) implica o 2.8 turbo diesel.
 */
export interface FatosPicapeGM { cabine: 'dupla' | 'simples'; tracao: '4X4' | '4X2'; diesel: boolean; motor: string | null }
export function fatosPicapeGM(descricao: string | null | undefined): FatosPicapeGM | null {
  if (MARCA_SIGLAS[marcaDoNome(descricao)] !== 'GM') return null
  const palavras = palavrasDoNome(String(descricao || '')).map(norm)
  for (const p of palavras) {
    const m = p.match(/^(DS|CD|CS)([24])$/)
    if (!m) continue
    const s10DS = m[1] === 'DS' && palavras[0] === 'S10'
    return { cabine: m[1] === 'CS' ? 'simples' : 'dupla', tracao: m[2] === '4' ? '4X4' : '4X2', diesel: s10DS, motor: s10DS ? '2.8' : null }
  }
  return null
}

/** Texto da legenda dos sufixos de picape GM, pro prompt do juiz FIPE. */
export const LEGENDA_PICAPE_GM = 'Picape Chevrolet (S10): sufixo colado no nome = cabine + tracao: DS4/CD4 = cabine dupla (CD) 4x4, DS2/CD2 = cabine dupla 4x2, CS4 = cabine simples (CS) 4x4, CS2 = cabine simples 4x2. Na S10, DS4/DS2 = 2.8 turbo diesel (TDI).'

const RE_FLEX_FIPE = /\bflex|flexpower|totalflex/i
const RE_TURBO_FIPE = /\b(TB|TURBO|TSI|TJET|T-JET|T200|T270|TURBOFLEX)\b/i

/** Marca do nome do cadastro: "VW/NIVUS ..." -> VW; "I/BMW 320I" -> BMW. */
export function marcaDoNome(descricao: string | null | undefined): string {
  const d = String(descricao || '').toUpperCase().replace(/^I\s*\//, '')
  return norm(d.includes('/') ? d.slice(0, d.indexOf('/')) : (d.split(/\s+/)[0] || ''))
}

/** Tabela de siglas em texto, pro prompt do juiz FIPE. */
export function siglasParaPrompt(): string {
  const ext = (v: string) => v.charAt(0) + v.slice(1).toLowerCase()
  return Object.values(SIGLAS_POR_MARCA).map(({ rotulo, siglas }) => {
    const pares = Object.entries(siglas).filter(([s, v]) => !(v.length === 1 && v[0] === s)).map(([s, v]) => `${s} = ${v.map(ext).join('/')}`)
    return `${rotulo}: ${pares.join(', ')}`
  }).join('; ')
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
  const siglas = SIGLAS_POR_MARCA[MARCA_SIGLAS[marcaDoNome(descricao)] || '']?.siglas || {}
  let versoes: string[] = []
  let motor: string | null = null
  // A 1a palavra e o modelo (COROLLA, GOL); versao vem depois.
  for (const bruta of palavras.slice(1)) {
    const m = bruta.match(/^(\d)\.(\d)/)
    if (m && !motor) { motor = `${m[1]}.${m[2]}`; continue }
    const n = norm(bruta)
    if (!versoes.length) {
      // Codigo GM de motor/cambio ("10TAT") nao e versao: so o motor sai dele.
      const gm = n.match(/^(\d)(\d)T?(AT|MT)$/)
      if (gm && MARCA_SIGLAS[marcaDoNome(descricao)] === 'GM') { if (!motor) motor = `${gm[1]}.${gm[2]}`; continue }
      if (siglas[n]) versoes = siglas[n]
      else if (VERSOES.has(n)) versoes = SINONIMOS[n] || [n]
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
  // Mercedes: classe+numero ("GLA200" casa "GLA-200"), e os sufixos como fatos.
  const mb = fatosMercedes(descricao)
  if (mb) {
    const so = (lista: T[], f: (c: T) => boolean) => { const r = lista.filter(f); return r.length ? r : lista }
    restantes = so(restantes, (c) => norm(c.modelo).includes(mb.classe + mb.numero))
    if (mb.flex) restantes = so(restantes, (c) => RE_FLEX_FIPE.test(c.modelo))
    if (mb.cgi) {
      restantes = so(restantes, (c) => /\bCGI\b/i.test(c.modelo))
      restantes = so(restantes, (c) => !RE_FLEX_FIPE.test(c.modelo) && !/diesel|cdi|bluetec/i.test(c.modelo))
    }
    if (mb.diesel) restantes = so(restantes, (c) => /diesel|\bCDI\b|bluetec|\b\d{3}d\b/i.test(c.modelo))
    if (mb.tracao4m) restantes = so(restantes, (c) => /4MATIC|\b4M\b/i.test(c.modelo))
  }
  // Picape GM: cabine, tracao e (S10 DS) o 2.8 diesel, cada um so se sobrar alguem.
  const pgm = fatosPicapeGM(descricao)
  if (pgm) {
    const so = (lista: T[], f: (c: T) => boolean) => { const r = lista.filter(f); return r.length ? r : lista }
    restantes = so(restantes, (c) => (pgm.cabine === 'dupla' ? !/\bCS\b|CABINE SIMPLES/i.test(c.modelo) : !/\bCD\b|CABINE DUPLA/i.test(c.modelo)))
    restantes = so(restantes, (c) => (pgm.tracao === '4X4' ? /\b4x4\b/i.test(c.modelo) : !/\b4x4\b/i.test(c.modelo)))
    if (pgm.diesel) restantes = so(restantes, (c) => /diesel|\bdies\.?|\bTDI\b|\bCTDI\b/i.test(c.modelo))
    if (pgm.motor) restantes = so(restantes, (c) => candidatoTemMotor(c.modelo, pgm.motor))
  }
  // Turbo do codigo GM ("10TAT" tem T): fica com as versoes TB; sem T ("10MT"),
  // tira as TB. So vale se sobrar alguem.
  const gm = codigoMotorGM(descricao)
  if (gm) {
    const porTurbo = restantes.filter((c) => RE_TURBO_FIPE.test(c.modelo) === gm.turbo)
    if (porTurbo.length) restantes = porTurbo
  }
  return filtrarPelasPortasDoNome(filtrarSedaDoNome(restantes, descricao), descricao)
}

// Hatch x seda do mesmo modelo (RPD2B20: "CHEV/ONIX 10TAT PR2" ficou entre ONIX
// HATCH PREM. e ONIX SEDAN Plus PREM.). O cadastro escreve o seda no nome
// ("ONIX PLUS", "PRISMA", "SEDAN"); sem isso, e o hatch. So decide quando a
// lista tem os dois tipos.
// "Sedan1.5" (colado no motor) tambem e seda.
const RE_SEDA_FIPE = /\b(SEDAN|SED\.?|PLUS)(?![A-Z])/i
export function filtrarSedaDoNome<T extends { modelo: string }>(lista: T[], descricao: string | null | undefined): T[] {
  const sedas = lista.filter((c) => RE_SEDA_FIPE.test(c.modelo))
  if (!sedas.length || sedas.length === lista.length) return lista
  const palavras = palavrasDoNome(String(descricao || '')).map(norm)
  if (palavras.some((p) => ['PLUS', 'SEDAN', 'SED'].includes(p))) return sedas
  if (palavras.some((p) => ['HATCH', 'HATCHBACK', 'HB'].includes(p))) return lista.filter((c) => !RE_SEDA_FIPE.test(c.modelo))
  // Nome sem nada: hatch so quando o seda e o "Plus" (Onix/Onix Plus). Em outra
  // familia (City Sedan x City Hatchback) o nome puro nao decide.
  if (!sedas.every((c) => /\bPLUS\b/i.test(c.modelo))) return lista
  const ficam = lista.filter((c) => !RE_SEDA_FIPE.test(c.modelo))
  return ficam.length ? ficam : lista
}

// --- Portas -------------------------------------------------------------------
// O cadastro conta portas sem a tampa traseira ("CELTA 2P SPIRIT"); a FIPE
// conta com ela ("Celta Spirit ... 3p"). Caso HSX1F20: Spirit 3p e 5p, o nome
// dizia 2P. Mapa: 2P -> 2p/3p, 4P -> 4p/5p (3P e 5P valem como estao).
const PORTAS_FIPE: Record<string, number[]> = { '2': [2, 3], '3': [3], '4': [4, 5], '5': [5] }
// Picape/cabine: ali o numero no nome pode ser outra coisa; nao arrisca.
const CABINE = new Set(['CS', 'CD', 'CE', 'CABINE', 'CAB', 'PICKUP', 'PICAPE'])

/** Portas que o nome do cadastro diz ("2P" -> [2, 3]), ou null quando nao diz (ou e picape). */
export function portasDoNome(descricao: string | null | undefined): number[] | null {
  const palavras = palavrasDoNome(String(descricao || '')).map(norm)
  if (palavras.some((p) => CABINE.has(p))) return null
  const achadas = palavras.map((p) => p.match(/^([2-5])P$/)?.[1]).filter(Boolean) as string[]
  if (new Set(achadas).size !== 1) return null
  return PORTAS_FIPE[achadas[0]]
}

/** Portas no nome FIPE ("... 8V 3p" -> 3), ou null. */
export function portasDaVersaoFipe(modelo: string): number | null {
  const m = String(modelo || '').match(/(?:^|[\s.])([2-5])p\b/i)
  return m ? Number(m[1]) : null
}

/**
 * Tira as versoes cuja porta a FIPE diz e nao bate com o nome. Versao sem
 * porta no nome FIPE fica. Zerou, volta a lista de antes.
 */
export function filtrarPelasPortasDoNome<T extends { modelo: string }>(lista: T[], descricao: string | null | undefined): T[] {
  const aceitas = portasDoNome(descricao)
  if (!aceitas) return lista
  const ficam = lista.filter((c) => { const n = portasDaVersaoFipe(c.modelo); return n === null || aceitas.includes(n) })
  return ficam.length ? ficam : lista
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
