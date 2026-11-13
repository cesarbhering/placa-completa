import { lerLimite, mascararPlaca, placasDoVeiculo } from './checkout-limite'
import { normalizarPlaca } from '../../shared/placa-formato'
import { precoDoPlano, type BracoPreco } from '../../shared/ab-preco'
import type { PlanoId } from '../../shared/planos'
import type { CupomValidado } from './cupons'

// Limits against guessing typed coupon codes. The per-IP rate limit does not
// hold against rotating IPs, so these count INVALID validations per vehicle
// and site-wide, in memory (the app runs in a single container, one process).
//
//   1. Per vehicle (both plate formats): after N invalid validations in the
//      last 60 min (default 5), the next validations for that plate answer 429.
//   2. Global: with more than M invalid validations site-wide in the last
//      10 min (default 30), every coupon validation answers 429 while that lasts.
//
// Only guesses count (unknown, inactive, not yet valid or expired code, other
// plan, other e-mail: `contaTentativa` from validarCupom). A valid coupon never
// counts, so our own coupons (bump, rebuy, Pix recovery) are unaffected unless
// the limit is already tripped. The screen coupon is not typed and never
// passes through here. A blocked validation does not touch the database.
//
// In the order endpoints a blocked coupon behaves like an invalid one (the
// sale goes on at full price); a sale without a coupon is never blocked here.
//
// Concurrency: the check and a "pending" reservation are synchronous, so a
// burst in the same instant cannot all read 0. Pending entries count as
// attempts and expire by themselves (30 s safety TTL). Memory is bounded:
// per-plate lists are capped, expired keys are swept, and the key map has a
// hard cap (oldest keys dropped first).
//
// Fail open on our own errors: a database error is not a guess and does not
// count. Logs mask the plate (3 chars + ****) and carry no code, e-mail or IP.

export const CUPOM_LIMITE_PLACA_HORA_PADRAO = 5
export const CUPOM_LIMITE_GLOBAL_10MIN_PADRAO = 30
export const TTL_PENDENTE_MS = 30_000
const TETO_PLACA = 99
const TETO_GLOBAL = 999
const MAX_CHAVES = 10_000
const HORA_MS = 60 * 60 * 1000
const DEZ_MIN_MS = 10 * 60 * 1000

export const MSG_CUPOM_LIMITE_PLACA = 'Muitas tentativas de cupom para esta placa. Tente de novo mais tarde.'
export const MSG_CUPOM_LIMITE_GLOBAL = 'Cupom indisponível no momento. Tente de novo mais tarde.'

export interface LimitesCupom {
  placaHora: number
  global10min: number
}

/** NUXT_CUPOM_LIMITE_PLACA_HORA, NUXT_CUPOM_LIMITE_GLOBAL_10MIN (0 = off, empty/invalid = default). */
export function limitesCupomDoConfig(config: any): LimitesCupom {
  return {
    placaHora: lerLimite(config?.cupomLimitePlacaHora, CUPOM_LIMITE_PLACA_HORA_PADRAO, TETO_PLACA),
    global10min: lerLimite(config?.cupomLimiteGlobal10min, CUPOM_LIMITE_GLOBAL_10MIN_PADRAO, TETO_GLOBAL),
  }
}

// ---------------------------------------------------------------------------
// State. Failures are timestamps; pending entries are expiry timestamps.
// ---------------------------------------------------------------------------

const falhasPlaca = new Map<string, number[]>()
const pendentesPlaca = new Map<string, number[]>()
let falhasGlobal: number[] = []
let pendentesGlobal: number[] = []

/** Test helper. */
export function _zerarCupomLimite(): void {
  falhasPlaca.clear()
  pendentesPlaca.clear()
  falhasGlobal = []
  pendentesGlobal = []
}

/** Test helper: number of plate keys held in memory. */
export function _chavesCupomLimite(): number {
  return new Set([...falhasPlaca.keys(), ...pendentesPlaca.keys()]).size
}

/** Vehicle key (both formats) or null when there is no usable plate. */
function chaveVeiculo(placa: unknown): string | null {
  const p = normalizarPlaca(placa)
  if (p.length !== 7) return null
  return placasDoVeiculo(p).sort().join('|')
}

function recentes(lista: number[] | undefined, desde: number): number[] {
  return (lista || []).filter((t) => t > desde)
}

function guardar(mapa: Map<string, number[]>, chave: string, lista: number[], agora: number): void {
  mapa.delete(chave) // re-insert so the Map order is "least recently touched first"
  if (lista.length) mapa.set(chave, lista.slice(-(TETO_PLACA + 1)))
  if (mapa.size > MAX_CHAVES) {
    for (const [k, v] of mapa) {
      const vivos = mapa === falhasPlaca ? recentes(v, agora - HORA_MS) : recentes(v, agora)
      if (!vivos.length) mapa.delete(k)
    }
    while (mapa.size > MAX_CHAVES) mapa.delete(mapa.keys().next().value as string)
  }
}

function tirar(lista: number[], marca: number): number[] {
  const i = lista.indexOf(marca)
  return i >= 0 ? [...lista.slice(0, i), ...lista.slice(i + 1)] : lista
}

export interface BloqueioCupom {
  statusCode: 429
  message: string
  motivo: 'cupom_placa' | 'cupom_global'
}

/**
 * Synchronous check. Returns the block (and logs it) or null. Counts pending
 * validations as attempts.
 */
function verificar(chave: string | null, placaLog: string, onde: string, limites: LimitesCupom, agora: number, log: (m: string) => void): BloqueioCupom | null {
  if (limites.global10min > 0) {
    falhasGlobal = recentes(falhasGlobal, agora - DEZ_MIN_MS).slice(-(TETO_GLOBAL + 1))
    pendentesGlobal = recentes(pendentesGlobal, agora)
    const n = falhasGlobal.length + pendentesGlobal.length
    if (n > limites.global10min) {
      log(`[cupom-limite] blocked ${onde} plate=${placaLog} reason=global_10min invalid=${n} limit=${limites.global10min}`)
      return { statusCode: 429, message: MSG_CUPOM_LIMITE_GLOBAL, motivo: 'cupom_global' }
    }
  }
  if (chave && limites.placaHora > 0) {
    const f = recentes(falhasPlaca.get(chave), agora - HORA_MS)
    const p = recentes(pendentesPlaca.get(chave), agora)
    guardar(falhasPlaca, chave, f, agora)
    guardar(pendentesPlaca, chave, p, agora)
    const n = f.length + p.length
    if (n >= limites.placaHora) {
      log(`[cupom-limite] blocked ${onde} plate=${placaLog} reason=plate_hour invalid=${n} limit=${limites.placaHora}`)
      return { statusCode: 429, message: MSG_CUPOM_LIMITE_PLACA, motivo: 'cupom_placa' }
    }
  }
  return null
}

export interface EntradaCupom {
  codigo: string
  plano: PlanoId
  email?: string
  braco?: BracoPreco | null
  placa?: unknown
}

export interface ResultadoCupomLimitado {
  cupom: CupomValidado
  bloqueio: BloqueioCupom | null
}

/**
 * validarCupom behind the attempt limits. When blocked, returns an invalid
 * coupon (full price) WITHOUT querying the database, plus the block.
 */
export async function validarCupomComLimite(
  supabase: any,
  entrada: EntradaCupom,
  config: any,
  opts: { onde?: string; agora?: () => number; log?: (m: string) => void } = {},
): Promise<ResultadoCupomLimitado> {
  const relogio = opts.agora ?? Date.now
  const log = opts.log ?? ((m: string) => console.warn(m))
  const limites = limitesCupomDoConfig(config)
  const chave = chaveVeiculo(entrada.placa)
  const placaLog = chave ? mascararPlaca(normalizarPlaca(entrada.placa)) : '-'
  const onde = opts.onde || 'coupon'

  const agora = relogio()
  const bloqueio = verificar(chave, placaLog, onde, limites, agora, log)
  if (bloqueio) {
    const plano = entrada.plano
    const bruto = plano === 'basica' || plano === 'completa' ? precoDoPlano(plano, entrada.braco) : 0
    return {
      cupom: { ok: false, motivo: bloqueio.message, precoBrutoCentavos: bruto, descontoCentavos: 0, precoLiquidoCentavos: bruto },
      bloqueio,
    }
  }

  // Reserve a pending slot (synchronous with the check above).
  const marca = agora + TTL_PENDENTE_MS + Math.random()
  pendentesGlobal.push(marca)
  if (chave) guardar(pendentesPlaca, chave, [...recentes(pendentesPlaca.get(chave), agora), marca], agora)

  let cupom: CupomValidado
  try {
    cupom = await validarCupom(supabase, entrada.codigo, entrada.plano, entrada.email, entrada.braco)
  } finally {
    const depois = relogio()
    pendentesGlobal = tirar(pendentesGlobal, marca)
    if (chave) guardar(pendentesPlaca, chave, recentes(tirar(pendentesPlaca.get(chave) || [], marca), depois), depois)
  }
  if (cupom && !cupom.ok && cupom.contaTentativa) {
    const depois = relogio()
    falhasGlobal.push(depois)
    if (chave) guardar(falhasPlaca, chave, [...recentes(falhasPlaca.get(chave), depois - HORA_MS), depois], depois)
  }
  return { cupom, bloqueio: null }
}

/**
 * Read-only check (no reservation, no log) for the order endpoints' e-mail
 * gate, which would otherwise query the coupon by code before validating it.
 */
export function cupomLimiteEstourado(placa: unknown, config: any, agora: number = Date.now()): boolean {
  const limites = limitesCupomDoConfig(config)
  if (limites.global10min > 0) {
    const n = recentes(falhasGlobal, agora - DEZ_MIN_MS).length + recentes(pendentesGlobal, agora).length
    if (n > limites.global10min) return true
  }
  const chave = chaveVeiculo(placa)
  if (chave && limites.placaHora > 0) {
    const n = recentes(falhasPlaca.get(chave), agora - HORA_MS).length + recentes(pendentesPlaca.get(chave), agora).length
    if (n >= limites.placaHora) return true
  }
  return false
}
