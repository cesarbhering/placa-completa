// Como a tela LE a resposta do /api/leilao-sinal.
//
// Sao tres estados, nao dois, e confundi-los foi um furo real que quase foi pra
// producao: "nao sabemos" (a consulta nao aconteceu) nao pode virar "nao tem
// registro" na tela, porque isso transforma uma lentidao nossa numa afirmacao
// sobre o carro que outra pessoa esta comprando.
export interface SinalNaTela {
  positivo: boolean
  quantidade: number
}

export function sinalDaResposta(resposta: any): SinalNaTela | null {
  if (resposta?.positivo !== true && resposta?.positivo !== false) return null
  return { positivo: resposta.positivo, quantidade: Number(resposta.quantidade) || 0 }
}

/**
 * A frase que aparece na tela. Mora aqui, e nao dentro da pagina, porque ela
 * ja mudou tres vezes em quatro dias e cada volta mexia numa regra de negocio,
 * nao numa palavra: primeiro contava que nao havia registro (e entregava de
 * graca a duvida que vende o relatorio), depois virou uma linha neutra, agora e
 * silencio. Fora do template, da pra testar.
 *
 * So ha frase quando ha registro. Sem registro e "nao sabemos" nao falam de
 * leilao.
 */
export function fraseSinalNaTela(sinal: SinalNaTela | null, _esteVeiculo?: string): string {
  if (!sinal?.positivo) return ''
  // Copy VAGA (Cesar, 28/set): indicativa, SEM contagem, aponta pro completo
  // (mesma logica do recall = nao entrega o status no gratis, puxa pro pago).
  // Vale pros dois niveis (confirmado e indicio).
  return 'Existem indícios de leilão deste veículo em nossa base. Confira no relatório completo.'
}
