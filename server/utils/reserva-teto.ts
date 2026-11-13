// Reservas em memoria para tetos que sao contados no banco.
//
// A consulta gratis confere a contagem, gasta a chamada paga e so depois grava
// a linha que conta. N requisicoes sobrepostas liam a mesma contagem e passavam
// todas. Mesmo padrao de server/utils/checkout-limite.ts: o app roda em um
// container so, entao quem esta "em voo" (passou na conferencia, ainda nao
// gravou a linha) fica em memoria e entra na conta de quem vem junto. O passo
// de conferir + reservar e sincrono, entao uma rajada nao le tudo zero.
//
// O que cada conferencia enxerga. A reserva conta para uma requisicao quando a
// linha dela NAO estava gravada antes de a contagem dessa requisicao COMECAR
// (relogio logico, sem hora de parede):
//   - ainda nao liberada: a linha nao existe, conta;
//   - liberada depois que a contagem comecou: a contagem pode nao ter visto a
//     linha, conta (conservador, e so entre requisicoes de fato sobrepostas);
//   - liberada antes de a contagem comecar: a linha ja esta na contagem do
//     banco, nao conta duas vezes.
// Quem faz uma consulta depois da outra nunca e afetado.
//
// TTL de seguranca para a reserva que nunca e liberada, memoria limitada e
// falha aberta: qualquer problema aqui = sem reserva, a requisicao segue.

/** Reserva nunca liberada deixa de contar depois disto (a requisicao mais longa cabe com folga). */
export const TTL_RESERVA_MS = 3 * 60_000
/** Depois de liberada, a reserva fica este tempo para as contagens que ja estavam em curso. */
export const RETENCAO_POS_LIBERACAO_MS = 60_000
/** Teto de chaves em memoria. Cheio de reservas vivas = requisicao segue sem reservar. */
export const MAX_CHAVES = 20_000
/** A partir daqui, uma reserva nova varre as chaves vencidas (no maximo uma varredura por segundo). */
const PODAR_A_PARTIR_DE = 5_000
const INTERVALO_PODA_MS = 1_000

interface Reserva {
  expira: number
  /** Passo do relogio logico em que a linha foi gravada; null enquanto em voo. */
  liberadaNoPasso: number | null
}

/** `consumiu` = a linha que conta foi gravada (padrao true). false = a vaga nao foi usada. */
export type Liberar = (consumiu?: boolean, agora?: number) => void
export const SEM_RESERVA: Liberar = () => {}

const emVoo = new Map<string, Reserva[]>()
let passo = 0
let ultimaPoda = 0

/** Chamar logo ANTES de mandar a consulta de contagem; o valor vai para `emVooPara`. */
export function inicioDaContagem(): number {
  return ++passo
}

function vivas(chave: string, agora: number): Reserva[] {
  const lista = emVoo.get(chave)
  if (!lista) return []
  const v = lista.filter((r) => r.expira > agora)
  if (v.length) emVoo.set(chave, v)
  else emVoo.delete(chave)
  return v
}

/**
 * Quantas reservas de `chave` a contagem iniciada em `inicio` pode nao ter
 * visto no banco. Somar ao resultado da contagem, no mesmo passo sincrono da
 * decisao.
 */
export function emVooPara(chave: string, inicio: number, agora = Date.now()): number {
  if (!chave) return 0
  return vivas(chave, agora).filter((r) => r.liberadaNoPasso === null || r.liberadaNoPasso > inicio).length
}

function podarSePreciso(agora: number): void {
  if (emVoo.size < PODAR_A_PARTIR_DE) return
  if (agora >= ultimaPoda && agora - ultimaPoda < INTERVALO_PODA_MS) return
  ultimaPoda = agora
  for (const chave of [...emVoo.keys()]) vivas(chave, agora)
}

/**
 * Reserva uma vaga em `chave` e devolve a funcao que libera (idempotente).
 * Chamar no mesmo passo sincrono em que a conferencia passou. Nunca lanca.
 */
export function reservar(chave: string, agora = Date.now()): Liberar {
  if (!chave) return SEM_RESERVA
  podarSePreciso(agora)
  if (emVoo.size >= MAX_CHAVES && !emVoo.has(chave)) return SEM_RESERVA

  const reserva: Reserva = { expira: agora + TTL_RESERVA_MS, liberadaNoPasso: null }
  emVoo.set(chave, [...vivas(chave, agora), reserva])

  let liberada = false
  return (consumiu = true, quando = Date.now()) => {
    if (liberada) return
    liberada = true
    if (consumiu) {
      reserva.liberadaNoPasso = ++passo
      reserva.expira = Math.min(reserva.expira, quando + RETENCAO_POS_LIBERACAO_MS)
      return
    }
    const resto = (emVoo.get(chave) || []).filter((r) => r !== reserva)
    if (resto.length) emVoo.set(chave, resto)
    else emVoo.delete(chave)
  }
}

/** So para teste. */
export function _zerarReservas(): void {
  emVoo.clear()
  passo = 0
  ultimaPoda = 0
}

/** So para teste: quantas chaves estao em memoria. */
export function _chavesEmMemoria(): number {
  return emVoo.size
}
