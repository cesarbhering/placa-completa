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


/**
 * Estado do cartao "Historico de leilao" na grade (Cesar, 21/out/2026: so
 * possivel fica AMARELO, o tom de atencao; confirmado e provavel seguem
 * vermelhos). `atencao` = ambar; `neutro` = cinza (so notificacao).
 */
export function estadoCartaoLeilao(e: { confirmado: number; provavel: number; notificado: number; nPossiveis: number; possiveisComFoto: number }) {
  const plural = (n: number) => (n > 1 ? 's' : '')
  if (e.confirmado > 0) return { valor: `CONSTA (${e.confirmado} confirmado${plural(e.confirmado)})`, alerta: true, aceso: true, neutro: false }
  if (e.provavel > 0) return { valor: `PROVÁVEL (${e.provavel})`, alerta: true, aceso: true, neutro: false }
  if (e.notificado > 0) return { valor: 'NOTIFICADO PARA LEILÃO', alerta: false, aceso: true, neutro: true }
  if (e.nPossiveis > 0) return { valor: cartaoSoPossivel(e.nPossiveis), alerta: false, aceso: true, neutro: false }
  if (e.possiveisComFoto > 0) return { valor: 'CONFIRA AS FOTOS', alerta: false, aceso: true, neutro: false }
  return { valor: 'SEM OCORRÊNCIA', alerta: false, aceso: false, neutro: false }
}

/** Parecer quando o unico achado e leilao possivel: tom de atencao (ambar), sem afirmar. */
export const PARECER_SO_POSSIVEL_TITULO = 'Confira o histórico de leilão.'
