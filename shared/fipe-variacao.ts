// Variacao da FIPE em N meses a partir da serie do relatorio
// (valorCusto.historico: [{ label: "Set/26", price }], ordem cronologica).
//
// Atencao: valorCusto.quedaAno compara o 1o e o ultimo ponto da serie INTEIRA
// (que pode ter anos), nao 12 meses. Pra "em 12 meses"/"em 24 meses" use isto.

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

/** "Set/26" -> indice absoluto de mes (ano*12 + mes0). null se nao der. */
export function mesDoRotulo(label: string): number | null {
  const m = String(label || '').trim().toUpperCase().match(/^([A-ZÇ]{3})\/(\d{2}|\d{4})$/)
  if (!m) return null
  const i = MESES.indexOf(m[1])
  if (i < 0) return null
  let ano = parseInt(m[2], 10)
  if (ano < 100) ano += ano > 70 ? 1900 : 2000
  return ano * 12 + i
}

export interface VariacaoFipe { meses: number; de: number; ate: number; deRotulo: string; ateRotulo: string; delta: number; pct: number }

/**
 * Variacao entre o ultimo ponto e o ponto de N meses antes (ou o mais proximo
 * depois dele, ate 2 meses de folga). Serie que nao cobre N meses: null.
 */
export function variacaoFipe(historico: { label: string; price: number }[] | null | undefined, meses: number): VariacaoFipe | null {
  const pts = (historico || [])
    .map((p) => ({ ...p, m: mesDoRotulo(p.label) }))
    .filter((p): p is { label: string; price: number; m: number } => p.m != null && typeof p.price === 'number' && p.price > 0)
  if (pts.length < 2) return null
  const fim = pts[pts.length - 1]
  const alvo = fim.m - meses
  const ini = pts.find((p) => p.m >= alvo)
  if (!ini || ini.m - alvo > 2 || ini === fim) return null
  const delta = fim.price - ini.price
  return { meses, de: ini.price, ate: fim.price, deRotulo: ini.label, ateRotulo: fim.label, delta, pct: Math.round((delta / ini.price) * 1000) / 10 }
}

/** Valor FIPE no mes de uma data ISO (aaaa-mm-dd), se a serie cobrir esse mes. */
export function fipeNoMes(historico: { label: string; price: number }[] | null | undefined, iso: string | null | undefined): { price: number; label: string } | null {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})/)
  if (!m) return null
  const alvo = parseInt(m[1], 10) * 12 + parseInt(m[2], 10) - 1
  const p = (historico || []).find((h) => mesDoRotulo(h.label) === alvo)
  return p && p.price > 0 ? { price: p.price, label: p.label } : null
}
