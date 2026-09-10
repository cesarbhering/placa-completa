import crypto from 'node:crypto'
import { renderSVG } from 'uqr'
import type { PixCharge, CriarPixOpts } from './pix-provider'

// Integracao Woovi (OpenPix). Campos conferidos na doc oficial em 10/set/2026:
//   criar:  POST /api/v1/charge {correlationID, value, comment?, expiresIn?}
//           -> {charge: {identifier, brCode, qrCodeImage, status, expiresDate}, brCode}
//   status: GET  /api/v1/charge/{id}
//   estorno:POST /api/v1/charge/{correlationID}/refund {correlationID, value?, comment?}
//   webhook: header x-webhook-signature, RSA-SHA256 base64 sobre o corpo cru,
//            conferido com a chave publica da Woovi.
//
// Autenticacao: o AppID vai CRU no header Authorization, sem "Bearer". Isso
// nao e descuido de copia: a doc pede exatamente assim.

function cfg() {
  const c = useRuntimeConfig()
  const appId = String(c.wooviAppId || '')
  if (!appId) throw createError({ statusCode: 503, message: 'Woovi nao configurada.' })
  return { base: String(c.wooviBase || 'https://api.woovi.com').replace(/\/+$/, ''), appId }
}

function headers() {
  const { appId } = cfg()
  return { Authorization: appId, 'Content-Type': 'application/json', Accept: 'application/json' }
}

/**
 * A Woovi devolve o QR como URL de imagem no dominio dela; a AbacatePay devolve
 * data URI. O checkout mostra os dois no mesmo <img>, e o CSP do site so
 * permite imagem do proprio dominio e data URI, entao a URL da Woovi seria
 * bloqueada pelo navegador.
 *
 * Em vez de abrir o CSP pra um dominio de terceiro no meio do checkout, o QR e
 * desenhado aqui a partir do copia e cola, que e a fonte da verdade do
 * pagamento (uqr ja e dependencia do projeto, usada no laudo). O que a pessoa
 * escaneia passa a ser exatamente o mesmo codigo que ela copiaria.
 */
export function qrComoDataUri(brCode: string): string {
  if (!brCode) return ''
  const svg = renderSVG(brCode, { border: 1 })
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

export async function criarPixTransparente(opts: CriarPixOpts): Promise<PixCharge> {
  const { base } = cfg()
  const res = await $fetch<any>(`${base}/api/v1/charge`, {
    method: 'POST',
    headers: headers(),
    body: {
      // correlationID e a nossa chave de idempotencia: o id do pedido. Repetir
      // a chamada com o mesmo pedido devolve a mesma cobranca, em vez de criar
      // outra e cobrar duas vezes.
      correlationID: opts.pedidoId,
      value: opts.amountCentavos,
      comment: (opts.descricao || 'Consulta Premium PlacaCompleta').slice(0, 140),
      expiresIn: opts.expiresIn ?? 900,
      ...(opts.customer?.email ? { customer: { email: opts.customer.email, name: opts.customer.name } } : {}),
    },
  })
  const charge = res?.charge || {}
  const brCode = String(charge.brCode || res?.brCode || '')
  if (!brCode) throw createError({ statusCode: 502, message: 'Woovi: resposta sem copia e cola' })
  return {
    // identifier e o id curto da cobranca; correlationID e o nosso. Guardamos
    // o identifier porque e ele que o GET de status aceita.
    id: String(charge.identifier || charge.correlationID || opts.pedidoId),
    amount: Number(charge.value) || opts.amountCentavos,
    status: String(charge.status || 'ACTIVE'),
    brCode,
    // O QR sai do copia e cola, nao da URL de imagem da Woovi (ver
    // qrComoDataUri): CSP do site nao carrega imagem de terceiro.
    brCodeBase64: qrComoDataUri(brCode),
    expiresAt: charge.expiresDate ? String(charge.expiresDate) : null,
  }
}

/** ACTIVE, COMPLETED, EXPIRED. O resto do sistema fala "pago"; a traducao e aqui. */
export function statusNormalizado(bruto: unknown): string {
  const s = String(bruto || '').toUpperCase()
  if (s === 'COMPLETED' || s === 'PAID') return 'PAID'
  if (s === 'EXPIRED') return 'EXPIRED'
  return 'PENDING'
}

export async function checarPix(
  id: string,
): Promise<{ status: string; brCode?: string; brCodeBase64?: string } | null> {
  const { base } = cfg()
  try {
    const res = await $fetch<any>(`${base}/api/v1/charge/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: headers(),
    })
    const charge = res?.charge || res
    if (!charge) return null
    return {
      status: statusNormalizado(charge.status),
      brCode: charge.brCode ? String(charge.brCode) : undefined,
      brCodeBase64: charge.brCode ? qrComoDataUri(String(charge.brCode)) : undefined,
    }
  } catch {
    return null
  }
}

export async function reembolsarPix(
  id: string,
  motivo = 'Consulta nao pode ser concluida apos pagamento.',
): Promise<{ ok: boolean; error: string | null }> {
  const { base } = cfg()
  try {
    await $fetch<any>(`${base}/api/v1/charge/${encodeURIComponent(id)}/refund`, {
      method: 'POST',
      headers: headers(),
      body: {
        // O correlationID AQUI e do estorno, nao da cobranca: e o que evita
        // estornar duas vezes se a chamada for repetida.
        correlationID: `refund-${id}`,
        comment: motivo.slice(0, 140),
      },
    })
    return { ok: true, error: null }
  } catch (e: any) {
    const msg = e?.data?.error || e?.data?.message || e?.message || 'erro desconhecido'
    console.warn('[reembolso woovi] falhou:', msg, '| charge=', id)
    return { ok: false, error: String(msg) }
  }
}

/**
 * A Woovi nao tem endpoint de "simular pagamento": o ambiente de teste
 * (app.woovi-sandbox.com) paga a cobranca de verdade, com Pix de mentira. Sem
 * endpoint, isto devolve false e o botao de simular do homolog fica sem efeito
 * nesse provedor, em vez de fingir que pagou.
 */
export async function simularPagamento(_id: string): Promise<boolean> {
  return false
}

// Chave publica da Woovi, usada pra conferir a assinatura do webhook. Buscada
// da API e guardada em memoria: a doc recomenda buscar em vez de fixar no
// codigo, porque ela pode ser trocada.
let chavesCache: { em: number; chaves: string[] } | null = null
const TTL_CHAVES = 6 * 60 * 60 * 1000

export async function chavesPublicas(): Promise<string[]> {
  const agora = Date.now()
  if (chavesCache && agora - chavesCache.em < TTL_CHAVES) return chavesCache.chaves
  const { base } = cfg()
  try {
    const res = await $fetch<any>(`${base}/api/v1/webhook/public-keys`, { headers: headers() })
    const brutas = Array.isArray(res?.publicKeys) ? res.publicKeys : Array.isArray(res) ? res : []
    const chaves = brutas
      .map((k: any) => String(k?.publicKey || k?.key || k || ''))
      .map((k: string) => (k.includes('BEGIN PUBLIC KEY') ? k : Buffer.from(k, 'base64').toString('ascii')))
      .filter((k: string) => k.includes('BEGIN PUBLIC KEY'))
    if (chaves.length) chavesCache = { em: agora, chaves }
    return chaves
  } catch (e: any) {
    console.warn('[woovi] nao consegui buscar as chaves publicas:', e?.message)
    return chavesCache?.chaves || []
  }
}

/**
 * Confere a assinatura do webhook. RSA-SHA256 sobre o corpo CRU, em base64, no
 * header x-webhook-signature.
 *
 * Diferenca em relacao ao que a gente tinha planejado: nao e HMAC com segredo
 * nosso. O HMAC existe na Woovi, mas no header X-OpenPix-Signature, com SHA1, e
 * a propria doc marca como obsoleto. Assinatura por chave publica prova que
 * quem mandou foi a Woovi, e nao alguem que descobriu o nosso segredo.
 */
export function verificarAssinatura(rawBody: string, assinatura: string, chaves: string[]): boolean {
  if (!assinatura || !chaves.length) return false
  for (const chave of chaves) {
    try {
      const v = crypto.createVerify('sha256')
      v.update(Buffer.from(rawBody))
      v.end()
      if (v.verify(chave, assinatura, 'base64')) return true
    } catch {
      // Chave malformada nao derruba a verificacao das outras.
    }
  }
  return false
}
