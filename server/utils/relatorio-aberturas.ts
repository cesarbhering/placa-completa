import { createHash } from 'node:crypto'
import { getClientIp } from './client-ip'
import { getDispositivo } from './dispositivo'
import { lookupIpGeo } from './ip-geo'

// Cada abertura do relatorio pago (Cesar, 24/out/2026: "quem abriu e de
// onde", caso PGB7E23). Uma linha por pedido + ip_hash + origem a cada 30 min,
// pra reload e polling nao inflarem. Fail-open e fora do caminho da resposta:
// registrar abertura nunca pode atrasar nem quebrar o relatorio.
// LGPD: token e IP nunca crus (token_hash = sha256 do token; ip_hash = mesmo
// esquema do eventos_funil, com sal do servidor). Tabela relatorio_aberturas.

export type OrigemAbertura = 'pagina' | 'pdf' | 'email_link' | 'preview'
export const JANELA_ABERTURA_MS = 30 * 60 * 1000
const STATUS_PAGO = new Set(['pago', 'consultando', 'entregue', 'reembolsado'])

// Preview de link (WhatsApp, Telegram...) e robos em geral: grava como
// 'preview', nao descarta (o preview tambem diz que o link foi compartilhado).
const RE_PREVIEW = /bot\b|bot\/|crawler|spider|preview|whatsapp|telegram|facebookexternalhit|facebot|slack|discord|skype|linkedin|twitterbot|embedly|quora link|pinterest|vkshare|google-?(inspectiontool|read-aloud)|headless|python-requests|curl\/|wget/i

export function origemDaAbertura(userAgent: string | null | undefined, pedida: unknown): OrigemAbertura {
  if (!userAgent || RE_PREVIEW.test(userAgent)) return 'preview'
  const o = String(pedida ?? '').toLowerCase()
  if (o === 'email') return 'email_link'
  if (o === 'pdf') return 'pdf'
  return 'pagina'
}

export const hashToken = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex')

/** Mesmo esquema do eventos_funil: sem sal, nao guarda hash nenhum. */
export function hashIp(ip: string | null | undefined, sal: string | null | undefined): string | null {
  if (!sal || !ip || ip === 'unknown') return null
  return createHash('sha256').update(sal + ip).digest('hex').slice(0, 32)
}

export interface PedidoAbertura { id: string; status: string; ip_address?: string | null }

/** Monta a linha (puro, testado). null = nao registra (pedido nao pago). */
export function linhaAbertura(p: {
  pedido: PedidoAbertura
  token: string
  ip: string | null
  sal: string | null | undefined
  userAgent: string | null | undefined
  origemPedida?: unknown
  dispositivo?: { dispositivo?: string | null; sistema?: string | null }
  geo?: { uf: string | null; city: string | null; country: string | null } | null
  agora?: number
}) {
  if (!STATUS_PAGO.has(String(p.pedido.status))) return null
  const ip = p.ip && p.ip !== 'unknown' ? p.ip : null
  return {
    pedido_id: p.pedido.id,
    token_hash: hashToken(p.token),
    aberto_em: new Date(p.agora ?? Date.now()).toISOString(),
    geo_uf: p.geo?.uf ?? null,
    geo_cidade: p.geo?.city ?? null,
    geo_pais: p.geo?.country ?? null,
    ip_hash: hashIp(ip, p.sal),
    dispositivo: p.dispositivo?.dispositivo ?? null,
    sistema: p.dispositivo?.sistema ?? null,
    mesmo_ip_da_compra: ip && p.pedido.ip_address ? ip === p.pedido.ip_address : null,
    origem: origemDaAbertura(p.userAgent, p.origemPedida),
  }
}

/**
 * Registra a abertura (dedupe de 30 min por pedido + ip_hash + origem). Nao
 * lanca nunca. Chamar sem await (ou dentro de emVoo): o relatorio nao espera.
 */
export async function registrarAbertura(supabase: any, event: any, pedido: PedidoAbertura, token: string, origemPedida?: unknown, agora = Date.now()): Promise<boolean> {
  try {
    const sal = useRuntimeConfig().funilIpSalt as string | undefined
    const ip = getClientIp(event)
    const base = linhaAbertura({
      pedido, token, ip, sal, origemPedida, agora,
      userAgent: getRequestHeader(event, 'user-agent'),
      dispositivo: getDispositivo(event),
    })
    if (!base) return false
    let q = supabase.from('relatorio_aberturas').select('id')
      .eq('pedido_id', pedido.id).eq('origem', base.origem)
      .gte('aberto_em', new Date(agora - JANELA_ABERTURA_MS).toISOString())
    q = base.ip_hash ? q.eq('ip_hash', base.ip_hash) : q.is('ip_hash', null)
    const { data: recente } = await q.limit(1)
    if (recente?.length) return false
    // Preview de robo nao gasta consulta de geo (o IP e do servidor do app).
    const geo = base.origem === 'preview' ? null : await lookupIpGeo(ip).catch(() => null)
    const { error } = await supabase.from('relatorio_aberturas').insert({
      ...base, geo_uf: geo?.uf ?? null, geo_cidade: geo?.city ?? null, geo_pais: geo?.country ?? null,
    })
    return !error
  } catch {
    return false
  }
}
