// Nota do grafico de evolucao do valor (relatorio pago): quando a serie da
// FIPE comeca MUITO depois do lancamento do ano-modelo, o grafico parece
// completo e nao e (caso RVX0H18, Argo 2023 com serie so desde Mai/25: o
// codigo de modelo foi reemitido e a fonte nao tem o historico antigo).
// Calculado na tela a partir do que ja esta gravado; nao reconsulta nada.

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
/** A serie da fonte comeca em Jan/21: antes disso nao ha o que esperar. */
const PISO = 2021 * 12 + 0

function mesAbsoluto(label: string): number | null {
  const m = /^([A-Z][a-z]{2})\/(\d{2})$/.exec(String(label || '').trim())
  if (!m) return null
  const mes = MESES.indexOf(m[1])
  return mes < 0 ? null : (2000 + Number(m[2])) * 12 + mes
}

/**
 * Label do 1o ponto ("Mai/25") quando a serie comeca mais de 12 meses depois
 * do lancamento esperado do ano-modelo (julho do ano anterior, ou Jan/21 se
 * for antes disso); senao null.
 */
export function inicioTardioDoHistorico(historico: { label: string }[] | null | undefined, anoModelo: unknown): string | null {
  if (!Array.isArray(historico) || historico.length < 2) return null
  const ano = Number(anoModelo)
  if (!Number.isInteger(ano) || ano < 1950 || ano > 2100) return null
  const inicio = mesAbsoluto(historico[0]?.label)
  if (inicio == null) return null
  const lancamento = Math.max((ano - 1) * 12 + 6, PISO)
  return inicio > lancamento + 12 ? historico[0].label : null
}
