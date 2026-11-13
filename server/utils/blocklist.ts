// Blocklist de contencao pontual: IPs e e-mails de abuso JA CONFIRMADO.
//
// Vive aqui, e nao dentro de um endpoint, porque as duas rotas que gastam
// credito da fonte paga precisam da MESMA lista. Enquanto ela morava so no
// /api/consulta, quem estava bloqueado ali continuava consultando pelo
// /api/premium/preview, que bate na mesma API e no mesmo bolso.
//
// Escala pra abuso especifico; o teto por IP (ip-wdapi-limit) e a contencao
// geral, que vale pra todo mundo.

import { normalizarPlaca, placaEquivalente } from '../../shared/placa-formato'
import { getClientIp } from './client-ip'
import { useSupabaseServer } from './supabase'

const IP_BLOQUEADOS = new Set<string>([
  '177.44.134.147',
  // Enumeracao de 386 placas pelo app, com a imagem antiga que ainda nao
  // tinha o teto por IP (05/set).
  '177.121.153.13',
  '177.33.86.180',
])

// E-mails bloqueados vem do ambiente (NUXT_BLOCKLIST_EMAILS, separados por
// virgula), nunca do codigo: o repositorio e publico. Default vazio.
let emailsCache: { bruto: string; set: Set<string> } | null = null
function emailsBloqueados(): Set<string> {
  const bruto = String(process.env.NUXT_BLOCKLIST_EMAILS || '')
  if (emailsCache?.bruto !== bruto) {
    emailsCache = {
      bruto,
      set: new Set(bruto.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)),
    }
  }
  return emailsCache.set
}

/** true quando o IP ou o e-mail esta na blocklist. E-mail entra normalizado. */
export function estaBloqueado(ip?: string | null, email?: string | null): boolean {
  const ipLimpo = String(ip || '').trim()
  const emailLimpo = String(email || '').trim().toLowerCase()
  if (ipLimpo && IP_BLOQUEADOS.has(ipLimpo)) return true
  if (emailLimpo && emailsBloqueados().has(emailLimpo)) return true
  return false
}

// Placas bloqueadas a pedido do proprietario (NUXT_BLOCKLIST_PLACAS, separadas
// por virgula). Tambem vem do ambiente: o repositorio e publico e placa e dado
// do veiculo de alguem. Casa nos dois formatos (antiga e Mercosul), porque a
// consulta gratis devolve a alternativa e a pessoa tentaria por ela.
let placasCache: { bruto: string; set: Set<string> } | null = null
function placasBloqueadas(): Set<string> {
  const bruto = String(process.env.NUXT_BLOCKLIST_PLACAS || '')
  if (placasCache?.bruto !== bruto) {
    const set = new Set<string>()
    for (const item of bruto.split(',')) {
      const p = normalizarPlaca(item)
      if (!p) continue
      set.add(p)
      const eq = placaEquivalente(p)
      if (eq) set.add(eq)
    }
    placasCache = { bruto, set }
  }
  return placasCache.set
}

/** Texto que o cliente ve (gratis e pago) quando a placa esta bloqueada. */
export const MENSAGEM_PLACA_BLOQUEADA =
  'A pedido do proprietário, a consulta desta placa está bloqueada em nossa base.'

/** true quando a placa (em qualquer formato) esta bloqueada a pedido do dono. */
export function placaBloqueada(placa?: string | null): boolean {
  const p = normalizarPlaca(placa)
  if (!p) return false
  return placasBloqueadas().has(p)
}

/** Registra a tentativa em blocked_requests (reason 'placa_bloqueada'). Nunca lanca. */
function registrarPlacaBloqueada(event: any, placa: string, email?: string | null): void {
  let ip: string | null = null
  let ua: string | null = null
  try { ip = getClientIp(event) } catch { /* sem IP: registra mesmo assim */ }
  try { ua = event?.node?.req?.headers?.['user-agent'] || null } catch { /* idem */ }
  try {
    useSupabaseServer().from('blocked_requests').insert({
      reason: 'placa_bloqueada',
      ip_address: ip,
      recipient: email ? String(email).slice(0, 200) : null,
      placa: normalizarPlaca(placa).slice(0, 7) || null,
      user_agent: (ua || 'vazio').slice(0, 300),
    }).then(({ error }: any) => { if (error) console.warn('[blocked_requests] insert falhou:', error.message) })
  } catch (e: any) { console.warn('[blocked_requests] insert falhou:', e?.message) }
}

/**
 * Barra a rota: registra em blocked_requests (reason 'placa_bloqueada') e
 * lanca 403 com a mensagem ao cliente. Chamar ANTES de qualquer fonte paga.
 * So toca em Supabase/IP quando a placa esta mesmo bloqueada, pra nao
 * exigir nada do ambiente no caminho normal (nem nos testes das rotas).
 */
export function barrarPlacaBloqueada(event: any, placa: string, email?: string | null): void {
  if (!placaBloqueada(placa)) return
  registrarPlacaBloqueada(event, placa, email)
  throw createError({ statusCode: 403, message: MENSAGEM_PLACA_BLOQUEADA })
}

/**
 * Para rota que responde "sem sinal" em vez de erro (sinais de leilao e de
 * recall): true quando a placa esta bloqueada, ja com a tentativa registrada.
 * Quem chama devolve a mesma resposta de "nao sabemos". Nunca lanca.
 */
export function placaBloqueadaComRegistro(event: any, placa: string): boolean {
  if (!placaBloqueada(placa)) return false
  registrarPlacaBloqueada(event, placa)
  return true
}
