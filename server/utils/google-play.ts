import crypto from 'node:crypto'

// Compra da Consulta Completa feita DENTRO do app Android (Capacitor +
// Google Play Billing). A web continua no Pix; este arquivo existe so pro
// caminho da loja, onde a Google e quem cobra e quem guarda o comprovante.
//
// A unica prova que o app consegue mandar e o purchaseToken. Ele nao diz nada
// sozinho: quem diz se a compra existe, se foi paga e se ja foi consumida e a
// Google Play Developer API. Por isso nada e entregue antes de perguntar la.
//
// Autenticacao sem lib nova de proposito: e um JWT RS256 assinado com a chave
// da conta de servico e trocado por um access token. Sao trinta linhas contra
// uma dependencia inteira no bundle do servidor.

export const PACKAGE_NAME = 'br.com.placacompleta'
/** Unico produto vendido no app. Qualquer outro id e recusado. */
export const PRODUTO_COMPLETA = 'consulta_completa'
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher'

interface ServiceAccount {
  client_email: string
  private_key: string
  token_uri?: string
}

/**
 * Le a conta de servico do runtimeConfig. O JSON vai em base64 numa env
 * (NUXT_GOOGLE_PLAY_SERVICE_ACCOUNT) porque o JSON cru tem quebra de linha na
 * private_key e passar isso por env vira dor de cabeca em todo deploy.
 */
export function contaDeServico(): ServiceAccount {
  const c = useRuntimeConfig()
  const b64 = String((c as any).googlePlayServiceAccount || '')
  if (!b64) throw createError({ statusCode: 503, message: 'Google Play nao configurado.' })
  let parsed: any
  try {
    parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
  } catch {
    throw createError({ statusCode: 503, message: 'Google Play nao configurado.' })
  }
  if (!parsed?.client_email || !parsed?.private_key) {
    throw createError({ statusCode: 503, message: 'Google Play nao configurado.' })
  }
  return parsed as ServiceAccount
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url')
}

/** JWT RS256 de service account (fluxo "assertion" do OAuth2 do Google). */
export function montarAssertion(sa: ServiceAccount, agoraSeg = Math.floor(Date.now() / 1000)): string {
  const aud = sa.token_uri || 'https://oauth2.googleapis.com/token'
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: SCOPE,
    aud,
    iat: agoraSeg,
    exp: agoraSeg + 3600,
  }))
  const assinatura = crypto.createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(sa.private_key)
  return `${header}.${claims}.${base64url(assinatura)}`
}

// Access token dura uma hora; pedir um novo a cada compra seria uma chamada
// extra no caminho de quem esta esperando o relatorio.
let cacheToken: { token: string; expiraEm: number } | null = null

export async function accessToken(): Promise<string> {
  if (cacheToken && cacheToken.expiraEm > Date.now() + 60_000) return cacheToken.token
  const sa = contaDeServico()
  const r: any = await $fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: montarAssertion(sa),
    }).toString(),
  })
  if (!r?.access_token) throw createError({ statusCode: 502, message: 'Falha ao autenticar na Google Play.' })
  cacheToken = { token: r.access_token, expiraEm: Date.now() + (Number(r.expires_in || 3600) * 1000) }
  return r.access_token
}

/** So pra teste: derruba o access token guardado entre um caso e outro. */
export function _limparCacheToken() { cacheToken = null }

export type EstadoGoogle = 'pago' | 'pendente' | 'cancelada' | 'nao_encontrada' | 'indisponivel' | 'sem_estado'

export interface CompraGoogle {
  ok: boolean
  motivo: string | null
  /** Resumo do que a Google disse (vai pra google_play_compras.estado_google). */
  estado: EstadoGoogle
  orderId: string | null
  purchaseState: number | null
  consumptionState: number | null
  acknowledgementState: number | null
  productId: string | null
  /** Ja consumida (o app consome no celular em algumas versoes). */
  consumida: boolean
  /** purchaseType 0: compra de teste (conta de teste da Play), nao e venda. */
  teste: boolean
  /** obfuscatedExternalAccountId que o app mandou na compra (a placa, quando mandada). */
  contaExterna: string | null
}

/**
 * Traduz a resposta de purchases.products.get em "pode entregar ou nao".
 *
 * Funcao pura de proposito: e ela que decide se o relatorio sai, e um teste
 * dela vale mais que qualquer mock de rede. purchaseState 0 e "purchased"
 * (1 e cancelado, 2 e pendente).
 *
 * Compra consumida (consumptionState 1) AGORA e paga (18/out/2026, caso
 * BAN0G13): a versao do app na Play consome no celular antes de chamar o
 * servidor, e recusar ali era recusar uma venda paga. Nao ha reuso: quem
 * impede a mesma compra de virar dois pedidos e o purchaseToken unique em
 * pedidos_premium, nao o estado de consumo.
 */
export function interpretarCompra(raw: any, productId?: string): CompraGoogle {
  const base: CompraGoogle = {
    ok: false,
    motivo: null,
    estado: 'sem_estado',
    orderId: raw?.orderId ?? null,
    purchaseState: typeof raw?.purchaseState === 'number' ? raw.purchaseState : null,
    consumptionState: typeof raw?.consumptionState === 'number' ? raw.consumptionState : null,
    acknowledgementState: typeof raw?.acknowledgementState === 'number' ? raw.acknowledgementState : null,
    productId: raw?.productId ?? productId ?? null,
    consumida: raw?.consumptionState === 1,
    teste: raw?.purchaseType === 0,
    contaExterna: typeof raw?.obfuscatedExternalAccountId === 'string' && raw.obfuscatedExternalAccountId ? raw.obfuscatedExternalAccountId : null,
  }
  if (!raw || typeof raw !== 'object') return { ...base, motivo: 'resposta vazia da Google' }
  if (base.purchaseState === null) return { ...base, motivo: 'compra sem estado' }
  if (base.purchaseState === 2) return { ...base, estado: 'pendente', motivo: 'pagamento pendente' }
  if (base.purchaseState !== 0) return { ...base, estado: 'cancelada', motivo: 'compra cancelada' }
  return { ...base, estado: 'pago', ok: true }
}

const ANDROIDPUBLISHER = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`

/** purchases.products.get: pergunta pra Google o que aconteceu com o token. */
export async function consultarCompra(productId: string, purchaseToken: string): Promise<CompraGoogle> {
  try {
    const token = await accessToken()
    const url = `${ANDROIDPUBLISHER}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`
    const raw = await $fetch(url, { headers: { authorization: `Bearer ${token}` } })
    return interpretarCompra(raw, productId)
  } catch (e: any) {
    // 404 da Google = token que nunca existiu (ou que ainda nao propagou, logo
    // depois da compra). Tudo mais e indisponibilidade dela.
    const naoAchou = e?.response?.status === 404
    return {
      ok: false,
      motivo: naoAchou ? 'compra nao encontrada' : 'nao conseguimos confirmar a compra agora',
      estado: naoAchou ? 'nao_encontrada' : 'indisponivel',
      orderId: null, purchaseState: null, consumptionState: null, acknowledgementState: null, productId,
      consumida: false, teste: false, contaExterna: null,
    }
  }
}

export interface PedidoGoogle {
  /** O que o cliente pagou (total do pedido na Play, com imposto), em centavos de BRL. */
  valorCentavos: number | null
  /** O que fica pra nos depois da taxa da Google (developerRevenueInBuyerCurrency). */
  liquidoCentavos: number | null
  /** PROCESSED, PENDING, CANCELED, REFUNDED... */
  estado: string | null
}

/** Money do Google ({currencyCode, units, nanos}) em centavos; so BRL. */
export function moneyParaCentavos(m: any): number | null {
  if (!m || m.currencyCode !== 'BRL') return null
  const units = Number(m.units ?? 0)
  const nanos = Number(m.nanos ?? 0)
  if (!Number.isFinite(units) || !Number.isFinite(nanos)) return null
  if (m.units === undefined && m.nanos === undefined) return null
  return Math.round(units * 100 + nanos / 1e7)
}

export function interpretarPedidoGoogle(raw: any): PedidoGoogle {
  return {
    valorCentavos: moneyParaCentavos(raw?.total),
    liquidoCentavos: moneyParaCentavos(raw?.developerRevenueInBuyerCurrency),
    estado: typeof raw?.state === 'string' ? raw.state : null,
  }
}

/**
 * orders.get: o preco que a Play cobrou de verdade (R$ 39,99 hoje, nao os
 * R$ 39,90 do site) e o liquido. Fail-open: sem resposta, null, e quem chama
 * usa o preco padrao da Play.
 */
export async function consultarPedidoGoogle(orderId: string): Promise<PedidoGoogle | null> {
  try {
    const token = await accessToken()
    const raw = await $fetch(`${ANDROIDPUBLISHER}/orders/${encodeURIComponent(orderId)}`, { headers: { authorization: `Bearer ${token}` } })
    return interpretarPedidoGoogle(raw)
  } catch {
    return null
  }
}

/**
 * Consome a compra DEPOIS da entrega, pra pessoa poder comprar de novo (o
 * produto e consumivel). Fail-open: se falhar, o relatorio ja foi entregue e
 * o que se perde e a recompra imediata, nao a venda.
 */
export async function consumirCompra(productId: string, purchaseToken: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const token = await accessToken()
    await $fetch(`${ANDROIDPUBLISHER}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:consume`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    return { ok: true, error: null }
  } catch (e: any) {
    return { ok: false, error: String(e?.data?.error?.message || e?.message || e) }
  }
}
