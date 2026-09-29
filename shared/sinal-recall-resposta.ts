// Como a tela LE a resposta do /api/recall-sinal.
//
// Espelha o sinal-leilao: TRES estados, nao dois. "Nao sabemos" (timeout,
// servico fora, teto, marca fora do escopo) NAO pode virar "nao consta" na
// tela. So Toyota/Lexus por ora.
//
// REGRA DE COPY (Cesar): a base so sabe que o carro CONSTA numa campanha, nunca
// se ja foi atendido. Nunca afirmar "pendente/atrasado". Copy VAGA nos dois
// niveis (firme = chassi bate; suave = so modelo/ano).
export type NivelRecall = 'firme' | 'suave'

export interface SinalRecallNaTela {
  /** true = consta em campanha. (false/null nao chegam aqui: viram null.) */
  consta: boolean
  nivel: NivelRecall
}

export function sinalRecallDaResposta(resposta: any): SinalRecallNaTela | null {
  // So mostra frase quando CONSTA. "nao consta" (consta:false) e "nao sabemos"
  // (indisponivel) sao silencio -> devolvem null pra tela.
  if (resposta?.consta !== true) return null
  return { consta: true, nivel: resposta?.nivel === 'firme' ? 'firme' : 'suave' }
}

/**
 * A frase do recall na tela. So existe quando consta. Copy VAGA (Cesar): nunca
 * diz que esta pendente/atrasado, so que consta numa campanha e manda conferir.
 */
export function fraseRecallNaTela(sinal: SinalRecallNaTela | null): string {
  if (!sinal?.consta) return ''
  return sinal.nivel === 'firme'
    ? 'Este veículo consta em uma campanha de recall (aviso de risco). Confira no relatório completo se já foi atendido.'
    : 'Este modelo/ano teve campanha de recall. Confira no relatório completo se já foi resolvido.'
}
