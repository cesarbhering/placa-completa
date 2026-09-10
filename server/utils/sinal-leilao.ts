import type { HistoricoLeilao } from './historico-leilao'

// O SINAL de leilao da consulta gratis. Aqui mora a muralha entre o que a
// consulta gratis mostra e o que so o relatorio pago entrega.
//
// A regra e simples e nao pode ser afrouxada sem decisao de produto: do
// historico inteiro sai UM numero e um booleano. Data, leiloeira, lote, valor,
// condicao do veiculo, foto, fonte, nada disso atravessa. Se um dia alguem
// precisar de mais um campo aqui, e sinal de que a conversa e sobre o que a
// gente vende, nao sobre codigo.

export interface SinalLeilao {
  /** true quando ha passagem com nivel confirmado ou provavel. */
  positivo: boolean
  /** Quantas passagens desse nivel. Zero quando negativo. */
  quantidade: number
}

export const SINAL_VAZIO: SinalLeilao = { positivo: false, quantidade: 0 }

/**
 * So confirmado e provavel contam como sinal. "Possivel" e inferencia por
 * identificador parcial e pode ser outro veiculo: mostrar isso na consulta
 * gratis, sem o detalhe que permite julgar, seria acusar um carro por
 * coincidencia de dado.
 */
export function sinalDoHistorico(historico: HistoricoLeilao | null | undefined): SinalLeilao {
  if (!historico?.resumo) return SINAL_VAZIO
  const n = (Number(historico.resumo.n_confirmado) || 0) + (Number(historico.resumo.n_provavel) || 0)
  return n > 0 ? { positivo: true, quantidade: n } : SINAL_VAZIO
}

/**
 * Frase do sinal, por segmento. Positiva diz o que achamos e onde esta o
 * resto; negativa diz que NAO encontramos, nunca que o veiculo nunca foi a
 * leilao, porque a nossa base nao prova ausencia.
 */
export function fraseSinal(sinal: SinalLeilao, esteVeiculo: string): string {
  if (!sinal.positivo) {
    return `Nenhum registro de leilão encontrado para ${esteVeiculo} na nossa base de mais de 1 milhão de veículos leiloados.`
  }
  return sinal.quantidade === 1
    ? `Encontramos 1 registro de leilão para ${esteVeiculo}. Detalhes (data, leiloeira, condição do veículo) no relatório completo.`
    : `Encontramos ${sinal.quantidade} registros de leilão para ${esteVeiculo}. Detalhes (data, leiloeira, condição do veículo) no relatório completo.`
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
