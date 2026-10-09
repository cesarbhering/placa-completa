import { createHash } from 'node:crypto'
import { PLANOS, isPlanoPago } from '../../shared/planos'

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
}

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
  if (!(Number(p.valor_centavos) > 0)) return 'valor_zero'
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

/** A venda veio do ChatGPT Ads? (oppref do clique ou utm_source=chatgpt_ads) */
export function origemChatgpt(p: Pick<PedidoCapi, 'oppref' | 'utm_source'>): boolean {
  return !!String(p.oppref || '').trim() || String(p.utm_source || '').trim().toLowerCase() === 'chatgpt_ads'
}

export function montarEvento(p: PedidoCapi) {
  const plano = isPlanoPago(p.plano) ? p.plano : 'completa'
  const valor = Math.round(Number(p.valor_centavos))
  const hash = emailSha256(p.email)
  const user: Record<string, unknown> = { countries: ['BR'] }
  if (hash) user.emails_sha256 = [hash]
  if (p.obref) user.obref = p.obref
  if (p.ip_address) user.ip_address = p.ip_address
  const ev: Record<string, unknown> = {
    id: p.token_entrega,
    type: 'order_created',
    timestamp_ms: Date.parse(p.pago_em as string),
    action_source: 'web',
    source_url: `https://placacompleta.com.br/premium/${p.token_entrega}`,
    user,
    data: {
      type: 'contents',
      amount: valor,
      currency: 'BRL',
      contents: [{ id: `plano-${plano}`, name: PLANOS[plano].nome, content_type: 'product', quantity: 1, amount: valor, currency: 'BRL' }],
    },
  }
  if (p.oppref) ev.oppref = p.oppref
  return ev
}

export function montarLote(pedidos: PedidoCapi[], validateOnly: boolean) {
  return { integration_source: INTEGRATION_SOURCE, validate_only: validateOnly, events: pedidos.map(montarEvento) }
}
