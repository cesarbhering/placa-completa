// Regras da pesquisa de satisfacao que valem a pena testar sozinhas, longe do
// banco: o que conta como link plausivel e o que conta como resposta valida.

/**
 * O token e a unica credencial da pagina. Curto demais nao e link truncado por
 * cliente de e-mail: e tentativa de adivinhar, e a gente nem consulta o banco.
 */
export function tokenFeedbackPlausivel(bruto: unknown): boolean {
  const t = String(bruto || '').trim()
  return t.length >= 16 && /^[A-Za-z0-9_-]+$/.test(t)
}

export interface RespostaFeedback {
  nota: number
  comentario: string | null
}

/**
 * Nota inteira de 1 a 5, obrigatoria. Comentario e opcional, aparado, com teto
 * de 2000 caracteres: campo livre sem teto e convite pra colar um livro (ou um
 * payload) dentro da tabela.
 */
export function normalizarResposta(bruto: any): RespostaFeedback | { erro: string } {
  const nota = Number(bruto?.nota)
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    return { erro: 'Escolha uma nota de 1 a 5.' }
  }
  const comentario = String(bruto?.comentario ?? '').trim().slice(0, 2000)
  return { nota, comentario: comentario || null }
}
