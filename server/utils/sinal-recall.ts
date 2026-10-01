import type { RecallResposta } from './recall-toyota'

// O SINAL de recall da consulta gratis. Muralha igual a do leilao: do conjunto
// de matches sai SO { consta, nivel }. Nome da campanha, code, pdf, datas: nada
// disso atravessa pra consulta gratis (isso e do relatorio pago). Aqui so
// "consta ou nao" e "firme ou suave".

export type NivelRecall = 'firme' | 'suave'

export interface SinalRecall {
  /**
   * true = consta em campanha. false = a base respondeu e nao ha match.
   * null = NAO SABEMOS (timeout, servico fora, teto, marca fora do escopo).
   * Os tres sao diferentes na tela: null e false nao mostram frase.
   */
  consta: boolean | null
  /** firme se algum match e por chassi; senao suave; null quando nao consta. */
  nivel: NivelRecall | null
}

/** A base respondeu e nao ha match. */
export const RECALL_VAZIO: SinalRecall = { consta: false, nivel: null }
/** Nao deu pra consultar (ou marca fora do escopo). A tela nao mostra nada. */
export const RECALL_INDISPONIVEL: SinalRecall = { consta: null, nivel: null }

/**
 * firme tem precedencia: se QUALQUER match e por chassi (VIN cheio), o sinal e
 * firme; senao, havendo match, suave. A copy firme e mais forte ("este veiculo
 * consta") porque o chassi bate exatamente.
 */
export function sinalDoRecall(resposta: RecallResposta | null | undefined): SinalRecall {
  // Sem resposta, a consulta nao aconteceu: "nao sabemos", nunca "nao consta".
  if (!resposta || !Array.isArray(resposta.matches)) return RECALL_INDISPONIVEL
  if (resposta.matches.length === 0) return RECALL_VAZIO
  const firme = resposta.matches.some((m) => m.nivel === 'firme')
  return { consta: true, nivel: firme ? 'firme' : 'suave' }
}

/**
 * Marcas com base de recall por ora: Toyota/Lexus + Chevrolet/GM + Volkswagen/VW
 * + Fiat + Stellantis (Peugeot/Citroën/Jeep/RAM/Dodge) + Honda (carro e moto:
 * "HONDA", "I/HONDA", "HONDA/CG 160"; so no gratis, sem modo autoritativo). O escopo por marca do
 * match e server-side (a leiloes-api ja trata o falso-positivo cross-marca),
 * aqui so liberamos quem chamar. As variantes que o SENATRAN manda (ex "VW/GOL",
 * "GM/CHEVROLET", "FIAT/PALIO", "PEUGEOT/208", "I/CITROEN C3", "JEEP/RENEGADE",
 * "I/RAM 2500", "DODGE/JOURNEY") batem pelos tokens com \b (o "/" e nao-palavra).
 * Citroën cobre com/sem acento (citro[eë]n). RAM e curto: \bRAM\b NAO casa em
 * RAMPA/TRAMONTINA/GRAN (fronteira de palavra impede match no meio).
 */
export function marcaTemRecall(marca: string | null | undefined): boolean {
  return /\b(toyota|lexus|chevrolet|gm|general\s*motors|volkswagen|vw|fiat|peugeot|citro[eë]n|jeep|ram|dodge|honda)\b/i.test(String(marca || ''))
}
