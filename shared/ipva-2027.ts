// IPVA 2027 page (/ipva-2027), approved by Cesar on Nov 26, 2026.
//
// The page ESTIMATES IPVA 2027 as the vehicle's FIPE value times the state's
// passenger-car rate (shared/ipva-uf.ts, the same table the paid report uses).
// It is never the official amount and never a debt lookup: each state's SEFAZ
// sets the official base and value.
//
// Rules kept in this file (shared/ipva-2027.test.ts checks them):
// - a number only for states whose rate was read on an official source, with
//   the source and the check date; a tier is never guessed. Where the rate
//   depends on power or engine size (data the free lookup does not show), the
//   page shows the range and what decides it;
// - the calendar lists only dates a state has already published officially for
//   2027. A state without a publication says so, naming the page checked and
//   the date. Never a date taken from last year or from the press;
// - no number for motorcycles or trucks: the table holds passenger-car rates.

import {
  ALIQUOTAS_IPVA, CONFERIDO_EM, aliquotaConferida, aliquotaIpvaDoVeiculo, faixaAliquotaIpva,
  type CombustivelIpva, type CombustivelEspecial, type DependeDe,
} from './ipva-uf'

export { CONFERIDO_EM }

const DOE_MS_12340 = 'https://assets.imprensaoficial.ms.gov.br/public/prd/Diario%20Oficial/2026/11/26/DO12340_26_11_2026.pdf'

export interface FonteOficial {
  nome: string
  url: string
}

export type SegmentoVeiculo = 'carro' | 'moto' | 'caminhao' | 'outro'

export type EstimativaIpva =
  | {
      tipo: 'valor'
      uf: string
      aliquota: number
      valorFipe: number
      /** Estimated IPVA, rounded to whole reais. */
      ipva: number
      combustivel: CombustivelIpva
      fonte: FonteOficial
      conferidoEm: string
    }
  | {
      tipo: 'faixa'
      uf: string
      valorFipe: number
      min: number
      max: number
      ipvaMin: number
      ipvaMax: number
      depende: DependeDe
      descricao: string
      fonte: FonteOficial
      conferidoEm: string
    }
  | { tipo: 'combustivel_especial'; uf: string; combustivel: CombustivelEspecial | null; fonte: FonteOficial; conferidoEm: string }
  | { tipo: 'nao_automovel'; segmento: 'moto' | 'caminhao' }
  | { tipo: 'sem_fipe' }
  | { tipo: 'sem_uf' }
  | { tipo: 'aliquota_nao_conferida'; uf: string }

/** "R$ 45.678,00" -> 45678. Anything without a positive amount -> null. */
export function valorFipeDoTexto(texto: unknown): number | null {
  if (typeof texto === 'number') return Number.isFinite(texto) && texto > 0 ? texto : null
  const s = String(texto ?? '')
  if (!/\d/.test(s)) return null
  const n = Number(s.replace(/[^\d,]/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * FIPE value x passenger-car rate of the state, from what the page holds: the
 * FIPE value, the state the person confirmed and the fuel. Power and engine
 * size are not in the free result, so a state tiered by them gets the range.
 */
export function estimarIpva2027(entrada: {
  valorFipe: number | string | null | undefined
  uf: string | null | undefined
  segmento?: string | null
  /** Fuel group; null = unknown (no number). */
  combustivel?: CombustivelIpva | null
}): EstimativaIpva {
  if (entrada.segmento === 'moto' || entrada.segmento === 'caminhao') {
    return { tipo: 'nao_automovel', segmento: entrada.segmento }
  }
  const valorFipe = valorFipeDoTexto(entrada.valorFipe)
  if (valorFipe == null) return { tipo: 'sem_fipe' }
  const uf = String(entrada.uf || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(uf) || !ALIQUOTAS_IPVA[uf]) return { tipo: 'sem_uf' }
  if (!aliquotaConferida(uf)) return { tipo: 'aliquota_nao_conferida', uf }
  const regra = ALIQUOTAS_IPVA[uf]
  const fonte = regra.fonte!
  const conferidoEm = regra.conferidoEm!
  const combustivel = entrada.combustivel ?? null
  const aliquota = aliquotaIpvaDoVeiculo(uf, { valorFipe, combustivel })
  if (aliquota != null) {
    return { tipo: 'valor', uf, aliquota, valorFipe, ipva: Math.round(valorFipe * aliquota), combustivel: combustivel!, fonte, conferidoEm }
  }
  if (combustivel !== 'comum') return { tipo: 'combustivel_especial', uf, combustivel, fonte, conferidoEm }
  const faixa = faixaAliquotaIpva(uf)!
  return {
    tipo: 'faixa',
    uf,
    valorFipe,
    min: faixa.min,
    max: faixa.max,
    ipvaMin: Math.round(valorFipe * faixa.min),
    ipvaMax: Math.round(valorFipe * faixa.max),
    depende: faixa.depende!,
    descricao: regra.faixas!.descricao,
    fonte,
    conferidoEm,
  }
}

/** 0.019 -> "1,9%". */
export function aliquotaEmTexto(aliquota: number): string {
  return `${(aliquota * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

/** 2000 -> "R$ 2.000" (whole reais: it is an estimate). */
export function reais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, minimumFractionDigits: 0 })
}

/** "da potência", "da cilindrada", "do valor": what decides the tier. */
export function dependeEmTexto(d: DependeDe): string {
  return d === 'potencia' ? 'da potência' : d === 'cilindrada' ? 'da cilindrada' : 'do valor'
}

/** "elétrico", "a diesel"...: how the page names a fuel group. */
export function combustivelEmTexto(c: CombustivelEspecial): string {
  return { etanol: 'só a etanol', diesel: 'a diesel', eletrico: 'elétrico', hibrido: 'híbrido', gnv: 'a gás (GNV)' }[c]
}

/** One row per state for the table of the page: the estimate for a gasoline/flex car of `valorFipe`. */
export function tabelaAliquotas(valorFipe: number): { uf: string; estimativa: EstimativaIpva }[] {
  return Object.keys(ALIQUOTAS_IPVA).map((uf) => ({
    uf,
    estimativa: estimarIpva2027({ valorFipe, uf, segmento: 'carro', combustivel: 'comum' }),
  }))
}

// --- Calendar ----------------------------------------------------------------

export type StatusCalendario = 'publicado' | 'parcial' | 'nao_publicado'

export interface CalendarioUf {
  uf: 'SP' | 'MG' | 'RS' | 'MS'
  nome: string
  status: StatusCalendario
  resumo: string
  /** Due day by plate final, only when the state published it. */
  vencimentos?: { final: string; dia: string }[]
  regras: string[]
  fonte: FonteOficial
  conferidoEm: string
}

export const TEXTO_NAO_PUBLICADO = 'Calendário 2027 ainda não publicado.'

export const CALENDARIO_IPVA_2027: readonly CalendarioUf[] = [
  {
    uf: 'SP',
    nome: 'São Paulo',
    status: 'publicado',
    resumo: 'Vencimentos de 11 a 22 de janeiro de 2027, conforme o final da placa.',
    vencimentos: [
      { final: '1', dia: '11' },
      { final: '2', dia: '12' },
      { final: '3', dia: '13' },
      { final: '4', dia: '14' },
      { final: '5', dia: '15' },
      { final: '6', dia: '18' },
      { final: '7', dia: '19' },
      { final: '8', dia: '20' },
      { final: '9', dia: '21' },
      { final: '0', dia: '22' },
    ],
    regras: [
      'Os dias valem para o pagamento integral em janeiro, com 3% de desconto, ou em fevereiro, sem desconto, e para as parcelas de janeiro a maio.',
      'O parcelamento é sem desconto, em 3, 4 ou 5 vezes, conforme o valor do imposto.',
      'Se o dia cair em data sem expediente bancário no município de registro do veículo, o prazo passa para o primeiro dia útil seguinte.',
      'Caminhões e caminhões-tratores têm calendário próprio.',
    ],
    fonte: {
      nome: 'Governo de SP, Decreto nº 70.960, de 6 de novembro de 2026',
      url: 'https://www.agenciasp.sp.gov.br/desenvolvimento/ipva-2027-sp-divulga-calendario-com-desconto-de-3-em-janeiro-e-pagamento-em-ate-cinco-parcelas/',
    },
    conferidoEm: CONFERIDO_EM,
  },
  {
    uf: 'MG',
    nome: 'Minas Gerais',
    status: 'nao_publicado',
    resumo: TEXTO_NAO_PUBLICADO,
    regras: ['Em 26/11/2026, a página de IPVA da SEF-MG ainda trazia a tabela de vencimentos de 2026.'],
    fonte: { nome: 'SEF-MG, página do IPVA', url: 'https://www.fazenda.mg.gov.br/empresas/impostos/ipva/' },
    conferidoEm: CONFERIDO_EM,
  },
  {
    uf: 'RS',
    nome: 'Rio Grande do Sul',
    status: 'nao_publicado',
    resumo: TEXTO_NAO_PUBLICADO,
    regras: ['Em 26/11/2026, o portal do IPVA do RS ainda não trazia as datas de 2027.'],
    fonte: { nome: 'Portal do IPVA do RS', url: 'https://ipva.rs.gov.br/' },
    conferidoEm: CONFERIDO_EM,
  },
  {
    uf: 'MS',
    nome: 'Mato Grosso do Sul',
    status: 'parcial',
    resumo: 'Cota única com 15% de desconto para pagamento até 28 de dezembro de 2026. Em 26/11/2026, as datas das parcelas ainda não tinham sido publicadas.',
    regras: [
      'Pagamento à vista, em cota única, com 15% de desconto até 28/12/2026 (Lei nº 6.654, de 25 de novembro de 2026).',
      'A lei prevê parcelamento em até 5 vezes. Em 26/11/2026, as datas das parcelas de 2027 ainda não tinham sido publicadas.',
      'A alíquota de automóveis em 2027 é de 3%.',
    ],
    fonte: { nome: 'Diário Oficial de MS nº 12.340, de 26/11/2026 (Lei nº 6.654/2026)', url: DOE_MS_12340 },
    conferidoEm: CONFERIDO_EM,
  },
]

/** Anchor of a state's card on the page ("calendario-sp"), used by the state pages. */
export function ancoraCalendario(uf: string): string {
  return `calendario-${uf.toLowerCase()}`
}

/** States whose /consultar-placa page links to the IPVA 2027 page. */
export const UFS_COM_LINK_IPVA_2027 = CALENDARIO_IPVA_2027.map((c) => c.uf) as readonly string[]

// --- FAQ (also the FAQPage JSON-LD: no "grátis" here, rule of 01/out) ----------

const SP = CALENDARIO_IPVA_2027.find((c) => c.uf === 'SP')!

export const FAQ_IPVA_2027: readonly { q: string; a: string }[] = [
  {
    q: 'Como consultar o valor do IPVA 2027?',
    a: 'O valor oficial sai no site da Secretaria da Fazenda (SEFAZ) do estado onde o carro está registrado, quando o estado libera a consulta do ano, em geral com a placa e o Renavam. Antes disso, dá para estimar pela placa nesta página: valor FIPE do carro vezes a alíquota do estado.',
  },
  {
    q: 'A estimativa é o valor que vou pagar?',
    a: 'Não. É uma conta de referência para planejar. A SEFAZ calcula o imposto sobre a própria tabela de valores do ano, que pode ser diferente do valor FIPE de hoje, e aplica descontos, isenções e reduções que esta conta não considera.',
  },
  {
    q: 'Quando vence o IPVA 2027 em SP?',
    a: `Em janeiro de 2027. Pelo Decreto nº 70.960/2026, os vencimentos vão do dia ${SP.vencimentos![0].dia} (placa final ${SP.vencimentos![0].final}) ao dia ${SP.vencimentos![9].dia} (final ${SP.vencimentos![9].final}), com 3% de desconto para o pagamento integral em janeiro. Também dá para pagar integral em fevereiro, sem desconto, ou parcelar em até 5 vezes, conforme o valor do imposto.`,
  },
  {
    q: 'Quando começa o IPVA 2027 no RS?',
    a: 'Até 26/11/2026, a Secretaria da Fazenda do RS ainda não tinha publicado o calendário de 2027. A data de início, os descontos e as parcelas saem no portal oficial do IPVA do estado.',
  },
  {
    q: 'Qual o desconto do IPVA 2027 em MS?',
    a: 'Pela Lei nº 6.654/2026, o pagamento à vista do IPVA 2027, em cota única, feito até 28 de dezembro de 2026 tem 15% de desconto. A alíquota de automóveis em 2027 é de 3%. Em 26/11/2026, as datas das parcelas ainda não tinham sido publicadas.',
  },
  {
    q: 'E o IPVA 2027 em Minas Gerais?',
    a: 'Até 26/11/2026, a SEF-MG ainda não tinha publicado o calendário de 2027. A alíquota de automóveis em Minas Gerais é de 4%.',
  },
  {
    q: 'Por que a estimativa não aparece para o meu estado?',
    a: 'Só mostramos o número quando conferimos a alíquota do estado numa fonte oficial e temos o dado que decide a faixa. Onde a alíquota muda com a potência ou a cilindrada do carro, dados que a consulta pela placa nesta página não traz, mostramos a faixa de valores. Para os estados que ainda não conferimos, a página mostra o valor FIPE e indica a SEFAZ do estado, que tem o valor oficial.',
  },
  {
    q: 'A estimativa vale para moto e caminhão?',
    a: 'Não. A conta usa a alíquota de automóvel, e motos e caminhões podem ter alíquota diferente. Carro elétrico, híbrido, a gás, a diesel ou só a etanol também pode ter alíquota diferente, redução ou isenção: nesses casos só mostramos número quando a fonte oficial do estado dá a alíquota desse combustível.',
  },
  {
    q: 'Carro antigo paga IPVA?',
    a: 'Depende do estado. Vários estados isentam veículos a partir de certa idade, e a idade muda de estado para estado. A estimativa desta página não aplica isenções: confira a regra na SEFAZ do estado.',
  },
  {
    q: 'A consulta pela placa mostra se o carro tem IPVA atrasado?',
    a: 'A consulta desta página mostra o valor FIPE e os dados do carro, não débitos. IPVA atrasado, multas e licenciamento se conferem no site da SEFAZ e do DETRAN do estado onde o carro está registrado.',
  },
]
