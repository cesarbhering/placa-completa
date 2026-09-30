// Roubo/furto informado pelo DETRAN estadual (hoje MG) no resumo do topo.
//
// Decisao do Cesar (30/set): quando o DETRAN acusa roubo/furto e o SENATRAN
// esta em NADA CONSTA (indicador desligado e sem ocorrencia no historico), o
// cartao "Roubo / furto" do resumo ACENDE, com a fonte explicita. Quando o
// SENATRAN ja acusa (indicador ou historico), fica como esta, sem duplicar.
// A copy nunca afirma que o carro e roubado: diz quem informou e manda conferir.

/** "detran_mg" -> "DETRAN-MG". Fonte desconhecida -> "DETRAN". */
export function orgaoDaFonte(fonte: string | null | undefined): string {
  const m = String(fonte || '').match(/^detran_([a-z]{2})$/i)
  return m ? `DETRAN-${m[1]!.toUpperCase()}` : 'DETRAN'
}

export interface RouboDetranResumo {
  orgao: string
  /** Valor curto no cartao do resumo. */
  valorCartao: string
  /** Frase completa (dica do cartao). */
  texto: string
  /** Como entra no veredito ("Atenção: consta ..."). */
  rotuloVeredito: string
}

/**
 * Deve o cartao de roubo/furto acender pelo DETRAN? So quando o DETRAN acusa E
 * o SENATRAN nao (indicador desligado e sem ocorrencia registrada).
 */
export function rouboFurtoPeloDetran(opts: {
  senatranLigado: boolean
  temOcorrenciasSenatran: boolean
  multas: { fonte?: string | null; alerta_roubo_furto?: string | null } | null | undefined
}): RouboDetranResumo | null {
  if (opts.senatranLigado || opts.temOcorrenciasSenatran) return null
  if (!opts.multas?.alerta_roubo_furto) return null
  const orgao = orgaoDaFonte(opts.multas.fonte)
  return {
    orgao,
    valorCartao: `Informado pelo ${orgao}`,
    texto: `Roubo/furto informado pelo ${orgao}. Confira a situação no DETRAN antes de negociar.`,
    rotuloVeredito: `roubo/furto informado pelo ${orgao}`,
  }
}
