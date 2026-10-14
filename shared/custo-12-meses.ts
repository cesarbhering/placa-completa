// Custo de ter este carro nos proximos 12 meses (Relatorio 2.0, item 9; Cesar 14/out).
//
// Um numero por mes, sempre rotulado como ESTIMATIVA. Soma o que da pra
// estimar com o que o relatorio ja tem: IPVA (aliquota da UF sobre a FIPE),
// licenciamento (taxa da UF), seguro (estimativa do relatorio), depreciacao
// (variacao da FIPE nos ultimos 12 meses) e combustivel (consumo x km x preco).
// Item sem dado fica de fora da soma e aparece como "nao incluido": nunca
// inventa valor.

export type ChaveCusto = 'ipva' | 'licenciamento' | 'seguro' | 'depreciacao' | 'combustivel'

export interface EntradaCusto12 {
  valorFipe: number | null
  uf?: string | null
  /** Aliquota de IPVA da UF (0.04 = 4%). */
  aliquotaIpva?: number | null
  /** Taxa anual de licenciamento da UF, em reais. */
  taxaLicenciamento?: number | null
  seguroAnual?: number | null
  /** Variacao % da FIPE nos ultimos 12 meses (negativa = queda). */
  quedaAnoPct?: number | null
  /** Consumo medio (km/l) e o preco do litro, em reais. */
  consumoKmL?: number | null
  precoLitro?: number | null
  kmAno?: number
  /** Motor de referencia do consumo medio ("1,4") e o combustivel usado na conta. */
  motorConsumo?: string | null
  combustivel?: 'gasolina' | 'etanol' | 'diesel' | null
  /** Flex: a conta usou o combustivel mais barato por km na UF. */
  flex?: boolean
}

export interface LinhaCusto { chave: ChaveCusto; rotulo: string; anual: number; mensal: number; nota?: string }

export interface Custo12 {
  mensal: number
  anual: number
  linhas: LinhaCusto[]
  /** Itens que ficaram de fora por falta de dado. */
  foraDaConta: string[]
  /** Observacoes que nao sao falta de dado (ex.: FIPE nao caiu, sem depreciacao). */
  observacoes: string[]
  premissas: string[]
}

export const KM_ANO_PADRAO = 12000

const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

export function custo12Meses(e: EntradaCusto12): Custo12 | null {
  if (!ok(e.valorFipe)) return null
  const fipe = e.valorFipe
  const linhas: LinhaCusto[] = []
  const fora: string[] = []
  const obs: string[] = []
  const add = (chave: ChaveCusto, rotulo: string, anual: number | null, nota?: string) => {
    if (anual == null || !Number.isFinite(anual) || anual <= 0) { fora.push(rotulo); return }
    const a = Math.round(anual)
    linhas.push({ chave, rotulo, anual: a, mensal: Math.round(a / 12), ...(nota ? { nota } : {}) })
  }

  add('ipva', 'IPVA', ok(e.aliquotaIpva) ? fipe * e.aliquotaIpva : null,
    ok(e.aliquotaIpva) ? `${(e.aliquotaIpva * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% do valor FIPE${e.uf ? ` (${e.uf.toUpperCase()})` : ''}` : undefined)
  add('licenciamento', 'Licenciamento', ok(e.taxaLicenciamento) ? e.taxaLicenciamento : null, e.uf ? `taxa anual ${e.uf.toUpperCase()}` : undefined)
  add('seguro', 'Seguro', ok(e.seguroAnual) ? e.seguroAnual : null, 'estimativa do relatório')
  const queda = typeof e.quedaAnoPct === 'number' && Number.isFinite(e.quedaAnoPct) ? e.quedaAnoPct : null
  if (queda != null && queda >= 0) {
    // FIPE subiu ou ficou igual nos ultimos 12 meses: nao ha perda pra somar.
    obs.push('Sem depreciação na conta: a FIPE deste carro não caiu nos últimos 12 meses.')
  } else {
    add('depreciacao', 'Depreciação', queda != null ? fipe * (-queda / 100) : null,
      queda != null ? `mesma queda da FIPE nos últimos 12 meses (${Math.abs(queda).toLocaleString('pt-BR')}%)` : undefined)
  }
  const km = ok(e.kmAno) ? e.kmAno : KM_ANO_PADRAO
  add('combustivel', 'Combustível', ok(e.consumoKmL) && ok(e.precoLitro) ? (km / e.consumoKmL) * e.precoLitro : null,
    ok(e.consumoKmL) && ok(e.precoLitro)
      ? [
        `${km.toLocaleString('pt-BR')} km/ano`,
        `${e.consumoKmL.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km/l${e.motorConsumo ? `, média de motor ${e.motorConsumo}` : ''}`,
        `${e.combustivel || 'litro'} a ${e.precoLitro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${e.flex ? ', o mais barato por km na UF' : ''}`,
      ].join(' · ')
      : undefined)

  if (!linhas.length) return null
  const anual = linhas.reduce((s, l) => s + l.anual, 0)
  return {
    anual,
    mensal: Math.round(anual / 12),
    linhas,
    foraDaConta: fora,
    observacoes: obs,
    premissas: [
      'Estimativa para os próximos 12 meses, com base no valor FIPE de hoje.',
      'Não inclui manutenção, pneus, estacionamento, pedágio nem multas.',
    ],
  }
}

// ---------------------------------------------------------------------------
// Fase 1 (Lead, 14/out): licenciamento 2026 por UF, preco ANP por UF e consumo
// medio por cilindrada/categoria. Fase 2 troca o consumo pelo PBE (Inmetro).
// ---------------------------------------------------------------------------

/**
 * Taxa anual de licenciamento 2026 (carro de passeio), em reais. Referencia
 * compilada de tabelas publicas por UF (out/2026); varia por DETRAN e pode
 * mudar no ano. RR cobra por peso/categoria: fica de fora (sem valor unico).
 */
export const LICENCIAMENTO_UF_2026: Record<string, number> = {
  AC: 194.14, AL: 155.41, AP: 128.54, AM: 110.0, BA: 181.13, CE: 220.46, DF: 106.26,
  ES: 237.04, GO: 273.16, MA: 95.87, MT: 197.79, MS: 240.5, MG: 39.36, PA: 214.51,
  PB: 206.55, PR: 94.65, PE: 158.0, PI: 168.5, RJ: 293.71, RN: 90.0, RS: 114.09,
  RO: 220.41, SC: 142.69, SP: 167.74, SE: 250.14, TO: 79.63,
}

export type Combustivel = 'gasolina' | 'etanol' | 'diesel'

/** Codigo de combustivel do cadastro -> o que entra na conta. Eletrico/hibrido/GNV: null (fica de fora). */
export function combustivelDaConta(codigo: unknown): { tipo: Combustivel | 'flex'; } | null {
  const n = parseInt(String(codigo ?? '').trim(), 10)
  if (n === 1) return { tipo: 'etanol' }
  if (n === 2) return { tipo: 'gasolina' }
  if (n === 3) return { tipo: 'diesel' }
  if (n === 16 || n === 17) return { tipo: 'flex' }
  return null
}

/**
 * Consumo medio estimado em km/l com GASOLINA (ou diesel), ciclo misto, por
 * cilindrada. Utilitario/picape (camioneta) consome ~15% mais. Etanol rende
 * ~70% da gasolina. Valores de referencia de mercado, nao do modelo exato.
 */
export function consumoMedio(cilindradaCc: unknown, diesel: boolean, utilitario: boolean): number | null {
  const cc = Number(cilindradaCc)
  if (!Number.isFinite(cc) || cc < 600) return null
  const l = cc / 1000
  const base = diesel
    ? (l <= 2.0 ? 12 : l <= 3.0 ? 10 : 8.5)
    : (l <= 1.05 ? 12.5 : l <= 1.45 ? 11.5 : l <= 1.65 ? 11 : l <= 2.05 ? 10 : l <= 2.55 ? 9 : l <= 3.05 ? 8 : 7)
  return Math.round(base * (utilitario ? 0.85 : 1) * 10) / 10
}

export const ETANOL_RENDE = 0.7

/**
 * Consumo e preco pra conta: flex usa o que sai mais barato por km na UF
 * (etanol rende 70% da gasolina). Sem preco ou sem consumo: null.
 */
export function combustivelPraConta(a: {
  codigo: unknown; cilindradaCc: unknown; utilitario: boolean
  precos: { gasolina?: number; etanol?: number; diesel?: number } | null | undefined
}): { consumoKmL: number; precoLitro: number; combustivel: Combustivel; motor: string; flex: boolean } | null {
  const c = combustivelDaConta(a.codigo)
  if (!c || !a.precos) return null
  const consumo = consumoMedio(a.cilindradaCc, c.tipo === 'diesel', a.utilitario)
  if (!consumo) return null
  const motor = (Number(a.cilindradaCc) / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const g = a.precos.gasolina, et = a.precos.etanol
  const consEt = Math.round(consumo * ETANOL_RENDE * 10) / 10
  const r = (consumoKmL: number, precoLitro: number | undefined, combustivel: Combustivel, flex = false) =>
    precoLitro ? { consumoKmL, precoLitro, combustivel, motor, flex } : null
  if (c.tipo === 'diesel') return r(consumo, a.precos.diesel, 'diesel')
  if (c.tipo === 'gasolina') return r(consumo, g, 'gasolina')
  if (c.tipo === 'etanol') return r(consEt, et, 'etanol')
  // flex: o mais barato por km
  const kmG = g ? g / consumo : Infinity, kmE = et ? et / consEt : Infinity
  if (!Number.isFinite(kmG) && !Number.isFinite(kmE)) return null
  return kmE < kmG ? r(consEt, et, 'etanol', true) : r(consumo, g, 'gasolina', true)
}
