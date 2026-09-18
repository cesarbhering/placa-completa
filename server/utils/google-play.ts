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

export interface CompraGoogle {
  ok: boolean
  motivo: string | null
  orderId: string | null
  purchaseState: number | null
  consumptionState: number | null
  acknowledgementState: number | null
  productId: string | null
}

/**
 * Traduz a resposta de purchases.products.get em "pode entregar ou nao".
 *
 * Funcao pura de proposito: e ela que decide se o relatorio sai, e um teste
 * dela vale mais que qualquer mock de rede. purchaseState 0 e "purchased"
 * (1 e cancelado, 2 e pendente) e consumptionState 0 e "ainda nao consumido".
 * Uma compra ja consumida significa que aquele token ja virou relatorio.
 */
export function interpretarCompra(raw: any, productId?: string): CompraGoogle {
  const base: CompraGoogle = {
    ok: false,
    motivo: null,
    orderId: raw?.orderId ?? null,
    purchaseState: typeof raw?.purchaseState === 'number' ? raw.purchaseState : null,
    consumptionState: typeof raw?.consumptionState === 'number' ? raw.consumptionState : null,
    acknowledgementState: typeof raw?.acknowledgementState === 'number' ? raw.acknowledgementState : null,
    productId: raw?.productId ?? productId ?? null,
  }
  if (!raw || typeof raw !== 'object') return { ...base, motivo: 'resposta vazia da Google' }
  if (base.purchaseState === null) return { ...base, motivo: 'compra sem estado' }
  if (base.purchaseState === 2) return { ...base, motivo: 'pagamento pendente' }
  if (base.purchaseState !== 0) return { ...base, motivo: 'compra cancelada' }
  if (base.consumptionState === 1) return { ...base, motivo: 'compra ja utilizada' }
  return { ...base, ok: true }
}

/** purchases.products.get: pergunta pra Google o que aconteceu com o token. */
export async function consultarCompra(productId: string, purchaseToken: string): Promise<CompraGoogle> {
  const token = await accessToken()
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`
  try {
    const raw = await $fetch(url, { headers: { authorization: `Bearer ${token}` } })
    return interpretarCompra(raw, productId)
  } catch (e: any) {
    // 404 da Google = token que nunca existiu. Tudo mais e indisponibilidade
    // dela, e nos dois casos a resposta pra quem chamou e a mesma: nao entrega.
    return {
      ok: false,
      motivo: e?.response?.status === 404 ? 'compra nao encontrada' : 'nao conseguimos confirmar a compra agora',
      orderId: null, purchaseState: null, consumptionState: null, acknowledgementState: null, productId,
    }
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
    await $fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:consume`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    return { ok: true, error: null }
  } catch (e: any) {
    return { ok: false, error: String(e?.data?.error?.message || e?.message || e) }
  }
}
