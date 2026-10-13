// Valor FIPE por ano-modelo, agregando varias versoes do mesmo modelo
// (plano GEO 13/out, prioridade A). As perguntas que chegam por busca e por IA
// sao "corolla 2015", "ford ka 2011": o ano, nao a versao. Uma versao so nao
// cobre a vida do modelo (o Corolla 2005 e o 2015 sao versoes diferentes na
// FIPE), entao o script junta as versoes listadas em `fipeCodes` e guarda, por
// ano, o menor e o maior valor entre elas.

export const ZERO_KM = 32000 // codigo FIPE de veiculo 0 km

export interface PontoPreco { month: number; year: number; price: number }
export interface EntradaHistorico { year: number; fuel: string; prices: PontoPreco[] }

export interface Referencia { month: number; year: number }

export interface ValorAno {
  ano: number
  min: number
  max: number
  /** Quantas versoes tem preco nesse ano. */
  versoes: number
}

const chaveRef = (r: Referencia) => r.year * 100 + r.month

/** Referencia mais recente entre todos os historicos (o mes da tabela atual). */
export function referenciaAtual(historicos: EntradaHistorico[][]): Referencia | null {
  let melhor: Referencia | null = null
  for (const h of historicos) {
    for (const e of h) {
      const p = e.prices?.[0]
      if (!p) continue
      if (!melhor || chaveRef(p) > chaveRef(melhor)) melhor = { month: p.month, year: p.year }
    }
  }
  return melhor
}

/**
 * Linha com preco do mes atual. Ano que saiu da tabela (0 km de modelo fora
 * de linha, por exemplo) fica com o ultimo preco congelado: nao entra.
 */
export function estaAtual(e: EntradaHistorico, ref: Referencia): boolean {
  const p = e.prices?.[0]
  return !!p && p.price > 0 && chaveRef(p) === chaveRef(ref)
}

export function agregarPorAno(historicos: EntradaHistorico[][], ref: Referencia): ValorAno[] {
  const porAno = new Map<number, ValorAno>()
  for (const h of historicos) {
    // Uma versao pode ter duas linhas no mesmo ano (gasolina e flex): conta
    // a versao uma vez so.
    const anosDaVersao = new Set<number>()
    for (const e of h) {
      if (e.year === ZERO_KM || !estaAtual(e, ref)) continue
      const preco = e.prices[0].price
      const atual = porAno.get(e.year)
      if (!atual) porAno.set(e.year, { ano: e.year, min: preco, max: preco, versoes: 1 })
      else {
        atual.min = Math.min(atual.min, preco)
        atual.max = Math.max(atual.max, preco)
        if (!anosDaVersao.has(e.year)) atual.versoes++
      }
      anosDaVersao.add(e.year)
    }
  }
  return [...porAno.values()].sort((a, b) => b.ano - a.ano)
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "outubro/2026" */
export function mesReferencia(ref: Referencia | null | undefined): string {
  if (!ref || ref.month < 1 || ref.month > 12) return ''
  return `${MESES[ref.month - 1]}/${ref.year}`
}

export const brl = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`

/** Rotulo do ano na tabela da versao: 32000 vira "0 km". */
export function rotuloAno(rotuloFipe: string): string {
  return String(rotuloFipe).replace(/^32000\b/, '0 km')
}

/**
 * Frase citavel de um ano: "O Toyota Corolla 2015 vale de R$ X a R$ Y na
 * Tabela FIPE de outubro/2026, conforme a versão." `sujeito` ja vem com o
 * artigo ("O Toyota Corolla", "A Yamaha XT 660").
 */
export function fraseAno(sujeito: string, v: ValorAno, ref: Referencia | null): string {
  const mes = mesReferencia(ref)
  const quando = mes ? ` na Tabela FIPE de ${mes}` : ' na Tabela FIPE'
  if (v.min === v.max) return `${sujeito} ${v.ano} vale ${brl(v.max)}${quando}.`
  return `${sujeito} ${v.ano} vale de ${brl(v.min)} a ${brl(v.max)}${quando}, conforme a versão.`
}

/** Faixa geral do modelo (todos os anos), para a frase de abertura. */
export function faixaGeral(porAno: ValorAno[]): { min: number; max: number; anoMin: number; anoMax: number } | null {
  if (!porAno.length) return null
  return {
    min: Math.min(...porAno.map((v) => v.min)),
    max: Math.max(...porAno.map((v) => v.max)),
    anoMin: Math.min(...porAno.map((v) => v.ano)),
    anoMax: Math.max(...porAno.map((v) => v.ano)),
  }
}

/**
 * Sujeito da frase com artigo: "O Toyota Corolla", "A Yamaha XT 660",
 * "A Fiat Doblò". Moto e feminino por padrao; carro, masculino. "Honda Motos"
 * vira "Honda" (marca curta, como no title).
 */
export function sujeitoModelo(marca: string, modelo: string, tipo: 'carros' | 'motos', genero?: 'm' | 'f'): string {
  const g = genero || (tipo === 'motos' ? 'f' : 'm')
  const curta = marca.replace(/\s+Motos$/i, '')
  return `${g === 'f' ? 'A' : 'O'} ${curta} ${modelo}`
}
