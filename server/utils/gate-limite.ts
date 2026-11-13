// Limit on wrong passwords at the homolog/staging gate (server/api/premium/gate.post.ts).
// Counted site-wide, not per IP (rotating IPs defeat a per-IP limit): more than
// GATE_MAX_ERROS wrong passwords in 10 minutes locks the gate for 10 minutes,
// for everyone and even for the right password. In memory (single process).
// Production is not gated, so nothing here runs there.

export const GATE_MAX_ERROS = 10
export const GATE_JANELA_MS = 10 * 60 * 1000
export const GATE_BLOQUEIO_MS = 10 * 60 * 1000
export const MSG_GATE_LIMITE = 'Muitas tentativas. Tente de novo em alguns minutos.'

let erros: number[] = []
let bloqueadoAte = 0

/** Test helper. */
export function _zerarGateLimite(): void {
  erros = []
  bloqueadoAte = 0
}

/** true while the gate is locked. */
export function gateBloqueado(agora: number = Date.now()): boolean {
  return agora < bloqueadoAte
}

/** Records a wrong password; arms the lock when the window goes over the limit. */
export function registrarSenhaErrada(agora: number = Date.now(), log: (m: string) => void = (m) => console.warn(m)): void {
  erros = erros.filter((t) => t > agora - GATE_JANELA_MS)
  erros.push(agora)
  if (erros.length > GATE_MAX_ERROS) {
    bloqueadoAte = agora + GATE_BLOQUEIO_MS
    erros = []
    log(`[gate-limite] locked for ${GATE_BLOQUEIO_MS / 60000} min after more than ${GATE_MAX_ERROS} wrong passwords in ${GATE_JANELA_MS / 60000} min`)
  }
}
