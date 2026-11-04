// Cupom de tela (consulta gratis): numeros compartilhados entre a tela e o
// servidor. Quem decide se vale e o servidor (server/utils/cupom-tela.ts).
export const CUPOM_TELA_PCT = 10
export const CUPOM_TELA_JANELA_MS = 30 * 60 * 1000

/** "29:41" a partir dos milissegundos restantes (nunca negativo). */
export function relogioCupomTela(restanteMs: number): string {
  const s = Math.max(0, Math.floor(restanteMs / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** A tela so mostra o cupom de tela para quem NAO chegou com ?cupom= na URL. */
export function mostrarCupomTela(queryCupom: unknown, app: boolean): boolean {
  if (app) return false
  const v = Array.isArray(queryCupom) ? queryCupom[0] : queryCupom
  return !String(v ?? '').trim()
}
