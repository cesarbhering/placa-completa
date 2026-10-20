import { isPlanoPago, type PlanoId } from './planos'

// Link generico com o plano ja escolhido (Cesar, 20/out/2026):
// placacompleta.com.br/?plano=completa (ou basica), SEM placa. A pessoa digita a
// placa e vai direto ao pagamento daquele plano (pula o resultado gratis).
// Com placa na URL (/?placa=X&plano=Y) vale o fluxo antigo (link_direto).
// So na web: no app (Capacitor) e no PWA nada muda.
export function planoDoLinkSemPlaca(
  query: { placa?: unknown; plano?: unknown },
  ctx: { placaNaRota?: string; app?: boolean; pwa?: boolean } = {},
): Exclude<PlanoId, 'gratis'> | null {
  if (ctx.app || ctx.pwa) return null
  const placa = String(ctx.placaNaRota ?? query.placa ?? '').replace(/[^A-Za-z0-9]/g, '')
  if (placa) return null
  return isPlanoPago(query.plano) ? (query.plano as Exclude<PlanoId, 'gratis'>) : null
}
