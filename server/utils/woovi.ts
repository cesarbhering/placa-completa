import crypto from 'node:crypto'
import { renderSVG } from 'uqr'
import type { PixCharge, CriarPixOpts } from './pix-provider'
import { consultaQueFalhou, type ConsultaPix } from './pix-consulta'

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
      correlationID: opts.correlacao || opts.pedidoId,
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

/**
 * Looks a charge up by its id and tells "the charge does not exist in our
 * account" from "Woovi did not answer" (see pix-consulta.ts). Throws when
 * Woovi is not configured, like checarPix.
 */
export async function consultarPix(id: string): Promise<ConsultaPix<{ status: string; brCode?: string; brCodeBase64?: string }>> {
  const { base } = cfg()
  try {
    const res = await $fetch<any>(`${base}/api/v1/charge/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: headers(),
    })
    const charge = cobrancaDaResposta(res)
    if (!charge) return { situacao: 'sem_resposta' }
    return {
      situacao: 'encontrada',
      cobranca: {
        status: statusNormalizado(charge.status),
        brCode: charge.brCode ? String(charge.brCode) : undefined,
        brCodeBase64: charge.brCode ? qrComoDataUri(String(charge.brCode)) : undefined,
      },
    }
  } catch (e) {
    return consultaQueFalhou(e)
  }
}

/**
 * The charge inside a successful answer, or null when the answer does not
 * carry one in the expected shape (an empty object, an error envelope, a
 * string, a charge without a status). Such an answer says nothing about the
 * charge: it is not "pending" and it is not "does not exist".
 */
function cobrancaDaResposta(res: any): any | null {
  if (!res || typeof res !== 'object') return null
  const charge = res.charge && typeof res.charge === 'object' ? res.charge : res
  return typeof charge.status === 'string' && charge.status ? charge : null
}

/** Status of the charge; null when it does not exist or Woovi did not answer. */
export async function checarPix(
  id: string,
): Promise<{ status: string; brCode?: string; brCodeBase64?: string } | null> {
  const consulta = await consultarPix(id)
  return consulta.situacao === 'encontrada' ? consulta.cobranca : null
}

/**
 * Looks a charge up by its correlationID (the GET accepts it in place of the
 * id) and tells "no such charge in our account" from "Woovi did not answer".
 * The charge comes with the correlationID Woovi has on record for it, so the
 * caller can tie it to an order. Never throws: Woovi not configured is "did
 * not answer".
 */
export async function consultarCobrancaPorCorrelacao(
  correlationID: string,
): Promise<ConsultaPix<{ status: string; identifier: string; correlationID: string | null }>> {
  try {
    const { base } = cfg()
    const res = await $fetch<any>(`${base}/api/v1/charge/${encodeURIComponent(correlationID)}`, { method: 'GET', headers: headers() })
    const charge = cobrancaDaResposta(res)
    if (!charge || typeof charge.identifier !== 'string' || !charge.identifier) return { situacao: 'sem_resposta' }
    return {
      situacao: 'encontrada',
      cobranca: {
        status: statusNormalizado(charge.status),
        identifier: charge.identifier,
        correlationID: typeof charge.correlationID === 'string' && charge.correlationID ? charge.correlationID : null,
      },
    }
  } catch (e) {
    return consultaQueFalhou(e)
  }
}

/**
 * Cobranca da Woovi pelo correlationID (o GET aceita o correlationID no lugar
 * do id). Rede de seguranca do status: a cobranca ORIGINAL de todo pedido Pix
 * nasce com correlationID = pedido.id, entao da pra achar um pagamento mesmo
 * quando o pedido ficou apontando pra outra cobranca (renovacao que caiu no
 * salva-vidas, caso RBF5A06). Null em erro, 404 ou Woovi nao configurada.
 */
export async function cobrancaPorCorrelacao(correlationID: string): Promise<{ status: string; identifier: string } | null> {
  const consulta = await consultarCobrancaPorCorrelacao(correlationID)
  return consulta.situacao === 'encontrada' ? { status: consulta.cobranca.status, identifier: consulta.cobranca.identifier } : null
}

/**
 * correlationID -> id do pedido. Renovacao usa `<pedido>-r<sufixo>`; o id do
 * pedido e um UUID (hex), que nunca contem "-r".
 */
export function pedidoDaCorrelacao(correlationID: unknown): string {
  return String(correlationID || '').replace(/-r[0-9a-z]+$/, '')
}

/** Chaves do GET /webhook/public-keys: hoje `public_keys[].key` (snake_case). */
export function extrairChavesPublicas(res: any): string[] {
  const brutas = Array.isArray(res?.public_keys) ? res.public_keys
    : Array.isArray(res?.publicKeys) ? res.publicKeys
      : Array.isArray(res) ? res : []
  return brutas
    .map((k: any) => String(k?.key || k?.publicKey || (typeof k === 'string' ? k : '') || ''))
    .map((k: string) => (k.includes('BEGIN PUBLIC KEY') ? k : Buffer.from(k, 'base64').toString('ascii')))
    .filter((k: string) => k.includes('BEGIN PUBLIC KEY'))
}

/**
 * CPF/CNPJ de quem PAGOU a cobranca (payer.taxID), so pra virar hash em
 * server/utils/pagador-hash.ts. Nao loga, nao guarda; null em qualquer erro.
 */
export async function pagadorDaCobrancaWoovi(id: string): Promise<{ documento: string | null; nome: string | null }> {
  const { base } = cfg()
  try {
    const res = await $fetch<any>(`${base}/api/v1/charge/${encodeURIComponent(id)}`, { method: 'GET', headers: headers() })
    const payer = (res?.charge || res)?.payer
    const doc = payer?.taxID?.taxID
    const nome = payer?.name
    return { documento: typeof doc === 'string' ? doc : null, nome: typeof nome === 'string' ? nome : null }
  } catch {
    return { documento: null, nome: null }
  }
}

export async function documentoDoPagadorWoovi(id: string): Promise<string | null> {
  return (await pagadorDaCobrancaWoovi(id)).documento
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
 * Paga a cobranca no ambiente de TESTE: GET /openpix/testing?transactionID=...
 * (doc: test-environment/test-account/test-pay-pix). So funciona com AppID de
 * sandbox; com credencial de producao a Woovi recusa, que e o comportamento
 * desejado, porque simular pagamento em producao seria liberar relatorio sem
 * dinheiro entrar.
 *
 * Recebe o identifier da cobranca, que e o mesmo id que guardamos no pedido.
 */
export async function simularPagamento(id: string): Promise<boolean> {
  const { base } = cfg()
  try {
    await $fetch<any>(`${base}/openpix/testing`, {
      method: 'GET',
      headers: headers(),
      query: { transactionID: id },
    })
    return true
  } catch (e: any) {
    console.warn('[woovi] simular pagamento falhou:', e?.data?.message || e?.message)
    return false
  }
}

// Woovi's public key, used to check the webhook signature. Two sources:
// the public-keys endpoint of the API (kept in memory) and the key published
// in the provider's developer documentation, which is always part of the
// list. The signature check therefore keeps working when the endpoint cannot
// be reached. More keys can be given in NUXT_WOOVI_CHAVE_PUBLICA (PEM or
// base64 of the PEM, comma separated) if the provider ever rotates the key.
export const CHAVE_PUBLICA_WOOVI_DOCUMENTADA = [
  '-----BEGIN PUBLIC KEY-----',
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC/+NtIkjzevvqD+I3MMv3bLXDt',
  'pvxBjY4BsRrSdca3rtAwMcRYYvxSnd7jagVLpctMiOxQO8ieUCKLSWHpsMAjO/zZ',
  'WMKbqoG8MNpi/u3fp6zz0mcHCOSqYsPUUG19buW8bis5ZZ2IZgBObWSpTvJ0cnj6',
  'HKBAA82Jln+lGwS1MwIDAQAB',
  '-----END PUBLIC KEY-----',
].join('\n')

let chavesCache: { em: number; chaves: string[] } | null = null
let falhaEm = 0
const TTL_CHAVES = 6 * 60 * 60 * 1000
// After a failed lookup the endpoint is not asked again on every webhook.
const TTL_FALHA = 5 * 60 * 1000

/** Test helper. */
export function _zerarChavesWoovi(): void {
  chavesCache = null
  falhaEm = 0
}

function paraPem(k: string): string {
  return k.includes('BEGIN PUBLIC KEY') ? k : Buffer.from(k, 'base64').toString('ascii')
}

/** Keys that do not depend on the endpoint: the configured ones and the documented one. */
function chavesFixas(): string[] {
  const c = useRuntimeConfig() as any
  const configuradas = String(c?.wooviChavePublica || '')
    .split(',').map((k) => k.trim()).filter(Boolean)
    .map(paraPem).filter((k) => k.includes('BEGIN PUBLIC KEY'))
  return [...configuradas, CHAVE_PUBLICA_WOOVI_DOCUMENTADA]
}

export async function chavesPublicas(): Promise<string[]> {
  const agora = Date.now()
  const fixas = chavesFixas()
  const comFixas = (lista: string[]) => [...new Set([...lista, ...fixas])]
  if (chavesCache && agora - chavesCache.em < TTL_CHAVES) return comFixas(chavesCache.chaves)
  if (falhaEm && agora - falhaEm < TTL_FALHA) return comFixas(chavesCache?.chaves || [])
  const { base } = cfg()
  try {
    const res = await $fetch<any>(`${base}/api/v1/webhook/public-keys`, { headers: headers() })
    // A API responde `public_keys` (snake_case). Lendo so `publicKeys`, a lista
    // vinha vazia e TODO webhook real dava 401 (zero linhas woovi em
    // webhook_events ate 07/out; entregas so por polling).
    const chaves = extrairChavesPublicas(res)
    if (chaves.length) {
      chavesCache = { em: agora, chaves }
      falhaEm = 0
    } else {
      console.warn('[woovi] public-keys answer without a recognizable key; using the fixed keys')
      falhaEm = agora
    }
    return comFixas(chaves.length ? chaves : chavesCache?.chaves || [])
  } catch (e: any) {
    console.warn('[woovi] could not fetch the public keys; using the fixed keys:', e?.message)
    falhaEm = agora
    return comFixas(chavesCache?.chaves || [])
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
