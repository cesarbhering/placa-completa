import type { HistoricoLeilao } from './historico-leilao'
import { contarPassagens } from '../../shared/leilao-notificacao'

// O SINAL de leilao da consulta gratis. Aqui mora a muralha entre o que a
// consulta gratis mostra e o que so o relatorio pago entrega.
//
// A regra e simples e nao pode ser afrouxada sem decisao de produto: do
// historico inteiro sai UM numero e um booleano. Data, leiloeira, lote, valor,
// condicao do veiculo, foto, fonte, nada disso atravessa. Se um dia alguem
// precisar de mais um campo aqui, e sinal de que a conversa e sobre o que a
// gente vende, nao sobre codigo.

export interface SinalLeilao {
  /**
   * true = achamos registro. false = a base respondeu e nao tem registro.
   * null = NAO SABEMOS: a consulta nao aconteceu (timeout, servico fora,
   * teto de uso). Os tres estados sao diferentes na tela: null nao mostra
   * frase nenhuma.
   *
   * Sem o null, uma lentidao nossa vira "nenhum registro de leilao
   * encontrado" na cara de quem esta comprando um carro que talvez tenha
   * passagem. Seria a nossa falha virando afirmacao sobre o veiculo de
   * outra pessoa.
   */
  positivo: boolean | null
  /** Quantas passagens de nivel confirmado ou provavel. Zero nos outros casos. */
  quantidade: number
}

/** A base respondeu e nao ha registro. */
export const SINAL_VAZIO: SinalLeilao = { positivo: false, quantidade: 0 }
/** Nao deu pra consultar. A tela nao mostra nada. */
export const SINAL_INDISPONIVEL: SinalLeilao = { positivo: null, quantidade: 0 }

/**
 * Edital de NOTIFICACAO para leilao (o DETRAN avisou o dono; o leilao pode nao
 * ter acontecido) acende o sinal sozinho? Decisao de produto (30/set): acende,
 * com a mesma copy vaga, porque e indicio e o detalhe honesto ("notificado,
 * pode ter sido retirado") esta no relatorio completo. Desligar aqui tira a
 * notificacao da contagem sem mexer no resto.
 */
export const NOTIFICACAO_ACENDE_SINAL = true

/**
 * So confirmado e provavel contam como sinal. "Possivel" e inferencia por
 * identificador parcial e pode ser outro veiculo: mostrar isso na consulta
 * gratis, sem o detalhe que permite julgar, seria acusar um carro por
 * coincidencia de dado.
 */
export function sinalDoHistorico(
  historico: HistoricoLeilao | null | undefined,
  acendeComNotificacao = NOTIFICACAO_ACENDE_SINAL,
): SinalLeilao {
  // Sem historico, a consulta nao aconteceu: isso e "nao sabemos", nunca
  // "nao tem".
  if (!historico?.resumo) return SINAL_INDISPONIVEL
  let n = (Number(historico.resumo.n_confirmado) || 0) + (Number(historico.resumo.n_provavel) || 0)
  // A API soma notificacao em n_confirmado/n_provavel.
  if (!acendeComNotificacao) n = Math.max(0, n - contarPassagens(historico.passagens).notificado)
  return n > 0 ? { positivo: true, quantidade: n } : SINAL_VAZIO
}

/**
 * Frase do sinal. So existe frase quando ha registro.
 *
 * Sem registro, a tela nao fala de leilao, e isso e decisao de produto, nao
 * descuido. A copy passou por duas voltas ate aqui: primeiro dizia "nenhum
 * registro encontrado", que entregava de graca a duvida que vende o relatorio
 * em quase toda placa; depois virou uma linha neutra dizendo que a verificacao
 * existe; agora e silencio. Indisponivel (nao sabemos) sempre foi silencio.
 */
export function fraseSinal(sinal: SinalLeilao, _esteVeiculo?: string): string {
  if (!sinal.positivo) return ''
  // Copy VAGA (Cesar, 28/set): indicativa, sem contagem, aponta pro completo.
  return 'Existem indícios de leilão deste veículo em nossa base. Confira no relatório completo.'
}

/**
 * Teto simples por IP pro endpoint do sinal. Ele nao gasta credito de API paga
 * (a base de leilao e nossa), entao o motivo aqui e outro: sem teto, da pra
 * varrer placa por placa e montar um indice de "quais carros tem passagem",
 * que e justamente o produto que a gente vende. Contagem em memoria basta:
 * quem reinicia o processo perde a janela, e isso nao e problema pra um limite
 * que existe contra varredura, nao contra fraude.
 */
const JANELA_MS = 60 * 60 * 1000
const TETO_POR_IP = 60
const porIp = new Map<string, { desde: number; n: number }>()

export function dentroDoTetoDeSinal(ip: string, agora = Date.now()): boolean {
  if (!ip) return true
  const atual = porIp.get(ip)
  if (!atual || agora - atual.desde >= JANELA_MS) {
    porIp.set(ip, { desde: agora, n: 1 })
    return true
  }
  atual.n += 1
  return atual.n <= TETO_POR_IP
}

/** So pra teste: zera as janelas. */
export function _limparTetoDeSinal() {
  porIp.clear()
}
