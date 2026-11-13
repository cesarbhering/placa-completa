import { lerLimite, mascararPlaca, placasDoVeiculo } from './checkout-limite'
import { normalizarPlaca } from '../../shared/placa-formato'
import { precoDoPlano, type BracoPreco } from '../../shared/ab-preco'
import type { PlanoId } from '../../shared/planos'
import crypto from 'node:crypto'
import { ORIGENS_CUPOM_SISTEMA, type CupomValidado } from './cupons'

// Limits against guessing typed coupon codes. The per-IP rate limit does not
// hold against rotating IPs, so these count INVALID attempts per vehicle and
// site-wide, in memory (the app runs in a single container, one process).
//
//   1. Per vehicle (both plate formats): after N counted attempts in the last
//      60 min (default 5), the next coupon for that plate is refused (429 on
//      /api/premium/coupon) without touching the database, whatever the code.
//   2. Global: with more than M counted attempts site-wide in the last 10 min
//      (default 30), only coupons WE generated are accepted while that lasts:
//      system origin (ORIGENS_CUPOM_SISTEMA) or a personal coupon (e-mail
//      matched, or not typed yet). The decision is taken right after the first
//      lookup by code, so an unknown code and a paused campaign coupon cost the
//      same work and get the same answer. Ours then go through every normal
//      check. Known limitation: hand-typed campaign coupons pause during an attack.
//
// Every lookup of a typed code goes through here: the validation proper
// (validarCupomComLimite) and the "does this code waive the e-mail?" check of
// the order endpoints (cupomDispensaEmailComLimite).
//
// What counts: a guess (unknown, inactive, not yet valid or expired code,
// other plan, other e-mail), and a campaign coupon refused under the global
// limit, so an ongoing attack keeps it armed. Never counted: a coupon accepted,
// a database error, and a refusal caused only by validations still in flight.
// Each (vehicle, code) pair counts at most once per window (the checkout
// validates the same code several times per purchase); only a short hash of
// the code is kept, never the code itself.
//
// In the order endpoints a blocked coupon behaves like an invalid one (the
// sale goes on at full price); a sale without a coupon is never blocked here.
//
// Concurrency: the checks and a "pending" reservation are synchronous, so a
// burst in the same instant cannot all read 0. Pending entries count as
// attempts and expire by themselves (30 s safety TTL). Memory is bounded:
// per-plate and global lists are capped, expired keys are swept, and the key
// map has a hard cap (oldest keys dropped first). A limit set to 0 keeps nothing.
//
// Logs mask the plate (3 chars + ****) and carry no code, e-mail or IP.

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
    global10min: lerLimite(config?.cupomLimiteGlobal_10min, CUPOM_LIMITE_GLOBAL_10MIN_PADRAO, TETO_GLOBAL),
  }
}

// ---------------------------------------------------------------------------
// State. A failure is { t: timestamp, h: short hash of the code }; pending
// entries are expiry timestamps.
// ---------------------------------------------------------------------------

interface Falha { t: number; h: string }

const falhasPlaca = new Map<string, Falha[]>()
const pendentesPlaca = new Map<string, number[]>()
let falhasGlobal: Falha[] = [] // h = vehicle key + code hash
let pendentesGlobal: number[] = []

/** Test helper. */
export function _zerarCupomLimite(): void {
  falhasPlaca.clear()
  pendentesPlaca.clear()
  falhasGlobal = []
  pendentesGlobal = []
}

/** Test helper: sizes held in memory. */
export function _tamanhoCupomLimite(): { chaves: number; global: number } {
  return { chaves: new Set([...falhasPlaca.keys(), ...pendentesPlaca.keys()]).size, global: falhasGlobal.length }
}

/** Vehicle key (both formats) or null when there is no usable plate. */
function chaveVeiculo(placa: unknown): string | null {
  const p = normalizarPlaca(placa)
  if (p.length !== 7) return null
  return placasDoVeiculo(p).sort().join('|')
}

/** Same normalization as validarCupom. */
function normalizarCodigo(codigo: unknown): string {
  return String(codigo || '').trim().toUpperCase().replace(/\s+/g, '')
}

/** Short hash of the code: enough to tell repeats apart, not to recover it. */
function hashCodigo(codigo: string): string {
  return crypto.createHash('sha256').update(codigo).digest('base64url').slice(0, 12)
}

function vivas(lista: Falha[] | undefined, desde: number): Falha[] {
  return (lista || []).filter((f) => f.t > desde)
}

function vivos(lista: number[] | undefined, agora: number): number[] {
  return (lista || []).filter((t) => t > agora)
}

function guardar<T>(mapa: Map<string, T[]>, chave: string, lista: T[], agora: number): void {
  mapa.delete(chave) // re-insert so the Map order is "least recently touched first"
  if (lista.length) mapa.set(chave, lista.slice(-(TETO_PLACA + 1)))
  if (mapa.size > MAX_CHAVES) {
    for (const [k, v] of mapa) {
      const resta = (v as any[]).filter((x) => (typeof x === 'number' ? x > agora : x.t > agora - HORA_MS))
      if (!resta.length) mapa.delete(k)
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

const BLOQUEIO_PLACA: BloqueioCupom = { statusCode: 429, message: MSG_CUPOM_LIMITE_PLACA, motivo: 'cupom_placa' }
const BLOQUEIO_GLOBAL: BloqueioCupom = { statusCode: 429, message: MSG_CUPOM_LIMITE_GLOBAL, motivo: 'cupom_global' }

/** Records one counted attempt, once per (vehicle, code) per window. */
function registrarFalha(chave: string | null, h: string, limites: LimitesCupom, agora: number): void {
  if (chave && limites.placaHora > 0) {
    const lista = vivas(falhasPlaca.get(chave), agora - HORA_MS)
    if (!lista.some((f) => f.h === h)) lista.push({ t: agora, h })
    guardar(falhasPlaca, chave, lista, agora)
  }
  if (limites.global10min > 0) {
    const k = `${chave || '-'}#${h}`
    falhasGlobal = vivas(falhasGlobal, agora - DEZ_MIN_MS)
    if (!falhasGlobal.some((f) => f.h === k)) falhasGlobal.push({ t: agora, h: k })
    falhasGlobal = falhasGlobal.slice(-(TETO_GLOBAL + 1))
  }
}

/** Accepted while the global limit is on: a coupon we generated. */
export function cupomDoSistema(c: CupomValidado | null | undefined): boolean {
  return !!c?.ok && (ORIGENS_CUPOM_SISTEMA.includes(String(c.origem || '')) || c.pessoal === true || c.exigeEmail === true)
}

interface Avaliacao {
  /** One of ours: accepted even under the global limit. */
  aceito: boolean
  /** A guess: always counts. */
  palpite: boolean
  /** Exists but is not ours: counts only when refused under the global limit. */
  foraDoSistema: boolean
}

type Opcoes = { onde?: string; agora?: () => number; log?: (m: string) => void }

/**
 * Runs one lookup of a typed code behind the limits. `executar` receives
 * `somenteDoSistema` = global limit on (refuse what is not ours right after
 * the first lookup). Returns null + the block when refused.
 */
async function comLimite<T>(
  entrada: { placa?: unknown; codigo: unknown },
  config: any,
  opts: Opcoes,
  executar: (somenteDoSistema: boolean) => Promise<T>,
  avaliar: (r: T) => Avaliacao,
): Promise<{ resultado: T | null; bloqueio: BloqueioCupom | null }> {
  const relogio = opts.agora ?? Date.now
  const log = opts.log ?? ((m: string) => console.warn(m))
  const limites = limitesCupomDoConfig(config)
  const chave = chaveVeiculo(entrada.placa)
  const placaLog = chave ? mascararPlaca(normalizarPlaca(entrada.placa)) : '-'
  const onde = opts.onde || 'coupon'
  const h = hashCodigo(normalizarCodigo(entrada.codigo))

  // 1) Per plate: refuses everything, no database lookup, nothing recorded.
  const agora = relogio()
  if (chave && limites.placaHora > 0) {
    const f = vivas(falhasPlaca.get(chave), agora - HORA_MS)
    const p = vivos(pendentesPlaca.get(chave), agora)
    guardar(falhasPlaca, chave, f, agora)
    guardar(pendentesPlaca, chave, p, agora)
    const n = f.length + p.length
    if (n >= limites.placaHora) {
      log(`[cupom-limite] blocked ${onde} plate=${placaLog} reason=plate_hour invalid=${n} limit=${limites.placaHora}`)
      return { resultado: null, bloqueio: BLOQUEIO_PLACA }
    }
  }
  // 2) Global: noted now (same synchronous step as the reservation), decided
  // after the first lookup, since our own coupons stay accepted. "Real" = armed
  // by recorded failures alone, not by validations still in flight.
  let armado = false
  let armadoReal = false
  let nGlobal = 0
  if (limites.global10min > 0) {
    falhasGlobal = vivas(falhasGlobal, agora - DEZ_MIN_MS)
    pendentesGlobal = vivos(pendentesGlobal, agora)
    nGlobal = falhasGlobal.length + pendentesGlobal.length
    armado = nGlobal > limites.global10min
    armadoReal = falhasGlobal.length > limites.global10min
  }

  // Reserve a pending slot (synchronous with the checks above).
  const marca = agora + TTL_PENDENTE_MS + Math.random()
  if (limites.global10min > 0) pendentesGlobal.push(marca)
  if (chave && limites.placaHora > 0) guardar(pendentesPlaca, chave, [...vivos(pendentesPlaca.get(chave), agora), marca], agora)

  let resultado: T
  try {
    resultado = await executar(armado)
  } finally {
    const depois = relogio()
    pendentesGlobal = tirar(pendentesGlobal, marca)
    if (chave && pendentesPlaca.has(chave)) guardar(pendentesPlaca, chave, vivos(tirar(pendentesPlaca.get(chave) || [], marca), depois), depois)
  }

  const av = avaliar(resultado)
  if (!av.aceito && (av.palpite || (av.foraDoSistema && armadoReal))) registrarFalha(chave, h, limites, relogio())
  if (armado && !av.aceito) {
    log(`[cupom-limite] blocked ${onde} plate=${placaLog} reason=global_10min invalid=${nGlobal} limit=${limites.global10min}`)
    return { resultado: null, bloqueio: BLOQUEIO_GLOBAL }
  }
  return { resultado, bloqueio: null }
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
 * validarCupom behind the attempt limits. When refused, returns an invalid
 * coupon (full price) plus the block.
 */
export async function validarCupomComLimite(
  supabase: any,
  entrada: EntradaCupom,
  config: any,
  opts: Opcoes = {},
): Promise<ResultadoCupomLimitado> {
  const { resultado, bloqueio } = await comLimite<CupomValidado>(
    entrada, config, opts,
    (somenteDoSistema) => validarCupom(supabase, entrada.codigo, entrada.plano, entrada.email, entrada.braco, { somenteDoSistema }),
    (c) => ({
      aceito: cupomDoSistema(c),
      palpite: !!c && !c.ok && !!c.contaTentativa,
      foraDoSistema: !!c && (c.foraDoSistema === true || (c.ok && !cupomDoSistema(c))),
    }),
  )
  if (bloqueio || !resultado) {
    const plano = entrada.plano
    const bruto = plano === 'basica' || plano === 'completa' ? precoDoPlano(plano, entrada.braco) : 0
    const b = bloqueio || BLOQUEIO_GLOBAL
    return { cupom: { ok: false, motivo: b.message, precoBrutoCentavos: bruto, descontoCentavos: 0, precoLiquidoCentavos: bruto }, bloqueio: b }
  }
  return { cupom: resultado, bloqueio: null }
}

/**
 * "Does this typed code waive the e-mail?" (rebuy coupon) for the order
 * endpoints, behind the same limits: an unknown code counts as a guess, and
 * under a block the answer is false (the caller keeps its usual 400). One
 * lookup, whatever the code.
 */
export async function cupomDispensaEmailComLimite(
  supabase: any,
  entrada: { codigo: string; placa?: unknown },
  config: any,
  opts: Opcoes = {},
): Promise<boolean> {
  const codigo = normalizarCodigo(entrada.codigo)
  if (!codigo) return false
  const { resultado, bloqueio } = await comLimite<{ erro: boolean; existe: boolean; origem: string | null }>(
    entrada, config, opts,
    async () => {
      try {
        const { data, error } = await supabase.from('cupons_premium').select('origem').eq('codigo', codigo).maybeSingle()
        if (error) return { erro: true, existe: false, origem: null }
        return { erro: false, existe: !!data, origem: data?.origem ?? null }
      } catch {
        return { erro: true, existe: false, origem: null }
      }
    },
    (r) => ({
      aceito: r.origem === 'recompra',
      palpite: !r.erro && !r.existe,
      foraDoSistema: r.existe && r.origem !== 'recompra',
    }),
  )
  return !bloqueio && resultado?.origem === 'recompra'
}
