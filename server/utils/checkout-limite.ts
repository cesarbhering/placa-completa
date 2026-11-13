import { normalizarPlaca, placaEquivalente } from '../../shared/placa-formato'

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
// The plate counts in both formats (old and Mercosul are the same vehicle).
// Concurrent requests: the app runs in a single container, so orders "in
// flight" (check passed, insert not done yet) are kept in memory and added to
// the database count; the check + reserve step is synchronous, so a burst in
// the same second cannot all read 0. After the insert the reservation is
// shortened (count timeout + 500 ms) instead of deleted, with a 30 s safety
// TTL when it is never released. The definitive fix would be counting and inserting in one RPC.
//
// Fail open: a counting error or a count slower than 1.5 s lets the sale go
// through (with a log line). We never block a sale because of our own failure.
// Paid orders never count. Logs mask the plate (3 chars + ****) and carry no
// e-mail or IP.

export const LIMITE_PLACA_HORA_PADRAO = 6
export const LIMITE_CARTAO_PLACA_HORA_PADRAO = 3
export const DISJUNTOR_CARTAO_10MIN_PADRAO = 12
export const TIMEOUT_CONTAGEM_MS = 1500
export const TTL_EM_VOO_MS = 30_000
/** After release, a reservation lives this long past the count timeout. */
export const MARGEM_LIBERACAO_MS = 500
/** Per-plate limits are capped below the row cap of the count query. */
const TETO_LIMITE_PLACA = 99
const LINHAS_PLACA = 100
const TETO_DISJUNTOR = 499
const LINHAS_DISJUNTOR = 500
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
 * Env value -> limit. Empty, invalid, negative or between 0 and 1 = default;
 * exactly 0 = that limit turned off; capped at `teto`.
 */
export function lerLimite(v: unknown, padrao: number, teto: number): number {
  if (v === undefined || v === null || String(v).trim() === '') return padrao
  const n = Number(String(v).trim())
  if (!Number.isFinite(n) || n < 0) return padrao
  if (n === 0) return 0
  if (n < 1) return padrao
  return Math.min(Math.floor(n), teto)
}

/** NUXT_CHECKOUT_LIMITE_PLACA_HORA, NUXT_CHECKOUT_LIMITE_CARTAO_PLACA_HORA, NUXT_CHECKOUT_DISJUNTOR_CARTAO_10MIN. */
export function limitesDoConfig(config: any): LimitesCheckout {
  return {
    placaHora: lerLimite(config?.checkoutLimitePlacaHora, LIMITE_PLACA_HORA_PADRAO, TETO_LIMITE_PLACA),
    cartaoPlacaHora: lerLimite(config?.checkoutLimiteCartaoPlacaHora, LIMITE_CARTAO_PLACA_HORA_PADRAO, TETO_LIMITE_PLACA),
    cartaoGlobal10min: lerLimite(config?.checkoutDisjuntorCartao_10min, DISJUNTOR_CARTAO_10MIN_PADRAO, TETO_DISJUNTOR),
  }
}

export function mascararPlaca(placa: string): string {
  return `${String(placa || '').slice(0, 3)}****`
}

/** The plate in both formats (old and Mercosul), deduplicated. */
export function placasDoVeiculo(placa: string): string[] {
  const p = normalizarPlaca(placa)
  const eq = placaEquivalente(p)
  return eq && eq !== p ? [p, eq] : [p]
}

// ---------------------------------------------------------------------------
// In-flight orders (single container). Each entry is an expiry timestamp.
// ---------------------------------------------------------------------------

const emVooPlaca = new Map<string, number[]>()
const emVooCartaoPlaca = new Map<string, number[]>()
let emVooCartaoSite: number[] = []

function chaveVeiculo(placa: string): string {
  return placasDoVeiculo(placa).sort().join('|')
}

function vivos(lista: number[] | undefined, agora: number): number[] {
  return (lista || []).filter((t) => t > agora)
}

function contar(mapa: Map<string, number[]>, chave: string, agora: number): number {
  const v = vivos(mapa.get(chave), agora)
  if (v.length) mapa.set(chave, v)
  else mapa.delete(chave)
  return v.length
}

/** Replaces one reservation's expiry (identified by its unique timestamp). */
function trocar(lista: number[] | undefined, marca: number, novo: number): number[] {
  const l = [...(lista || [])]
  const i = l.indexOf(marca)
  if (i >= 0) l[i] = Math.min(l[i], novo)
  return l
}

/** Test helper. */
export function _zerarEmVoo(): void {
  emVooPlaca.clear()
  emVooCartaoPlaca.clear()
  emVooCartaoSite = []
}

// ---------------------------------------------------------------------------

export interface BloqueioCheckout {
  statusCode: 429 | 503
  message: string
  motivo: 'placa' | 'cartao_placa' | 'disjuntor_cartao'
}

export interface ResultadoLimite {
  bloqueio: BloqueioCheckout | null
  /** Releases this request's in-flight slot. Idempotent; a no-op when nothing was reserved. */
  liberar: () => void
}

const NADA = () => {}

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
 * Decides whether this checkout must be blocked and, when it passes, reserves
 * an in-flight slot (release it with `liberar` after the order insert). Never
 * throws: any failure (database error, timeout) = let the sale through.
 */
export async function verificarLimiteCheckout(
  supabase: any,
  pedido: { placa: string; ambiente: string; cartao: boolean },
  limites: LimitesCheckout,
  opts: { agora?: () => number; timeoutMs?: number; log?: (m: string) => void } = {},
): Promise<ResultadoLimite> {
  const relogio = opts.agora ?? Date.now
  const log = opts.log ?? ((m: string) => console.warn(m))
  const placaLog = mascararPlaca(pedido.placa)
  const meio = pedido.cartao ? 'card' : 'pix'
  const placas = placasDoVeiculo(pedido.placa)
  const chave = `${pedido.ambiente}|${chaveVeiculo(pedido.placa)}`
  const checaPlaca = limites.placaHora > 0 || (pedido.cartao && limites.cartaoPlacaHora > 0)
  const checaDisjuntor = pedido.cartao && limites.cartaoGlobal10min > 0

  // 1) Database counts (async, may fail or be slow -> fail open).
  let daPlaca: any[] = []
  let recentes: any[] = []
  // Computed INSIDE the try so a malformed row can never turn into a 500.
  let algumPago = false
  try {
    const t0 = relogio()
    await comTimeout((async () => {
      const [a, b] = await Promise.all([
        checaPlaca
          ? linhas(supabase.from('pedidos_premium')
            .select('forma_pagamento,pago_em,status')
            .in('placa', placas)
            .eq('ambiente', pedido.ambiente)
            .gte('criado_em', new Date(t0 - HORA_MS).toISOString())
            .limit(LINHAS_PLACA))
          : Promise.resolve([]),
        // Paid first, so the row cap can never hide a paid order.
        checaDisjuntor
          ? linhas(supabase.from('pedidos_premium')
            .select('pago_em,status')
            .eq('forma_pagamento', 'cartao')
            .eq('ambiente', pedido.ambiente)
            .gte('criado_em', new Date(t0 - DEZ_MIN_MS).toISOString())
            .order('pago_em', { ascending: false, nullsFirst: false })
            .limit(LINHAS_DISJUNTOR))
          : Promise.resolve([]),
      ])
      const objetos = (l: any[]) => l.filter((p) => p && typeof p === 'object')
      daPlaca = objetos(a).filter((p) => !foiPago(p))
      recentes = objetos(b)
      algumPago = recentes.some(foiPago)
    })(), opts.timeoutMs ?? TIMEOUT_CONTAGEM_MS)
  } catch (e: any) {
    log(`[checkout-limite] check failed, letting the sale through (${meio} plate=${placaLog}): ${String(e?.message || e).slice(0, 120)}`)
    return { bloqueio: null, liberar: NADA }
  }

  // 2) Decision + reservation: synchronous from here on (no await), so
  // concurrent requests are serialized by the event loop.
  const agora = relogio()
  const voandoPlaca = contar(emVooPlaca, chave, agora)
  const voandoCartaoPlaca = contar(emVooCartaoPlaca, chave, agora)
  emVooCartaoSite = vivos(emVooCartaoSite, agora)

  const naoPagos = daPlaca.length + voandoPlaca
  if (limites.placaHora > 0 && naoPagos >= limites.placaHora) {
    log(`[checkout-limite] blocked ${meio} plate=${placaLog} reason=plate_hour unpaid=${naoPagos} limit=${limites.placaHora}`)
    return { bloqueio: { statusCode: 429, message: MSG_LIMITE_PLACA, motivo: 'placa' }, liberar: NADA }
  }
  if (pedido.cartao) {
    const cartoes = daPlaca.filter((p) => p.forma_pagamento === 'cartao').length + voandoCartaoPlaca
    if (limites.cartaoPlacaHora > 0 && cartoes >= limites.cartaoPlacaHora) {
      log(`[checkout-limite] blocked card plate=${placaLog} reason=card_plate_hour unpaid=${cartoes} limit=${limites.cartaoPlacaHora}`)
      return { bloqueio: { statusCode: 429, message: MSG_LIMITE_CARTAO_PLACA, motivo: 'cartao_placa' }, liberar: NADA }
    }
    if (checaDisjuntor) {
      const criados = recentes.length + emVooCartaoSite.length
      if (criados > limites.cartaoGlobal10min && !algumPago) {
        log(`[checkout-limite] blocked card plate=${placaLog} reason=card_breaker created_10min=${criados} limit=${limites.cartaoGlobal10min}`)
        return { bloqueio: { statusCode: 503, message: MSG_DISJUNTOR_CARTAO, motivo: 'disjuntor_cartao' }, liberar: NADA }
      }
    }
  }

  // Passed: reserve the in-flight slot(s).
  const marca = agora + TTL_EM_VOO_MS + Math.random() // unique per reservation
  emVooPlaca.set(chave, [...vivos(emVooPlaca.get(chave), agora), marca])
  if (pedido.cartao) {
    emVooCartaoPlaca.set(chave, [...vivos(emVooCartaoPlaca.get(chave), agora), marca])
    emVooCartaoSite.push(marca)
  }
  let liberado = false
  return {
    bloqueio: null,
    // Not deleted: a count already in flight before the insert sees neither
    // the new row nor a deleted reservation. The reservation is shortened to
    // outlive any count started before now (timeout + margin), then expires.
    liberar: () => {
      if (liberado) return
      liberado = true
      const curto = relogio() + TIMEOUT_CONTAGEM_MS + MARGEM_LIBERACAO_MS + Math.random()
      emVooPlaca.set(chave, trocar(emVooPlaca.get(chave), marca, curto))
      if (pedido.cartao) {
        emVooCartaoPlaca.set(chave, trocar(emVooCartaoPlaca.get(chave), marca, curto))
        emVooCartaoSite = trocar(emVooCartaoSite, marca, curto)
      }
    },
  }
}

/**
 * Endpoint helper: throws the 429/503 when blocked (marked `limite` in data so
 * the client knows the message is for the buyer); otherwise returns the
 * release function to call right after the order insert.
 */
export async function barrarLimiteCheckout(
  supabase: any,
  pedido: { placa: string; ambiente: string; cartao: boolean },
  config: any,
): Promise<() => void> {
  const r = await verificarLimiteCheckout(supabase, pedido, limitesDoConfig(config))
  if (r.bloqueio) {
    throw createError({ statusCode: r.bloqueio.statusCode, message: r.bloqueio.message, data: { limite: true, motivo: r.bloqueio.motivo } })
  }
  return r.liberar
}
