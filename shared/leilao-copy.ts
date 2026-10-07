import { BASE_LEILAO_TEXTO } from './base-leilao'
// Frases da secao de leilao que fazem uma afirmacao delicada: que o documento
// do veiculo pode nao registrar uma passagem por leilao. Isso e verdade (leilao
// de seguradora e de leiloeira muitas vezes nao vira anotacao no documento) e e
// util pra quem esta comprando, mas so se for dito de um jeito: o documento nao
// registra tudo. Nunca que alguem esconde.
//
// Ficam aqui, fora do template, pra poderem ser testadas: o risco desta copy
// nao e quebrar a tela, e mudar de tom sem ninguem perceber.

export const LEILAO_FORA_DO_DOCUMENTO =
  'Este registro vem de edital ou catálogo de leilão e pode não constar no documento do veículo.'

export function leilaoSemOcorrencia(esteVeiculo: string): string {
  return `Na nossa base com ${BASE_LEILAO_TEXTO}, nenhuma ocorrência de leilão `
    + `foi encontrada para ${esteVeiculo}, incluindo leilões que normalmente não constam no documento.`
}

/**
 * Palavras que acusam alguem de omitir. A afirmacao que a gente sustenta e
 * sobre o documento, nao sobre quem o emite: sem prova de intencao, acusar e
 * mentira nossa, alem de briga que nao e nossa.
 */
export const PALAVRAS_DE_ACUSACAO = [
  'esconde', 'escondem', 'omite', 'omitem', 'oculta', 'ocultam',
  'maquia', 'fraude do detran', 'não te contam',
]
