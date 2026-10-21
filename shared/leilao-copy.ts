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

// ---------- So "possivel" (Cesar, 16/out/2026, caso de uma Amarok 2012) ----------
// O registro possivel distinto (nao ambiguo) APARECE na secao de leilao, em
// cinza, com o que bate e o que nao bate. A secao nunca diz "nenhuma
// ocorrencia" quando ha possivel, e grade, parecer, linha do tempo e checklist
// contam a mesma historia, no mesmo nivel.

const n1 = (n: number, um: string, muitos: string) => (n === 1 ? um : muitos)

/** Resumo da secao quando so ha possivel (sem confirmado nem provavel). */
export function resumoSoPossivel(n: number, esteVeiculo: string): string {
  return `${n} ${n1(n, 'registro possível', 'registros possíveis')} de leilão com perfil parecido com ${esteVeiculo}. `
    + `${n1(n, 'Pode', 'Podem')} ser outro veículo do mesmo modelo e ano: confira abaixo o que bate e o que não bate.`
}

/** Complemento do parecer "Nada consta" quando ha possivel. */
export function parecerComPossivel(n: number): string {
  return ` Consta ${n} ${n1(n, 'registro possível', 'registros possíveis')} de leilão, que ${n1(n, 'pode', 'podem')} ser outro veículo do mesmo modelo e ano (veja o Histórico de leilão).`
}

/** Valor do cartao da grade quando so ha possivel. */
export function cartaoSoPossivel(n: number): string {
  return `POSSÍVEL (${n})`
}

/** Rodape da secao: o que cada nivel quer dizer. */
export const LEILAO_NIVEIS_RODAPE =
  'Fonte: editais de órgãos de trânsito e catálogos de leiloeiras. Confirmado quer dizer placa ou chassi completos iguais; provável quer dizer identificador parcial mais atributos do veículo; possível quer dizer que só parte do identificador e o perfil batem, e pode ser outro veículo. Não substitui consulta oficial.'
