// Lado do navegador do gate de e-mail da consulta gratis (ver
// server/utils/gate-email.ts, que e quem decide de verdade).
//
// - deviceId: UUID aleatorio gerado aqui e guardado no localStorage. Vai no
//   corpo do POST /api/consulta. Nao identifica a pessoa, so o navegador; no
//   app (WebView do Capacitor carregando o site) o localStorage e o do app.
// - tokensPagos: tokens dos relatorios do historico local (useConsultaHistory).
//   O servidor confere no banco se algum foi pago; o cliente nao decide nada.
// - Contador local: consultas gratis sem e-mail nas ultimas 24h. So antecipa o
//   modal depois que o servidor ja respondeu 403 email_obrigatorio na ultima
//   hora (ver deveExigirEmailLocal); a primeira palavra e sempre do servidor.
import type { ConsultaLocal } from './useConsultaHistory'

const KEY_DEVICE = 'pc_did'
const KEY_EMAIL = 'pc_email_gate'
const KEY_GRATIS = 'pc_gratis_sem_email'
const KEY_HIST = 'pc_consultas_v1'
const KEY_LIMITE = 'pc_gate_limite'
const LIMITE_VALIDADE_MS = 60 * 60 * 1000
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
 * do gate (NUXT_CONSULTA_GRATIS_SEM_EMAIL; 0 = modo emergencia), valido por 1h.
 * Sem 403 recente: null, e o client nao barra nada sozinho.
 */
export function limiteGateLocal(agora = Date.now()): number | null {
  try {
    const v = JSON.parse(ls()?.getItem(KEY_LIMITE) || 'null')
    const n = v?.limite
    if (!Number.isInteger(n) || n < 0 || !(agora - Number(v?.em) < LIMITE_VALIDADE_MS)) return null
    return n
  } catch {
    return null
  }
}

/**
 * Antecipa o gate (abre o modal sem ir ao servidor) so quando o PROPRIO
 * servidor ja respondeu email_obrigatorio na ultima hora, a pessoa nao tem
 * e-mail salvo nem relatorio pago local, e a contagem local bate o limite que
 * ele informou.
 *
 * Nunca barra por conta propria antes disso, de proposito: com
 * NUXT_CONSULTA_GRATIS_SEM_EMAIL=0 a versao anterior abria o modal antes de
 * qualquer POST, e quem o servidor isenta (IP na whitelist, como a sonda de
 * checkout da VPS; quem pagou) nunca chegava a ser isento. Foi o que quebrou
 * a sonda em producao (#710, revertido no #711). A consulta sempre vai ao
 * servidor primeiro; o 403 do gate sai antes da wdapi, entao nao custa credito.
 */
export function deveExigirEmailLocal(agora = Date.now()): boolean {
  if (emailGateSalvo()) return false
  if (temPagoLocal()) return false
  const limite = limiteGateLocal(agora)
  if (limite === null) return false
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
