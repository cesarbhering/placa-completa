/**
 * ICV5 - Índice de Custo Veicular 5 Anos
 * Estima o custo total de manutenção + IPVA de um veículo nos próximos 5 anos.
 */

// Fator de idade aplicado sobre o custo-base de manutenção.
// Modelo antigo usava % direto do FIPE (13-16% a.a. pra carros velhos), o que
// estourava em 2-4x pra popular usado: Strada 2014 dava R$10k/ano de manutenção.
// Recalibrado em 21/jul/2026 pro modelo híbrido (ver manutencaoAnualBase).
export function fatorIdade(idade: number): number {
  if (idade <= 1) return 0.6
  if (idade <= 3) return 0.8
  if (idade <= 5) return 1.0
  if (idade <= 8) return 1.25
  if (idade <= 12) return 1.5
  return 1.8
}

// Manutenção anual = (piso absoluto + componente proporcional ao FIPE) ajustado
// por idade e categoria. O piso (óleo, filtros, desgaste) todo carro paga; o
// componente proporcional captura que peça de carro caro custa mais, de forma
// sub-linear ao valor - manutenção real não escala 1:1 com FIPE.
const MANUTENCAO_PISO_ANUAL = 800
const MANUTENCAO_PCT_FIPE = 0.015

export function manutencaoAnualBase(valorFipe: number, idade: number, categoria: string): number {
  return (MANUTENCAO_PISO_ANUAL + valorFipe * MANUTENCAO_PCT_FIPE) * fatorIdade(idade) * fatorCategoria(categoria)
}

// Fator multiplicador por categoria do veículo
export function fatorCategoria(tipo: string): number {
  const fatores: Record<string, number> = {
    hatch: 0.85,
    sedan: 1.0,
    suv: 1.15,
    pickup: 1.20,
    esportivo: 1.40,
    luxo: 1.50,
    eletrico: 0.60,
    hibrido: 0.75,
  }
  return fatores[tipo] ?? 1.0
}

// Alíquotas reais de IPVA por UF (automóveis de passeio)
export function aliquotaIPVA(uf: string): number {
  const aliquotas: Record<string, number> = {
    AC: 0.02,
    AL: 0.0275,
    AP: 0.03,
    AM: 0.03,
    BA: 0.025,
    CE: 0.03,
    DF: 0.035,
    ES: 0.02,
    GO: 0.0375,
    MA: 0.025,
    MT: 0.03,
    MS: 0.035,
    MG: 0.04,
    PA: 0.025,
    PB: 0.025,
    PR: 0.035,
    PE: 0.03,
    PI: 0.025,
    RJ: 0.04,
    RN: 0.03,
    RS: 0.03,
    RO: 0.03,
    RR: 0.03,
    SC: 0.02,
    SP: 0.04,
    SE: 0.025,
    TO: 0.03,
  }
  return aliquotas[uf.toUpperCase()] ?? 0.03
}

// Infere a categoria ICV5 a partir do sub_segmento da API de placas
export function inferirCategoria(subSegmento: string, combustivel?: string): string {
  const sub = (subSegmento || '').toUpperCase()
  const comb = (combustivel || '').toUpperCase()

  // Checar combustível primeiro (elétrico/híbrido tem prioridade)
  if (comb.includes('ELETRICO') || comb.includes('ELÉTRICO')) return 'eletrico'
  if (comb.includes('HIBRIDO') || comb.includes('HÍBRIDO')) return 'hibrido'

  if (sub.includes('HATCH')) return 'hatch'
  if (sub.includes('SEDAN')) return 'sedan'
  if (sub.includes('SUV')) return 'suv'
  if (sub.includes('PICKUP') || sub.includes('PICK-UP') || sub.includes('PICAPE')) return 'pickup'
  if (sub.includes('SPORT') || sub.includes('ESPORT')) return 'esportivo'
  if (sub.includes('LUXO') || sub.includes('PREMIUM')) return 'luxo'

  return 'sedan' // default
}

export interface ICV5Input {
  valorFipe: number
  anoFabricacao: number
  uf: string
  categoria: string
}

export interface ICV5Result {
  manutencaoAnual: number
  manutencao5anos: number
  ipvaAnual: number
  ipva5anos: number
  custoTotal5anos: number
  indiceIcv5: number // percentual do valor FIPE
  classificacao: string
  uf: string
}

export function calcularICV5({ valorFipe, anoFabricacao, uf, categoria }: ICV5Input): ICV5Result {
  const anoAtual = new Date().getFullYear()
  const idadeAtual = anoAtual - anoFabricacao

  let manutencaoTotal = 0
  for (let i = 0; i < 5; i++) {
    manutencaoTotal += manutencaoAnualBase(valorFipe, idadeAtual + i, categoria)
  }

  const manutencaoAnual = manutencaoTotal / 5
  const ipvaAnual = valorFipe * aliquotaIPVA(uf)
  const ipva5anos = ipvaAnual * 5

  const custoTotal5anos = manutencaoTotal + ipva5anos
  const indiceIcv5 = (custoTotal5anos / valorFipe) * 100

  return {
    manutencaoAnual: Math.round(manutencaoAnual),
    manutencao5anos: Math.round(manutencaoTotal),
    ipvaAnual: Math.round(ipvaAnual),
    ipva5anos: Math.round(ipva5anos),
    custoTotal5anos: Math.round(custoTotal5anos),
    indiceIcv5: Math.round(indiceIcv5 * 10) / 10,
    classificacao: classificarICV5(indiceIcv5),
    uf: uf.toUpperCase(),
  }
}

// Faixas recalibradas junto com o modelo de manutenção (os índices caíram):
// custo de 5 anos como % do valor FIPE.
export function classificarICV5(indice: number): string {
  if (indice <= 30) return 'Econômico'
  if (indice <= 50) return 'Moderado'
  if (indice <= 75) return 'Elevado'
  return 'Muito Elevado'
}
