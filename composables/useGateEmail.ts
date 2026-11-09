// Lado do navegador do gate de e-mail da consulta gratis (ver
// server/utils/gate-email.ts, que e quem decide de verdade).
//
// - deviceId: UUID aleatorio gerado aqui e guardado no localStorage. Vai no
//   corpo do POST /api/consulta. Nao identifica a pessoa, so o navegador; no
//   app (WebView do Capacitor carregando o site) o localStorage e o do app.
// - tokensPagos: tokens dos relatorios do historico local (useConsultaHistory).
//   O servidor confere no banco se algum foi pago; o cliente nao decide nada.
// - Contador local: consultas gratis sem e-mail nas ultimas 24h. Na terceira,
//   o e-mail ja aparece obrigatorio antes de enviar, pra nao gastar um ida e
//   volta. Se o contador local errar, o servidor corrige (403 email_obrigatorio).
import type { ConsultaLocal } from './useConsultaHistory'

const KEY_DEVICE = 'pc_did'
const KEY_EMAIL = 'pc_email_gate'
const KEY_GRATIS = 'pc_gratis_sem_email'
const KEY_HIST = 'pc_consultas_v1'
const KEY_LIMITE = 'pc_gate_limite'
const LIMITE_VALIDADE_MS = 60 * 60 * 1000
export const GATE_LIMITE_LOCAL = 2
const JANELA_MS = 24 * 60 * 60 * 1000
const MAX_TOKENS = 12
// Status do historico local que ainda nao indicam pagamento.
const NAO_PAGO = new Set(['aguardando_pagamento', 'expirado', 'cancelado', 'estornado'])

export const GATE_EMAIL_CODE = 'email_obrigatorio'

function ls(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function novoUuid(): string {
  const c: any = typeof crypto !== 'undefined' ? crypto : null
  if (c?.randomUUID) return c.randomUUID()
  const b = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** UUID do navegador; cria na primeira chamada. Sem localStorage: null (servidor conta so pelo IP). */
export function deviceIdLocal(): string | null {
  const s = ls()
  if (!s) return null
  try {
    let id = s.getItem(KEY_DEVICE)
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      id = novoUuid()
      s.setItem(KEY_DEVICE, id)
    }
    return id
  } catch {
    return null
  }
}

function historico(): ConsultaLocal[] {
  try {
    const raw = ls()?.getItem(KEY_HIST)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** Tokens do historico local pro servidor conferir pagamento. */
export function tokensDoHistorico(): string[] {
  return historico().map((x) => x?.token).filter((t): t is string => typeof t === 'string' && !!t).slice(0, MAX_TOKENS)
}

/** Ha relatorio pago no historico deste aparelho (so pra UI; o servidor confere). */
export function temPagoLocal(): boolean {
  return historico().some((x) => x?.token && x.status && !NAO_PAGO.has(x.status))
}

export function emailGateSalvo(): string {
  try {
    return ls()?.getItem(KEY_EMAIL) || ''
  } catch {
    return ''
  }
}

export function salvarEmailGate(email: string) {
  try {
    ls()?.setItem(KEY_EMAIL, email.trim())
  } catch { /* modo privado */ }
}

function lerGratis(agora = Date.now()): number[] {
  try {
    const arr = JSON.parse(ls()?.getItem(KEY_GRATIS) || '[]')
    return Array.isArray(arr) ? arr.filter((t) => typeof t === 'number' && agora - t < JANELA_MS) : []
  } catch {
    return []
  }
}

/** Marca uma consulta gratis feita SEM e-mail (chamar no sucesso). */
export function registrarConsultaSemEmail(agora = Date.now()) {
  const arr = lerGratis(agora)
  arr.push(agora)
  try {
    ls()?.setItem(KEY_GRATIS, JSON.stringify(arr.slice(-20)))
  } catch { /* modo privado */ }
}

/**
 * Limite de consultas gratis sem e-mail que o servidor informou no ultimo 403
 * do gate (NUXT_CONSULTA_GRATIS_SEM_EMAIL; 0 = modo emergencia). Sem valor
 * guardado (ou vencido): 2, a regra permanente.
 */
export function limiteGateLocal(agora = Date.now()): number {
  try {
    // Guardado como {limite, em}; vale 1h pra um modo emergencia desligado
    // nao deixar o modal aparecendo pra sempre neste aparelho.
    const v = JSON.parse(ls()?.getItem(KEY_LIMITE) || 'null')
    const n = v?.limite
    if (!Number.isInteger(n) || n < 0 || !(agora - Number(v?.em) < LIMITE_VALIDADE_MS)) return GATE_LIMITE_LOCAL
    return n
  } catch {
    return GATE_LIMITE_LOCAL
  }
}

/** Mesmo parser do servidor: inteiro >= 0; qualquer outra coisa vira 2. */
export function parseLimiteGate(v: unknown): number {
  if (v === '' || v === null || v === undefined) return GATE_LIMITE_LOCAL
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  return Number.isInteger(n) && n >= 0 ? n : GATE_LIMITE_LOCAL
}

/**
 * Limite vigente (NUXT_CONSULTA_GRATIS_SEM_EMAIL) lido NO SERVIDOR durante o
 * SSR e entregue ao navegador pelo payload (useState). Assim a mesma env do
 * servidor vale pro client em runtime, sem segunda env NUXT_PUBLIC_ nem build.
 * Pagina que nao passou por SSR (cache/SPA): null, e vale o 403 do servidor.
 */
export function useLimiteGateEmail() {
  return useState<number | null>('pc-gate-limite', () =>
    import.meta.server ? parseLimiteGate((useRuntimeConfig() as any).consultaGratisSemEmail) : null,
  )
}

/**
 * Antecipa o gate: ja fez N gratis sem e-mail em 24h, nao tem e-mail salvo nem
 * pago local. N = o menor entre o limite da pagina (SSR) e o ultimo informado
 * pelo 403 do servidor; com 0 o modal abre ja na primeira consulta.
 */
export function deveExigirEmailLocal(agora = Date.now(), limitePagina?: number | null): boolean {
  if (emailGateSalvo()) return false
  if (temPagoLocal()) return false
  const limite = typeof limitePagina === 'number' && limitePagina >= 0
    ? Math.min(limitePagina, limiteGateLocal(agora))
    : limiteGateLocal(agora)
  return lerGratis(agora).length >= limite
}

/** Erro do $fetch e o 403 do gate? Guarda o limite que o servidor informou. */
export function ehErroGateEmail(err: any): boolean {
  const d = err?.data?.data ?? err?.data
  if (d?.code !== GATE_EMAIL_CODE) return false
  if (Number.isInteger(d?.limite) && d.limite >= 0) {
    try { ls()?.setItem(KEY_LIMITE, JSON.stringify({ limite: d.limite, em: Date.now() })) } catch { /* modo privado */ }
  }
  return true
}

/** Campos extras do corpo do POST /api/consulta. */
export function camposGateEmail(): { deviceId: string | null; tokensPagos: string[] } {
  return { deviceId: deviceIdLocal(), tokensPagos: tokensDoHistorico() }
}
