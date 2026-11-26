// IPVA rates for passenger cars (automóvel de passeio) by state. Single source:
// the paid report (12-month cost in pages/premium/[token].vue, 5-year cost in
// server/utils/icv5.ts) and /ipva-2027 read from here.
//
// Each checked state carries the official source where the rate was read (state
// finance department, state law or decree, official gazette) and the check date.
// A state without an official source keeps its old number and has no `fonte`:
// the paid report still uses it, and /ipva-2027 shows "não conferida".
//
// Some states tier the passenger-car rate by engine power, engine size or value.
// The tier is only picked from data we hold (registry power and engine size,
// FIPE value); without it there is no single rate and the callers show a range
// or nothing (Lead, 26/11/2026: never guess a tier, in the page or in the paid
// report).
//
// Fuel follows the source (Lead, 26/11/2026): where the state's rate applies to
// every automóvel, it applies to any fuel, unknown included. Where the source
// has its own rule for a fuel, that fuel gets the stated rate, or no rate when
// we don't model the rule (e.g. an exemption up to a value); an unknown fuel
// then gets no rate unless every fuel rule gives the same number.

import { propulsao } from './propulsao'

/** Fuel groups that change the rate. 'comum' = gasoline or flex. */
export type CombustivelIpva = 'comum' | 'etanol' | 'diesel' | 'eletrico' | 'hibrido' | 'gnv'
export type CombustivelEspecial = Exclude<CombustivelIpva, 'comum'>

export type BaseFaixa = 'potencia_cv' | 'potencia_hp' | 'cilindrada' | 'valor'

export interface FaixasIpva {
  base: BaseFaixa
  /** Ascending tiers; `ate` is the inclusive upper bound, null = no upper bound. */
  limites: { ate: number | null; aliquota: number }[]
  /** The tiers as the page shows them (pt-BR). */
  descricao: string
}

export interface AliquotaUf {
  /** Rate for gasoline and flex passenger cars (when there are no tiers). */
  aliquota?: number
  /** Tiers for gasoline and flex passenger cars. */
  faixas?: FaixasIpva
  /**
   * Fuels with their own rule in the source: the stated rate, or null when the
   * rule is not modeled here (no number for that fuel). A fuel not listed
   * follows the general rate.
   */
  porCombustivel?: Partial<Record<CombustivelEspecial, number | null>>
  /** Official page or act where the rate was read. Absent = not checked. */
  fonte?: { nome: string; url: string }
  conferidoEm?: string
}

export const CONFERIDO_EM = '26/11/2026'

export const ALIQUOTAS_IPVA: Readonly<Record<string, AliquotaUf>> = {
  AC: {
    aliquota: 0.02,
    fonte: { nome: 'Lei Complementar 483/2024, art. 25 (Legis Acre)', url: 'https://legis.ac.gov.br/detalhar/6246' },
    conferidoEm: CONFERIDO_EM,
  },
  AL: {
    faixas: { base: 'potencia_hp', limites: [{ ate: 80, aliquota: 0.0275 }, { ate: 160, aliquota: 0.03 }, { ate: null, aliquota: 0.0325 }], descricao: '2,75% até 80 HP, 3% acima de 80 até 160 HP e 3,25% acima de 160 HP' },
    // Lei 9.093/2023 added GNV 1.5% and rates for electric and hybrid cars.
    porCombustivel: { gnv: 0.015, eletrico: null, hibrido: null },
    fonte: { nome: 'Lei 6.555/2004, art. 8º, IV (texto da Lei 7.862/2016)', url: 'https://sapl.al.al.leg.br/media/sapl/public/normajuridica/2016/1269/1269_texto_integral.pdf' },
    conferidoEm: CONFERIDO_EM,
  },
  // The 1.5% tier of the law ("automóvel de passeio com potência até 1000
  // cilindradas") is narrowed by Decreto 3.677/2025, art. 23, § 2º, to vehicles
  // similar to motorcycles: an ordinary car pays 3%.
  AP: {
    aliquota: 0.03,
    // Art. 37 phases in lower rates for electric and hybrid cars.
    porCombustivel: { eletrico: null, hibrido: null },
    fonte: { nome: 'Lei 3.152/2024, art. 5º, III (Diário Oficial do AP)', url: 'https://diofe.portal.ap.gov.br/apifront/portal/edicoes/imprimir_materia/92685/2339' },
    conferidoEm: CONFERIDO_EM,
  },
  AM: {
    faixas: { base: 'cilindrada', limites: [{ ate: 1000, aliquota: 0.015 }, { ate: null, aliquota: 0.02 }], descricao: '1,5% até 1.000 cilindradas e 2% acima disso' },
    porCombustivel: { eletrico: 0.015, hibrido: 0.015 },
    fonte: { nome: 'Decreto 53.412/2026, Regulamento do IPVA, art. 9º (Imprensa Oficial do AM)', url: 'https://legisla.imprensaoficial.am.gov.br/diario_am/41534/2026/1/17916?o=1' },
    conferidoEm: CONFERIDO_EM,
  },
  BA: {
    aliquota: 0.025,
    porCombustivel: { diesel: 0.03 },
    fonte: { nome: 'Sefaz-BA, informações do IPVA', url: 'https://www.sefaz.ba.gov.br/inspetoria-eletronica/ipva/informacoes/' },
    conferidoEm: CONFERIDO_EM,
  },
  CE: {
    faixas: { base: 'potencia_cv', limites: [{ ate: 100, aliquota: 0.025 }, { ate: 180, aliquota: 0.03 }, { ate: null, aliquota: 0.035 }], descricao: '2,5% até 100 cv, 3% acima de 100 até 180 cv e 3,5% acima de 180 cv' },
    fonte: { nome: 'Sefaz-CE, alíquotas do IPVA (Lei 12.023/1992, art. 6º, IV)', url: 'https://portalservicos.sefaz.ce.gov.br/conteudo-geral+aliquotas-praticadas-para-o-calculo-de-ipva+64da50f5170f5a26dc5e8ad9' },
    conferidoEm: CONFERIDO_EM,
  },
  DF: {
    aliquota: 0.03,
    // Electric and hybrid cars bought in the DF are exempt (Secretaria de Economia).
    porCombustivel: { eletrico: null, hibrido: null },
    fonte: { nome: 'Lei 6.445/2019, art. 3º, III (SINJ-DF)', url: 'https://www.sinj.df.gov.br/sinj/Norma/a797f1b9fe984552902fde78c5abddfe/Lei_6445_23_12_2019.html' },
    conferidoEm: CONFERIDO_EM,
  },
  ES: {
    aliquota: 0.02,
    fonte: { nome: 'Sefaz-ES, IPVA 2027', url: 'https://sefaz.es.gov.br/ipva-2027-pagamento-comeca-em-abril-com-desconto-de-15-a-vista-e-parcelamento-em-ate-seis-vezes' },
    conferidoEm: CONFERIDO_EM,
  },
  GO: {
    faixas: { base: 'potencia_cv', limites: [{ ate: 100, aliquota: 0.03 }, { ate: null, aliquota: 0.0375 }], descricao: '3% até 100 cv e 3,75% acima de 100 cv' },
    fonte: { nome: 'Código Tributário de Goiás (Lei 11.651/1991), art. 93', url: 'https://appasp.economia.go.gov.br/legislacao/arquivos/Cte/CTE.htm' },
    conferidoEm: CONFERIDO_EM,
  },
  // Not checked: the 2.5% / 3% (above R$ 150 mil) tiers were read only on state
  // news pages, not on the SEFAZ, the law or the gazette.
  MA: { aliquota: 0.025 },
  MT: {
    faixas: { base: 'cilindrada', limites: [{ ate: 1000, aliquota: 0.02 }, { ate: null, aliquota: 0.03 }], descricao: '2% até 1.000 cilindradas e 3% acima disso' },
    fonte: { nome: 'Sefaz-MT, Portaria 196/2025 (exercício 2026)', url: 'https://app1.sefaz.mt.gov.br/Sistema/legislacao/legislacaotribut.nsf/07fa81bed2760c6b84256710004d3940/d8fcadea198ff27603258d6f00518320?OpenDocument' },
    conferidoEm: CONFERIDO_EM,
  },
  MS: {
    aliquota: 0.03,
    // GNV: 100% reduction (art. 153, III). Diesel passenger cars had their own
    // rate in the 2026 table, not shown in the 2027 text.
    porCombustivel: { gnv: null, diesel: null },
    fonte: { nome: 'Lei 6.654/2026, art. 157 (Diário Oficial de MS nº 12.340)', url: 'https://assets.imprensaoficial.ms.gov.br/public/prd/Diario%20Oficial/2026/11/26/DO12340_26_11_2026.pdf' },
    conferidoEm: CONFERIDO_EM,
  },
  MG: {
    aliquota: 0.04,
    fonte: { nome: 'SEF-MG, como se calcula o IPVA', url: 'https://www.fazenda.mg.gov.br/empresas/impostos/ipva/calculo.html' },
    conferidoEm: CONFERIDO_EM,
  },
  PA: {
    aliquota: 0.025,
    // Electric cars up to R$ 150 mil are exempt.
    porCombustivel: { eletrico: null },
    fonte: { nome: 'Lei 6.017/1996, art. 10, III (texto da Lei 8.867/2019, Alepa)', url: 'https://bancodeleis.alepa.pa.gov.br/arquivos/lei8867_2019_47159.pdf' },
    conferidoEm: CONFERIDO_EM,
  },
  PB: {
    aliquota: 0.025,
    fonte: { nome: 'Lei 11.007/2017, art. 12, II (texto da Sefaz-PB)', url: 'https://www.sefaz.pb.gov.br/legislacao/34-leis/65-ipva/5032-lei-n-11-007-de-06-de-novembro-de-2017' },
    conferidoEm: CONFERIDO_EM,
  },
  PR: {
    aliquota: 0.019,
    porCombustivel: { gnv: 0.01 },
    fonte: { nome: 'Sefa-PR, IPVA com alíquota de 1,9%', url: 'https://www.fazenda.pr.gov.br/Noticia/Com-aliquota-de-19-e-desconto-vista-Fazenda-divulga-datas-do-IPVA-2026' },
    conferidoEm: CONFERIDO_EM,
  },
  PE: {
    aliquota: 0.024,
    // GNV pays 1.5% only up to R$ 100 mil of base.
    porCombustivel: { gnv: null },
    fonte: { nome: 'Lei 10.849/1992, art. 12-B (Sefaz-PE)', url: 'https://www.sefaz.pe.gov.br/Legislacao/Tributaria/Documents/Legislacao/Leis_Tributarias/1992/Lei10849_92.htm' },
    conferidoEm: CONFERIDO_EM,
  },
  PI: {
    faixas: { base: 'valor', limites: [{ ate: 150000, aliquota: 0.025 }, { ate: null, aliquota: 0.03 }], descricao: '2,5% até R$ 150 mil de valor venal e 3% acima disso' },
    // Art. 14, I: own rule for electric vehicles.
    porCombustivel: { eletrico: null },
    fonte: { nome: 'Lei 4.548/1992, art. 14 (texto da Lei 6.749/2015)', url: 'https://sapl.al.pi.leg.br/media/sapl/public/normajuridica/2015/3866/3866_texto_integral.pdf' },
    conferidoEm: CONFERIDO_EM,
  },
  RJ: {
    aliquota: 0.04,
    porCombustivel: { diesel: 0.04, etanol: 0.02, gnv: 0.015, hibrido: 0.015, eletrico: 0.005 },
    fonte: { nome: 'Lei 2.877/1997, art. 10 (texto consolidado da Alerj)', url: 'http://alerjln1.alerj.rj.gov.br/contlei.nsf/c8aa0900025feef6032564ec0060dfff/fa1a422b516211130325657a0064293f?OpenDocument' },
    conferidoEm: CONFERIDO_EM,
  },
  RN: {
    aliquota: 0.03,
    // Electric: 0.5%, rising half a point a year.
    porCombustivel: { gnv: 0.015, eletrico: null },
    fonte: { nome: 'Lei 9.992/2015 (Diário Oficial do RN de 30/10/2015)', url: 'https://webdisk.diariooficial.rn.gov.br/Jornal/12015-10-30.pdf' },
    conferidoEm: CONFERIDO_EM,
  },
  RS: {
    aliquota: 0.03,
    fonte: { nome: 'Secretaria da Fazenda do RS, alíquotas do IPVA', url: 'https://fazenda.rs.gov.br/ipva-2026-pagamento-inicia-na-terca-feira-16-12-com-desconto-maximo-para-quase-1-milhao-de-veiculos' },
    conferidoEm: CONFERIDO_EM,
  },
  RO: {
    faixas: { base: 'cilindrada', limites: [{ ate: 1000, aliquota: 0.02 }, { ate: null, aliquota: 0.03 }], descricao: '2% até 1.000 cilindradas e 3% acima disso' },
    fonte: { nome: 'Lei 950/2000, art. 5º (legislação da Sefin-RO)', url: 'https://legislacao.sefin.ro.gov.br/normas/544' },
    conferidoEm: CONFERIDO_EM,
  },
  RR: {
    aliquota: 0.03,
    fonte: { nome: 'Código Tributário de Roraima (Lei 59/1993), art. 100 (Sefaz-RR)', url: 'https://www.sefaz.rr.gov.br/downloads/legislacao?file=02+-+LEGISLACAO+ESTADUAL/02+-+CODIGO+TRIBUTARIO+ESTADUAL+-+ATUALIZADO+-+LEI+N+59-93/CODIGO+TRIBUTARIO+ESTADUAL+Lei+n.+059+de+28.12.93+-+Atualizado+at+MAIO+2025.pdf' },
    conferidoEm: CONFERIDO_EM,
  },
  SC: {
    aliquota: 0.02,
    fonte: { nome: 'SEF-SC, calendário do IPVA 2026', url: 'https://www.sef.sc.gov.br/noticias/secretaria-de-estado-da-fazenda-divulga-calendario-do-ipva-para-2026' },
    conferidoEm: CONFERIDO_EM,
  },
  SP: {
    aliquota: 0.04,
    // The 4% is for "demais veículos, inclusive automóveis de passeio tipo flex":
    // ethanol-only, GNV and electric cars have their own line, and hybrids up to
    // a value are exempt.
    porCombustivel: { etanol: null, gnv: null, eletrico: null, hibrido: null },
    fonte: { nome: 'Sefaz-SP, como é calculado o IPVA', url: 'https://portal.fazenda.sp.gov.br/servicos/ipva/Paginas/Como-e-calculado-IPVA.aspx' },
    conferidoEm: CONFERIDO_EM,
  },
  SE: {
    // 2.5% below R$ 120 mil, 3% from R$ 120 mil ("a partir de R$ 120.000,00").
    faixas: { base: 'valor', limites: [{ ate: 119999.99, aliquota: 0.025 }, { ate: null, aliquota: 0.03 }], descricao: '2,5% abaixo de R$ 120 mil e 3% a partir de R$ 120 mil' },
    fonte: { nome: 'Imprensa Oficial de Sergipe, calendário do IPVA 2027', url: 'https://iose.se.gov.br/noticia/sefaz-divulga-calendario-do-ipva-para-2027.html' },
    conferidoEm: CONFERIDO_EM,
  },
  TO: {
    faixas: { base: 'potencia_hp', limites: [{ ate: 100, aliquota: 0.025 }, { ate: null, aliquota: 0.035 }], descricao: '2,5% até 100 HP e 3,5% acima disso' },
    // Electric and hybrid cars bought from local dealers are exempt (Lei 5.061/2026).
    porCombustivel: { eletrico: null, hibrido: null },
    fonte: { nome: 'Sefaz-TO, IPVA 2026 (Lei 1.287/2001, art. 78)', url: 'https://www.to.gov.br/sefaz/noticias/ipva-2026-no-tocantins-tem-desconto-de-10-para-pagamento-a-vista-em-ate-30-de-janeiro/5j7g5aj1h47x' },
    conferidoEm: CONFERIDO_EM,
  },
}

/** 1 cv = 735.5 W, 1 HP = 745.7 W. */
const HP_POR_CV = 735.49875 / 745.69987

const DIESEL = /diesel/i
const GNV = /\bgnv\b|g[aá]s natural/i
const GASOLINA = /gasolina|flex/i
const ETANOL = /[aá]lcool|etanol/i

/**
 * Registry fuel codes we know: 1 ethanol, 2 gasoline, 3 diesel, 6/7 electric
 * (internal/external source), 16 ethanol/gasoline (flex), 17 ethanol/gasoline/
 * GNV. Any other code present in the registry decides nothing by itself.
 */
const CODIGOS_COMBUSTIVEL: Readonly<Record<number, CombustivelIpva>> = {
  1: 'etanol', 2: 'comum', 3: 'diesel', 6: 'eletrico', 7: 'eletrico', 16: 'comum', 17: 'gnv',
}

/**
 * Fuel group from what we hold: the registry fuel code and/or texts (fuel of
 * the free lookup, model name: "Álcool/Gasolina", "Elétrico", "HEV"...). A
 * hybrid or electric named in the texts wins over a gasoline/flex code; a code
 * and a text that disagree otherwise give null. A registry code we don't know
 * gives null unless the texts name a hybrid or an electric. Null when nothing
 * says what it is.
 */
export function combustivelIpva(codigo: unknown, ...textos: unknown[]): CombustivelIpva | null {
  const t = textos.map((x) => String(x ?? '')).join(' ')
  let p = propulsao(t)
  // "Gasolina/Elétrico" is a hybrid even without the word: electric plus a fuel.
  if (p === 'eletrico' && (GASOLINA.test(t) || ETANOL.test(t) || DIESEL.test(t))) p = 'hibrido'
  const n = parseInt(String(codigo ?? '').trim(), 10)
  if (Number.isFinite(n)) {
    const doCodigo = CODIGOS_COMBUSTIVEL[n]
    if (!doCodigo || !p) return doCodigo ?? p
    // A hybrid or electric named in the texts wins over a gasoline/flex/ethanol
    // code; any other disagreement (code 6 electric, text "Hybrid") is unknown.
    if (doCodigo === 'comum' || doCodigo === 'etanol') return p
    return doCodigo === p ? doCodigo : null
  }
  if (p) return p
  if (GNV.test(t)) return 'gnv'
  if (DIESEL.test(t)) return 'diesel'
  if (GASOLINA.test(t)) return 'comum'
  if (ETANOL.test(t)) return 'etanol'
  return null
}

export interface VeiculoIpva {
  valorFipe?: number | null
  /** Registry power, in cv. */
  potenciaCv?: number | null
  /** Registry engine size, in cm³. */
  cilindradaCc?: number | null
  /**
   * Rate of the power or engine-size tier already decided on the server
   * (faixasDecididas), for callers that never see the power itself.
   */
  aliquotaFaixa?: number | null
  combustivel?: CombustivelIpva | null
  /**
   * Cargo pickup or utility (registry tipo CAMINHONETE, espécie CARGA, or a
   * pickup in the free lookup): several states tax it at its own rate (SP 2%
   * for single-cab pickups, GO 3.45% for utility vehicles), so no car rate.
   */
  utilitarioCarga?: boolean
}

const positivo = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

function indiceFaixa(f: FaixasIpva, x: number): number {
  const i = f.limites.findIndex((l) => l.ate == null || x <= l.ate)
  return i < 0 ? f.limites.length - 1 : i
}

function regraDa(uf: string): AliquotaUf | undefined {
  return ALIQUOTAS_IPVA[String(uf || '').trim().toUpperCase()]
}

/** Rate of the general rule (every automóvel), or null when its tier is not decided. */
function aliquotaGeral(regra: AliquotaUf, v: VeiculoIpva): number | null {
  if (!regra.faixas) return regra.aliquota ?? null
  const f = regra.faixas
  if (f.base === 'valor') return positivo(v.valorFipe) ? f.limites[indiceFaixa(f, v.valorFipe)].aliquota : null
  const medida = f.base === 'cilindrada' ? v.cilindradaCc : v.potenciaCv
  if (!positivo(medida)) return positivo(v.aliquotaFaixa) ? v.aliquotaFaixa : null
  const i = indiceFaixa(f, medida)
  // The law counts HP and the registry gives cv: the tier counts only when the
  // number read either way lands in the same tier.
  if (f.base === 'potencia_hp' && indiceFaixa(f, medida * HP_POR_CV) !== i) return null
  return f.limites[i].aliquota
}

/**
 * Passenger-car rate for this vehicle, or null when the state's rule depends on
 * data we don't hold: an undecided power, engine-size or value tier, a fuel
 * whose own rule is not modeled, or an unknown fuel in a state where fuels have
 * their own rules (unless they all give the same number). Never guesses.
 */
export function aliquotaIpvaDoVeiculo(uf: string, v: VeiculoIpva = {}): number | null {
  const regra = regraDa(uf)
  if (!regra || v.utilitarioCarga) return null
  const geral = aliquotaGeral(regra, v)
  const regras = regra.porCombustivel ?? {}
  const c = v.combustivel ?? null
  if (c && c !== 'comum' && c in regras) return regras[c] ?? null
  if (c) return geral
  const proprias = Object.values(regras)
  if (!proprias.length) return geral
  return geral != null && proprias.every((x) => x === geral) ? geral : null
}

/** Does the state's source give a fuel its own rule? (Unknown fuel then decides nothing.) */
export function temRegraPorCombustivel(uf: string): boolean {
  return Object.keys(regraDa(uf)?.porCombustivel ?? {}).length > 0
}

/** Is this fuel one whose own rule the source sets but we don't model? */
export function combustivelSemAliquota(uf: string, c: CombustivelIpva | null | undefined): boolean {
  const regras = regraDa(uf)?.porCombustivel ?? {}
  return !!c && c !== 'comum' && c in regras && regras[c as CombustivelEspecial] == null
}

const UNIDADE: Record<Exclude<BaseFaixa, 'valor'>, string> = { potencia_cv: 'cv', potencia_hp: 'HP', cilindrada: 'cilindradas' }

/** "até 100 cv", "acima de 80 até 160 HP", "acima de 1.000 cilindradas". */
export function rotuloFaixa(f: FaixasIpva, i: number): string {
  const un = UNIDADE[f.base as Exclude<BaseFaixa, 'valor'>] ?? ''
  const n = (x: number | null) => (x ?? 0).toLocaleString('pt-BR')
  if (i === 0) return `até ${n(f.limites[0].ate)} ${un}`
  const de = n(f.limites[i - 1].ate)
  return f.limites[i].ate == null ? `acima de ${de} ${un}` : `acima de ${de} até ${n(f.limites[i].ate)} ${un}`
}

/**
 * For the free lookup: the power and engine-size tiers this car falls in, per
 * state, as rate and label only. The power and engine size themselves never
 * leave the server (they are items of the paid report).
 */
export function faixasDecididas(v: { potenciaCv?: number | null; cilindradaCc?: number | null }): Record<string, { aliquota: number; rotulo: string }> {
  const out: Record<string, { aliquota: number; rotulo: string }> = {}
  for (const [uf, regra] of Object.entries(ALIQUOTAS_IPVA)) {
    const f = regra.faixas
    // The HP states (AL, TO) never go out: leaving them out only near a cv/HP
    // border made each power give its own payload, which revealed the exact
    // power (review of #805). The page shows their range.
    if (!f || f.base === 'valor' || f.base === 'potencia_hp') continue
    const medida = f.base === 'cilindrada' ? v.cilindradaCc : v.potenciaCv
    if (!positivo(medida)) continue
    const i = indiceFaixa(f, medida)
    out[uf] = { aliquota: f.limites[i].aliquota, rotulo: rotuloFaixa(f, i) }
  }
  return out
}

/** Cargo pickup or utility in the registry: tipo CAMINHONETE with espécie CARGA. */
export function ehUtilitarioDeCarga(tipo: unknown, especie: unknown): boolean {
  return /CAMINHONETE/i.test(String(tipo ?? '')) && /CARGA/i.test(String(especie ?? ''))
}

/**
 * The paid report's IPVA vehicle, built the same way for the 12-month and the
 * 5-year cost: registry fuel code, power, engine size, tipo and espécie, plus
 * the FIPE model name and the registry model name for the fuel.
 */
export function veiculoIpvaDoRegistro(
  r: { codigoCombustivel?: unknown; potencia?: unknown; cilindrada?: unknown; descricaoMarcaModelo?: unknown; descricaoTipoVeiculo?: unknown; descricaoEspecie?: unknown } | null | undefined,
  fipeModelo?: string | null,
  valorFipe?: number | null,
): VeiculoIpva {
  const reg = r ?? {}
  return {
    valorFipe: positivo(valorFipe) ? valorFipe : null,
    potenciaCv: Number(reg.potencia) || null,
    cilindradaCc: Number(reg.cilindrada) || null,
    combustivel: combustivelIpva(reg.codigoCombustivel, fipeModelo, reg.descricaoMarcaModelo),
    utilitarioCarga: ehUtilitarioDeCarga(reg.descricaoTipoVeiculo, reg.descricaoEspecie),
  }
}

export type DependeDe = 'potencia' | 'cilindrada' | 'valor'

/** Lowest and highest gasoline/flex passenger-car rate of the state, and what decides the tier. */
export function faixaAliquotaIpva(uf: string): { min: number; max: number; depende: DependeDe | null } | null {
  const regra = regraDa(uf)
  if (!regra) return null
  if (!regra.faixas) return regra.aliquota == null ? null : { min: regra.aliquota, max: regra.aliquota, depende: null }
  const as = regra.faixas.limites.map((l) => l.aliquota)
  const base = regra.faixas.base
  return { min: Math.min(...as), max: Math.max(...as), depende: base === 'valor' ? 'valor' : base === 'cilindrada' ? 'cilindrada' : 'potencia' }
}

/** Was the state's rate read on an official source? */
export function aliquotaConferida(uf: string): boolean {
  const regra = regraDa(uf)
  return !!(regra?.fonte && regra.conferidoEm)
}
