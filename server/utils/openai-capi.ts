import { createHash } from 'node:crypto'
import { dadosOrderCreated, valorDoEvento } from '../../shared/openai-evento'

export { valorDoEvento }

// OpenAI Ads (ChatGPT): Conversions API. Fonte da verdade da compra: o
// order_created so sai de pedido com pagamento CONFIRMADO, valor > 0 e de
// producao (mesma regra do #418). Funcoes puras aqui; o envio fica no worker
// server/plugins/openai-capi.ts, fora do fluxo de pagamento.

export const OPENAI_CAPI_URL = 'https://bzr.openai.com/v1/events'
export const INTEGRATION_SOURCE = 'placacompleta-nuxt'
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

export interface PedidoCapi {
  token_entrega: string
  status: string
  valor_centavos: number | null
  plano: string | null
  email: string | null
  pago_em: string | null
  ambiente: string | null
  ip_address: string | null
  google_play_order_id: string | null
  oppref: string | null
  obref: string | null
  utm_source?: string | null
  placa?: string | null
  /**
   * Clique no anuncio que veio ANTES, na consulta gratis da mesma placa (ver
   * toqueChatgptDaConsulta). Caso TST1A23 (23/out): consulta com oppref as
   * 21:27, a pessoa voltou por chatgpt.com e por link de WhatsApp, e o pedido
   * nasceu sem oppref.
   */
  toque_chatgpt?: ToqueChatgpt | null
}

export interface ToqueChatgpt { oppref: string | null; obref: string | null; created_at: string }

export interface ConsultaOrigem {
  placa: string | null
  created_at: string
  oppref: string | null
  obref?: string | null
  utm_source: string | null
}

/** Motivos de nao enviar que nunca viram conversao: os relatorios mostram "não se aplica". */
export const MOTIVOS_NAO_SE_APLICA = new Set(['app', 'teste'])

/** sha256 do e-mail normalizado (trim + minusculas), hex minusculo. */
export function emailSha256(email: string | null | undefined): string | null {
  const n = String(email || '').trim().toLowerCase()
  if (!n || !n.includes('@')) return null
  return createHash('sha256').update(n, 'utf8').digest('hex')
}

/**
 * Pode enviar? Pagamento confirmado e relatorio entregue (com pago_em), valor
 * maior que zero (cupom 100% nao conta), nao e compra do app (Google Play) e,
 * em producao, so pedido de producao (pedido de teste nunca vira conversao).
 * Em ambiente protegido (homolog/staging) o envio e validate_only.
 */
export function motivoParaNaoEnviar(p: PedidoCapi, opts: { agora: number; protegido: boolean }): string | null {
  // So ENTREGUE: pago e que ficou pago. 'consultando' espera o proximo ciclo
  // (se a consulta falhar, o Pix e estornado e nao pode virar conversao).
  if (p.status !== 'entregue') return 'nao_entregue'
  if (!p.pago_em) return 'sem_pago_em'
  // Cupom 100% CONTA (Cesar 15/out): a plataforma trouxe o cliente; o desconto
  // e decisao nossa. O valor vai cheio (preco do plano), ver valorDoEvento.
  if (p.google_play_order_id) return 'app'
  // So venda que VEIO do ChatGPT Ads (bug de 03 a 09/out: o worker mandava
  // toda venda, 42 eventos, nenhum com oppref, e o painel da OpenAI creditou
  // conversoes que nao vieram de la). Origem = oppref do clique no anuncio ou
  // utm_source=chatgpt_ads.
  if (!origemChatgpt(p)) return 'sem_origem_chatgpt'
  if (!opts.protegido && p.ambiente !== 'producao') return 'teste'
  const t = Date.parse(p.pago_em)
  if (!Number.isFinite(t) || opts.agora - t > SETE_DIAS_MS - 60 * 60 * 1000) return 'velho'
  return null
}

const ehChatgptAds = (src: unknown) => String(src || '').trim().toLowerCase() === 'chatgpt_ads'

/**
 * A venda veio do ChatGPT Ads? oppref do clique ou utm_source=chatgpt_ads no
 * pedido OU na consulta gratis da mesma placa antes do pagamento (toque_chatgpt).
 */
export function origemChatgpt(p: Pick<PedidoCapi, 'oppref' | 'utm_source' | 'toque_chatgpt'>): boolean {
  return !!String(p.oppref || '').trim() || ehChatgptAds(p.utm_source) || !!p.toque_chatgpt
}

/** O pedido sozinho ja diz que veio do ChatGPT (sem precisar da consulta)? */
export function origemChatgptNoPedido(p: Pick<PedidoCapi, 'oppref' | 'utm_source'>): boolean {
  return !!String(p.oppref || '').trim() || ehChatgptAds(p.utm_source)
}

/**
 * Clique no ChatGPT Ads numa consulta gratis da MESMA placa, ate 7 dias antes
 * do pagamento (mesma regra do e-mail pc-chatgpt-primeira-venda). Entre varias,
 * vale a mais recente com oppref (e o id que a OpenAI usa pra atribuir); sem
 * oppref, a mais recente com utm_source=chatgpt_ads.
 */
export function toqueChatgptDaConsulta(consultas: ConsultaOrigem[], placa: string | null | undefined, pagoEm: string | null | undefined): ToqueChatgpt | null {
  const pl = String(placa || '').toUpperCase().trim()
  const fim = Date.parse(String(pagoEm || ''))
  if (!pl || !Number.isFinite(fim)) return null
  const doClique = consultas
    .filter((c) => String(c.placa || '').toUpperCase().trim() === pl)
    .filter((c) => { const t = Date.parse(c.created_at); return Number.isFinite(t) && t <= fim && fim - t <= SETE_DIAS_MS })
    .filter((c) => !!String(c.oppref || '').trim() || ehChatgptAds(c.utm_source))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  const escolhida = doClique.find((c) => String(c.oppref || '').trim()) || doClique[0]
  return escolhida ? { oppref: String(escolhida.oppref || '').trim() || null, obref: escolhida.obref || null, created_at: escolhida.created_at } : null
}

export function montarEvento(p: PedidoCapi) {
  const hash = emailSha256(p.email)
  const user: Record<string, unknown> = { countries: ['BR'] }
  if (hash) user.emails_sha256 = [hash]
  // Sem oppref/obref no pedido, vai o do clique na consulta gratis (toque_chatgpt).
  const obref = p.obref || p.toque_chatgpt?.obref
  const oppref = String(p.oppref || '').trim() || p.toque_chatgpt?.oppref || null
  if (obref) user.obref = obref
  if (p.ip_address) user.ip_address = p.ip_address
  const ev: Record<string, unknown> = {
    id: p.token_entrega,
    type: 'order_created',
    timestamp_ms: Date.parse(p.pago_em as string),
    action_source: 'web',
    source_url: `https://placacompleta.com.br/premium/${p.token_entrega}`,
    user,
    // Mesmo bloco do pixel do navegador (shared/openai-evento.ts): dedupe pelo id.
    data: dadosOrderCreated(p.valor_centavos, p.plano),
  }
  if (oppref) ev.oppref = oppref
  return ev
}

export function montarLote(pedidos: PedidoCapi[], validateOnly: boolean) {
  return { integration_source: INTEGRATION_SOURCE, validate_only: validateOnly, events: pedidos.map(montarEvento) }
}
