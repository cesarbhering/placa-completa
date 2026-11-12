import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'

// Parceiros que veem o chassi completo na consulta gratis (Cesar, 12/nov/2026).
//
// Entrada: o parceiro pede um link em /parceiro; se o e-mail estiver na tabela
// e ativo, vai um link de uso unico (30 min) e, no mesmo e-mail, um codigo de 8
// caracteres pra digitar dentro do app Android (a WebView do app nao divide
// cookie com o Chrome). Validado o link ou o codigo, o aparelho ganha um cookie
// assinado (HMAC) de 180 dias com o id do parceiro e do aparelho.
//
// Na consulta: cookie valido + parceiro ativo no banco (cache de 30 s) + menos
// de 20 consultas na ultima hora => chassi completo e sem gate/limite gratis.
// Passou de 20: volta a ser visitante comum ate a hora virar, sem erro.
// Tudo desligado sem NUXT_PARCEIRO_CHASSI=on.

export const PARCEIRO_COOKIE = 'pc_parceiro'
export const PARCEIRO_LIMITE_HORA = 20
export const PARCEIRO_TOKEN_TTL_MS = 30 * 60 * 1000
export const PARCEIRO_COOKIE_TTL_S = 180 * 24 * 60 * 60
export const PARCEIRO_MAX_TENTATIVAS = 5
const ATIVO_CACHE_MS = 30 * 1000
const VERSAO = 'v1'
// Sem 0/O/1/I/L: o codigo e digitado a mao no celular.
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

type Sb = { from: (t: string) => any }
type Config = { parceiroChassi?: string; parceiroChassiSecret?: string; premiumSupabaseKey?: string; funilIpSalt?: string }

export function parceiroLigado(config: Config | null | undefined): boolean {
  return String(config?.parceiroChassi || '').trim().toLowerCase() === 'on'
}

/** NUXT_PARCEIRO_CHASSI_SECRET; sem ele, derivado da service key (nunca vai pro navegador). */
export function segredoParceiro(config: Config): string {
  if (config.parceiroChassiSecret) return String(config.parceiroChassiSecret)
  if (config.premiumSupabaseKey) return createHmac('sha256', String(config.premiumSupabaseKey)).update('parceiro-chassi-v1').digest('hex')
  return ''
}

export function normalizarEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase()
}

export function hashSegredo(s: string): string {
  return createHash('sha256').update(String(s)).digest('hex')
}

export function normalizarCodigo(codigo: unknown): string {
  return String(codigo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function gerarCredenciais(): { token: string; codigo: string } {
  const token = randomBytes(32).toString('base64url')
  const bytes = randomBytes(8)
  let codigo = ''
  for (const b of bytes) codigo += ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]
  return { token, codigo }
}

// ---------- cookie ----------

function assinatura(segredo: string, corpo: string): string {
  return createHmac('sha256', segredo).update(corpo).digest('base64url')
}

export function assinarCookie(segredo: string, parceiroId: string, dispositivoId: string, emitidoEm: number): string {
  const corpo = `${VERSAO}.${parceiroId}.${dispositivoId}.${emitidoEm}`
  return `${corpo}.${assinatura(segredo, corpo)}`
}

export interface CookieParceiro { parceiroId: string; dispositivoId: string; emitidoEm: number }

export function lerCookie(segredo: string, valor: unknown, agora = Date.now()): CookieParceiro | null {
  if (!segredo || typeof valor !== 'string') return null
  const partes = valor.split('.')
  if (partes.length !== 5 || partes[0] !== VERSAO) return null
  const [, parceiroId, dispositivoId, emitidoStr, sig] = partes
  const corpo = partes.slice(0, 4).join('.')
  const esperado = Buffer.from(assinatura(segredo, corpo))
  const recebido = Buffer.from(sig)
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null
  const emitidoEm = Number(emitidoStr)
  if (!Number.isFinite(emitidoEm) || emitidoEm > agora + 60_000 || agora - emitidoEm > PARCEIRO_COOKIE_TTL_S * 1000) return null
  if (!/^[0-9a-f-]{36}$/i.test(parceiroId) || !/^[0-9a-f-]{36}$/i.test(dispositivoId)) return null
  return { parceiroId, dispositivoId, emitidoEm }
}

/** Cookie no dominio-mae: vale pra www, app. e o dominio raiz no mesmo navegador. */
export function dominioDoCookie(host: unknown): string | undefined {
  const h = String(host || '').toLowerCase().split(':')[0]
  return h === 'placacompleta.com.br' || h.endsWith('.placacompleta.com.br') ? 'placacompleta.com.br' : undefined
}

export function opcoesCookie(host: unknown) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: PARCEIRO_COOKIE_TTL_S,
    domain: dominioDoCookie(host),
  }
}

export function novoCookie(segredo: string, parceiroId: string, agora = Date.now()): string {
  return assinarCookie(segredo, parceiroId, randomUUID(), agora)
}

// ---------- banco ----------

const ativoCache = new Map<string, { ativo: boolean; em: number }>()
export function _zerarCacheParceiro() { ativoCache.clear() }

export async function parceiroAtivo(sb: Sb, parceiroId: string, agora = Date.now()): Promise<boolean> {
  const c = ativoCache.get(parceiroId)
  if (c && agora - c.em < ATIVO_CACHE_MS) return c.ativo
  try {
    const { data, error } = await sb.from('parceiros_chassi').select('ativo').eq('id', parceiroId).maybeSingle()
    if (error) return false
    const ativo = data?.ativo === true
    ativoCache.set(parceiroId, { ativo, em: agora })
    if (ativoCache.size > 1000) ativoCache.clear()
    return ativo
  } catch {
    return false
  }
}

export async function usoNaUltimaHora(sb: Sb, parceiroId: string, agora = Date.now()): Promise<number> {
  const { count, error } = await sb.from('parceiros_chassi_uso')
    .select('id', { count: 'exact', head: true })
    .eq('parceiro_id', parceiroId)
    .gte('criado_em', new Date(agora - 60 * 60 * 1000).toISOString())
  if (error) throw new Error(error.message)
  return Number(count ?? 0)
}

export interface DecisaoParceiro { parceiroId: string }

/**
 * A consulta gratis desta requisicao segue a regra de parceiro? Fail-closed:
 * qualquer duvida (flag, cookie, banco fora) = visitante comum. Quando sim,
 * ja registra o uso (conta pro limite de 20/h e fica na auditoria).
 */
export async function decidirParceiro(a: {
  config: Config
  cookie: unknown
  sb: Sb
  placa: string
  ip: string
  canal: string
  agora?: number
}): Promise<DecisaoParceiro | null> {
  if (!parceiroLigado(a.config)) return null
  const agora = a.agora ?? Date.now()
  const c = lerCookie(segredoParceiro(a.config), a.cookie, agora)
  if (!c) return null
  try {
    if (!(await parceiroAtivo(a.sb, c.parceiroId, agora))) return null
    if ((await usoNaUltimaHora(a.sb, c.parceiroId, agora)) >= PARCEIRO_LIMITE_HORA) return null
    const sal = String(a.config.funilIpSalt || '')
    const ipHash = sal && a.ip && a.ip !== 'unknown' ? createHash('sha256').update(sal + a.ip).digest('hex').slice(0, 32) : null
    const { error } = await a.sb.from('parceiros_chassi_uso').insert({
      parceiro_id: c.parceiroId, placa: a.placa, ip_hash: ipHash, canal: a.canal, criado_em: new Date(agora).toISOString(),
    })
    if (error) return null
    return { parceiroId: c.parceiroId }
  } catch {
    return null
  }
}

/**
 * Pedido de link. Nunca diz se o e-mail esta na lista: quem chama responde
 * sempre a mesma coisa. Devolve true so pra log/teste.
 */
export async function solicitarLink(
  sb: Sb,
  email: unknown,
  enviar: (para: string, credenciais: { token: string; codigo: string }) => Promise<void>,
  agora = Date.now(),
): Promise<boolean> {
  const alvo = normalizarEmail(email)
  if (!alvo || alvo.length > 254 || !alvo.includes('@')) return false
  try {
    const { data: p } = await sb.from('parceiros_chassi').select('id, ativo').eq('email_normalizado', alvo).maybeSingle()
    if (!p?.id || p.ativo !== true) return false
    const cred = gerarCredenciais()
    const { error } = await sb.from('parceiros_chassi_tokens').insert({
      hash: hashSegredo(cred.token),
      codigo_hash: hashSegredo(normalizarCodigo(cred.codigo)),
      parceiro_id: p.id,
      expira_em: new Date(agora + PARCEIRO_TOKEN_TTL_MS).toISOString(),
      tentativas: 0,
    })
    if (error) return false
    await enviar(alvo, cred)
    return true
  } catch (e: any) {
    console.warn('[parceiro] link nao enviado:', e?.message || e)
    return false
  }
}

/** Link: queima o token (uso unico, dentro da validade) e devolve o parceiro, se ativo. */
export async function entrarComToken(sb: Sb, token: unknown, agora = Date.now()): Promise<string | null> {
  const t = String(token ?? '')
  if (t.length < 20 || t.length > 100) return null
  try {
    const { data } = await sb.from('parceiros_chassi_tokens')
      .update({ usado_em: new Date(agora).toISOString() })
      .eq('hash', hashSegredo(t))
      .is('usado_em', null)
      .gt('expira_em', new Date(agora).toISOString())
      .lt('tentativas', PARCEIRO_MAX_TENTATIVAS)
      .select('parceiro_id')
    const pid = Array.isArray(data) ? data[0]?.parceiro_id : null
    if (!pid) return null
    return (await parceiroAtivo(sb, pid, agora)) ? pid : null
  } catch {
    return null
  }
}

/**
 * Codigo digitado (app): e-mail + codigo. Errou: conta tentativa em todos os
 * codigos vivos do parceiro; 5 erros e eles morrem (precisa pedir outro).
 */
export async function entrarComCodigo(sb: Sb, email: unknown, codigo: unknown, agora = Date.now()): Promise<string | null> {
  const alvo = normalizarEmail(email)
  const cod = normalizarCodigo(codigo)
  if (!alvo || cod.length !== 8) return null
  try {
    const { data: p } = await sb.from('parceiros_chassi').select('id, ativo').eq('email_normalizado', alvo).maybeSingle()
    if (!p?.id || p.ativo !== true) return null
    const agoraIso = new Date(agora).toISOString()
    const { data: vivos } = await sb.from('parceiros_chassi_tokens')
      .select('hash, codigo_hash, tentativas')
      .eq('parceiro_id', p.id)
      .is('usado_em', null)
      .gt('expira_em', agoraIso)
      .lt('tentativas', PARCEIRO_MAX_TENTATIVAS)
    const lista = Array.isArray(vivos) ? vivos : []
    const alvoHash = hashSegredo(cod)
    const certo = lista.find((v: any) => v.codigo_hash === alvoHash)
    if (!certo) {
      for (const v of lista) {
        await sb.from('parceiros_chassi_tokens').update({ tentativas: Number(v.tentativas || 0) + 1 }).eq('hash', v.hash)
      }
      return null
    }
    const { data } = await sb.from('parceiros_chassi_tokens')
      .update({ usado_em: agoraIso })
      .eq('hash', certo.hash)
      .is('usado_em', null)
      .select('parceiro_id')
    const pid = Array.isArray(data) ? data[0]?.parceiro_id : null
    return pid && (await parceiroAtivo(sb, pid, agora)) ? pid : null
  } catch {
    return null
  }
}

// ---------- chassi na resposta ----------

/**
 * Chassi que o parceiro ve: o inteiro do extra (PlacaFipe) quando veio com 17
 * caracteres; senao o que a fonte mandou na raiz (a WDAPI as vezes manda
 * parcial). Nunca inventa.
 */
export function chassiDoParceiro(apiResponse: any): string | null {
  const extra = String(apiResponse?.extra?.chassi || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (extra.length === 17) return extra
  const raiz = typeof apiResponse?.chassi === 'string' ? apiResponse.chassi.trim().toUpperCase() : ''
  if (raiz) return raiz
  return extra || null
}
