import type { HistoricoLeilao } from './historico-leilao'
import { contarPassagens } from '../../shared/leilao-notificacao'
import { chaveTetoIp } from './client-ip'

// O SINAL de leilao da consulta gratis. Aqui mora a muralha entre o que a
// consulta gratis mostra e o que so o relatorio pago entrega.
//
// A regra e simples e nao pode ser afrouxada sem decisao de produto: do
// historico inteiro sai UM numero, um booleano e o TIPO do achado (leilao ou
// so notificacao, decisao do Cesar de 30/set, pra tela nao prometer data de
// leilao, leiloeira e valor de venda a quem so tem notificacao). Data, leiloeira, lote, valor,
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
  /**
   * So quando positivo. 'leilao' = ha ao menos um leilao (com ou sem
   * notificacao junto); 'notificacao' = so edital de notificacao do DETRAN.
   */
  tipo?: 'leilao' | 'notificacao'
  /**
   * Revenda de frota (NAO e leilao): consta anuncio do carro na revenda. So o
   * booleano atravessa (copy vaga na tela); nada de data, preco ou fonte.
   */
  frota?: boolean
}

/** A base respondeu e nao ha registro. */
export const SINAL_VAZIO: SinalLeilao = { positivo: false, quantidade: 0 }
/** Nao deu pra consultar. A tela nao mostra nada. */
export const SINAL_INDISPONIVEL: SinalLeilao = { positivo: null, quantidade: 0 }

/**
 * Edital de NOTIFICACAO para leilao (o DETRAN avisou o dono; o leilao pode nao
 * ter acontecido) acende o sinal sozinho? Decisao do Cesar (30/set, a ultima):
 * SIM, com a mesma copy vaga, e o `tipo` = 'notificacao' faz a tela mostrar os
 * campos da notificacao em vez de data do leilao, leiloeira e valor de venda.
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
  const frota = Array.isArray(historico.revendas_frota) && historico.revendas_frota.length > 0
  const s = sinalSoLeilao(historico, acendeComNotificacao)
  return frota ? { ...s, frota: true } : s
}

function sinalSoLeilao(historico: HistoricoLeilao, acendeComNotificacao: boolean): SinalLeilao {
  const total = (Number(historico.resumo.n_confirmado) || 0) + (Number(historico.resumo.n_provavel) || 0)
  // A API soma notificacao em n_confirmado/n_provavel.
  const notificacoes = Math.min(total, contarPassagens(historico.passagens).notificado)
  const leiloes = total - notificacoes
  if (leiloes > 0) {
    return { positivo: true, quantidade: acendeComNotificacao ? total : leiloes, tipo: 'leilao' }
  }
  if (notificacoes > 0 && acendeComNotificacao) {
    return { positivo: true, quantidade: notificacoes, tipo: 'notificacao' }
  }
  return SINAL_VAZIO
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

// Memoria limitada: o processo e longo e cada IP novo abre uma janela. As
// janelas vencidas saem numa varredura (no maximo uma por minuto, e so com o
// mapa ja grande); com o mapa cheio de janelas vivas, sai a mais antiga (o Map
// guarda a ordem de insercao, e janela renovada volta pro fim da fila).
const PODAR_A_PARTIR_DE = 2_000
const INTERVALO_PODA_MS = 60 * 1000
export const MAX_JANELAS_DE_SINAL = 20_000
let ultimaPoda = 0

function abrirJanela(chave: string, agora: number) {
  if (porIp.size >= PODAR_A_PARTIR_DE && (agora < ultimaPoda || agora - ultimaPoda >= INTERVALO_PODA_MS)) {
    ultimaPoda = agora
    for (const [k, v] of porIp) if (agora - v.desde >= JANELA_MS) porIp.delete(k)
  }
  porIp.delete(chave)
  while (porIp.size >= MAX_JANELAS_DE_SINAL) {
    const maisAntiga = porIp.keys().next().value
    if (maisAntiga === undefined) break
    porIp.delete(maisAntiga)
  }
  porIp.set(chave, { desde: agora, n: 1 })
}

/**
 * Um contador POR SINAL (leilao e recall separados): uma consulta gratis chama
 * os dois, e com o contador unico ela gastava 2 da cota. O IP tem que ser o do
 * VISITANTE (getClientIp: cf-connecting-ip / primeiro IP publico do XFF): ate
 * 01/out os endpoints usavam getRequestIP(xForwardedFor), que atras do
 * cloudflared + Traefik devolve o IP INTERNO da rede Docker, o mesmo pra todo
 * mundo, e o teto de 60/h virava GLOBAL (5 a 9 placas com sinal por hora cheia).
 * A janela e por chaveTetoIp: o endereco no IPv4, o /64 no IPv6. IP
 * vazio/'unknown' (privado, sem header) nao fica sem teto: todas essas
 * requisicoes dividem UMA janela de 60/h por sinal.
 */
export type TipoSinal = 'leilao' | 'recall'

export function dentroDoTetoDeSinal(ip: string, agora = Date.now(), tipo: TipoSinal = 'leilao'): boolean {
  const chave = `${tipo}|${chaveTetoIp(ip)}`
  const atual = porIp.get(chave)
  if (!atual || agora - atual.desde >= JANELA_MS) {
    abrirJanela(chave, agora)
    return true
  }
  atual.n += 1
  return atual.n <= TETO_POR_IP
}

/** So pra teste: zera as janelas. */
export function _limparTetoDeSinal() {
  porIp.clear()
  ultimaPoda = 0
}

/** So pra teste: quantas janelas estao em memoria. */
export function _janelasDeSinalEmMemoria(): number {
  return porIp.size
}

