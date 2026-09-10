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
