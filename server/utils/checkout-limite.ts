// Checkout protection against automation (incident 12/nov/2026: dozens of
// unpaid orders for the same plate in bursts, each from a different
// residential IP, Pix charges created at the provider and card intents in the
// same second). The compra-repetida guard is per IP + device, so rotating IPs
// pass through it. These limits are per PLATE and, for the card, global.
//
//   1. Any checkout (Pix, card intent, Stripe session): at most N UNPAID orders
//      for the same plate created in the last 60 min (default 6). Above that:
//      429 and no order, no charge at the provider.
//   2. Card only: at most M unpaid card orders per plate in 60 min (default 3).
//   3. Card circuit breaker: more than K card orders created site-wide in the
//      last 10 min and NONE of them paid (default 12) = card answers 503 while
//      that lasts. Pix keeps working.
//
// Fail open: a counting error or a count slower than 1.5 s lets the sale go
// through (with a log line). We never block a sale because of our own failure.
// Paid orders never count. Logs mask the plate (3 chars + ****) and carry no
// e-mail or IP.

export const LIMITE_PLACA_HORA_PADRAO = 6
export const LIMITE_CARTAO_PLACA_HORA_PADRAO = 3
export const DISJUNTOR_CARTAO_10MIN_PADRAO = 12
export const TIMEOUT_CONTAGEM_MS = 1500
const HORA_MS = 60 * 60 * 1000
const DEZ_MIN_MS = 10 * 60 * 1000
/** Status that mean the order was paid (pago_em is the main signal). */
const STATUS_PAGOS = ['pago', 'consultando', 'entregue', 'reembolsado']

export const MSG_LIMITE_PLACA = 'Muitas tentativas de pagamento para esta placa na última hora. Tente de novo mais tarde.'
export const MSG_LIMITE_CARTAO_PLACA = 'Muitas tentativas com cartão para esta placa na última hora. Use o Pix ou tente de novo mais tarde.'
export const MSG_DISJUNTOR_CARTAO = 'Cartão indisponível no momento. Use o Pix.'

export interface LimitesCheckout {
  placaHora: number
  cartaoPlacaHora: number
  cartaoGlobal10min: number
}

/**
 * Env value -> limit. Empty / invalid = default; "0" = that limit turned off.
 */
function lerLimite(v: unknown, padrao: number): number {
  if (v === undefined || v === null || String(v).trim() === '') return padrao
  const n = Number(String(v).trim())
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : padrao
}

/** NUXT_CHECKOUT_LIMITE_PLACA_HORA, NUXT_CHECKOUT_LIMITE_CARTAO_PLACA_HORA, NUXT_CHECKOUT_DISJUNTOR_CARTAO_10MIN. */
export function limitesDoConfig(config: any): LimitesCheckout {
  return {
    placaHora: lerLimite(config?.checkoutLimitePlacaHora, LIMITE_PLACA_HORA_PADRAO),
    cartaoPlacaHora: lerLimite(config?.checkoutLimiteCartaoPlacaHora, LIMITE_CARTAO_PLACA_HORA_PADRAO),
    cartaoGlobal10min: lerLimite(config?.checkoutDisjuntorCartao10min, DISJUNTOR_CARTAO_10MIN_PADRAO),
  }
}

export function mascararPlaca(placa: string): string {
  return `${String(placa || '').slice(0, 3)}****`
}

export interface BloqueioCheckout {
  statusCode: 429 | 503
  message: string
  motivo: 'placa' | 'cartao_placa' | 'disjuntor_cartao'
}

function foiPago(p: { pago_em?: string | null; status?: string | null }): boolean {
  return !!p.pago_em || STATUS_PAGOS.includes(String(p.status || ''))
}

function comTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    p,
    new Promise<T>((_, rej) => { t = setTimeout(() => rej(new Error(`count timeout ${ms}ms`)), ms) }),
  ]).finally(() => { if (t) clearTimeout(t) })
}

async function linhas(q: any): Promise<any[]> {
  const { data, error } = await q
  if (error) throw new Error(String(error.message || error))
  return Array.isArray(data) ? data : []
}

/**
 * Decides whether this checkout must be blocked. Never throws: any failure
 * (database error, timeout) returns null = let the sale through.
 */
export async function verificarLimiteCheckout(
  supabase: any,
  pedido: { placa: string; ambiente: string; cartao: boolean },
  limites: LimitesCheckout,
  opts: { agora?: number; timeoutMs?: number; log?: (m: string) => void } = {},
): Promise<BloqueioCheckout | null> {
  const agora = opts.agora ?? Date.now()
  const log = opts.log ?? ((m: string) => console.warn(m))
  const placaLog = mascararPlaca(pedido.placa)
  const cartao = pedido.cartao ? 'card' : 'pix'
  try {
    return await comTimeout((async () => {
      // 1 and 2: unpaid orders for this plate in the last hour.
      if (limites.placaHora > 0 || (pedido.cartao && limites.cartaoPlacaHora > 0)) {
        const desde = new Date(agora - HORA_MS).toISOString()
        const daPlaca = (await linhas(supabase.from('pedidos_premium')
          .select('forma_pagamento,pago_em,status')
          .eq('placa', pedido.placa)
          .eq('ambiente', pedido.ambiente)
          .gte('criado_em', desde)
          .limit(100))).filter((p) => !foiPago(p))
        if (limites.placaHora > 0 && daPlaca.length >= limites.placaHora) {
          log(`[checkout-limite] blocked ${cartao} plate=${placaLog} reason=plate_hour unpaid=${daPlaca.length} limit=${limites.placaHora}`)
          return { statusCode: 429, message: MSG_LIMITE_PLACA, motivo: 'placa' } as BloqueioCheckout
        }
        const cartoes = daPlaca.filter((p) => p.forma_pagamento === 'cartao').length
        if (pedido.cartao && limites.cartaoPlacaHora > 0 && cartoes >= limites.cartaoPlacaHora) {
          log(`[checkout-limite] blocked card plate=${placaLog} reason=card_plate_hour unpaid=${cartoes} limit=${limites.cartaoPlacaHora}`)
          return { statusCode: 429, message: MSG_LIMITE_CARTAO_PLACA, motivo: 'cartao_placa' } as BloqueioCheckout
        }
      }
      // 3: site-wide card circuit breaker.
      if (pedido.cartao && limites.cartaoGlobal10min > 0) {
        const desde = new Date(agora - DEZ_MIN_MS).toISOString()
        const recentes = await linhas(supabase.from('pedidos_premium')
          .select('pago_em,status')
          .eq('forma_pagamento', 'cartao')
          .eq('ambiente', pedido.ambiente)
          .gte('criado_em', desde)
          .limit(500))
        const pagos = recentes.filter(foiPago).length
        if (recentes.length > limites.cartaoGlobal10min && pagos === 0) {
          log(`[checkout-limite] blocked card plate=${placaLog} reason=card_breaker created_10min=${recentes.length} limit=${limites.cartaoGlobal10min}`)
          return { statusCode: 503, message: MSG_DISJUNTOR_CARTAO, motivo: 'disjuntor_cartao' } as BloqueioCheckout
        }
      }
      return null
    })(), opts.timeoutMs ?? TIMEOUT_CONTAGEM_MS)
  } catch (e: any) {
    log(`[checkout-limite] check failed, letting the sale through (${cartao} plate=${placaLog}): ${String(e?.message || e).slice(0, 120)}`)
    return null
  }
}

/** Endpoint helper: throws the 429/503 when blocked, does nothing otherwise. */
export async function barrarLimiteCheckout(
  supabase: any,
  pedido: { placa: string; ambiente: string; cartao: boolean },
  config: any,
): Promise<void> {
  const b = await verificarLimiteCheckout(supabase, pedido, limitesDoConfig(config))
  if (b) throw createError({ statusCode: b.statusCode, message: b.message, data: { limite: b.motivo } })
}
