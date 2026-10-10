import dados from './cambio-chassi.json'
import type { Cambio } from './cambio-nome'

// Camada 2 da desambiguacao manual x automatico (aprovada pelo Cesar, 10/out):
// o cambio aprendido pelo PREFIXO do chassi (posicoes 1 a 8: fabricante +
// descricao do veiculo), a partir de chassis com cambio conhecido (lotes de
// leilao com AT/MT/CVT no texto e escolhas dos clientes na tela).
//
// So entra prefixo UNANIME com pelo menos 5 chassis (validacao cruzada 5-fold
// em 10/out: acerto 99,87%, ver cambio-chassi.json). E so desempata quando as
// versoes que sobraram diferem APENAS no cambio. Regenerado 1x por mes, de
// madrugada, por ops/cambio-chassi/ (gera PR, nunca troca em prod sozinho).

const REGRAS = (dados as { regras: Record<string, Cambio> }).regras

/** Cambio pelo prefixo do chassi, ou null quando nao ha regra unanime. */
export function cambioPeloChassi(chassi: string | null | undefined): Cambio | null {
  const c = String(chassi || '').trim().toUpperCase()
  if (c.length !== 17) return null
  return REGRAS[c.slice(0, 8)] ?? null
}

export const VERSAO_CAMBIO_CHASSI = (dados as { versao: number }).versao
