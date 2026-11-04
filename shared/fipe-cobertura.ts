// Cobertura da tabela FIPE por ano-modelo. A tabela oficial so tem preco a
// partir de 1985; carro mais antigo nao e "nao localizado", e anterior a tabela.
export const FIPE_ANO_MINIMO = 1985

export function anteriorATabelaFipe(anoModelo: unknown): boolean {
  const ano = Number(anoModelo)
  return Number.isInteger(ano) && ano > 1900 && ano < FIPE_ANO_MINIMO
}

export const MENSAGEM_FIPE_ANTERIOR = `A tabela FIPE só cobre veículos a partir de ${FIPE_ANO_MINIMO}. Este modelo é anterior, então não há valor de tabela; o preço de mercado vem de referência de colecionador.`
