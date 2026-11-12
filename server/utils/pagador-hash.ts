import { createHmac } from 'node:crypto'
import { pagadorDaCobrancaWoovi } from './woovi'
import { gravarTomador } from './tomador'
import { fingerprintDoCartao } from './stripe'

// Cliente recorrente sem e-mail (pedido do Cesar, 05/out): identificador
// PSEUDONIMIZADO do pagador. No Pix, o CPF/CNPJ de quem pagou (vem da cobranca
// na Woovi) vira HMAC-SHA256(segredo, digitos) e e descartado na hora. Nunca
// grava CPF, CNPJ nem nome neste hash: nada em coluna, log, snapshot ou evento.
// (Separate exception: the NFS-e payer, ALWAYS encrypted, in pedidos_tomador.) No cartao,
// o fingerprint da Stripe (id opaco do cartao, sem numero). Sem segredo: no-op.

/** So digitos; CPF (11) ou CNPJ (14). Qualquer outra coisa: null. */
export function digitosDoc(bruto: unknown): string | null {
  const d = String(bruto ?? '').replace(/\D/g, '')
  return d.length === 11 || d.length === 14 ? d : null
}

export function hmacPagador(digitos: string, segredo: string): string {
  return createHmac('sha256', segredo).update(digitos, 'utf8').digest('hex')
}

/** Hash pronto a partir do documento bruto; null se nao der. */
export function hashDoPagador(docBruto: unknown, segredo: string | null | undefined): string | null {
  if (!segredo) return null
  const d = digitosDoc(docBruto)
  return d ? hmacPagador(d, segredo) : null
}

/**
 * Tira dados do pagador do payload de webhook antes de gravar em
 * webhook_events (payer/customer da Woovi, billing_details da Stripe).
 */
export function sanearPayloadWebhook(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload
  const limpar = (o: any, depth = 0) => {
    if (!o || typeof o !== 'object' || depth > 6) return
    for (const k of Object.keys(o)) {
      if (['payer', 'customer', 'taxID', 'billing_details', 'shipping', 'receipt_email', 'customer_details', 'customer_email', 'name'].includes(k)) {
        delete o[k]
        continue
      }
      limpar(o[k], depth + 1)
    }
  }
  const copia = JSON.parse(JSON.stringify(payload))
  limpar(copia)
  return copia
}

/**
 * Grava o identificador do pagador no pedido (fire-and-forget, depois do
 * pagamento detectado). Nunca lanca, nunca loga dado do pagador.
 */
export async function gravarPagadorHash(
  supabase: any,
  pedido: { id: string; pix_provider?: string | null; abacatepay_id?: string | null; forma_pagamento?: string | null; stripe_session_id?: string | null },
  deps: {
    segredo?: string | null
    documentoWoovi?: (chargeId: string) => Promise<string | null>
    pagadorWoovi?: (chargeId: string) => Promise<{ documento: string | null; nome: string | null }>
    gravarTomador?: typeof gravarTomador
    fingerprintStripe?: (piId: string) => Promise<string | null>
  } = {},
): Promise<void> {
  try {
    const segredo = deps.segredo ?? String(useRuntimeConfig().pagadorHashSecret || '')
    const upd: Record<string, string> = {}
    if (pedido.pix_provider === 'woovi' && pedido.abacatepay_id && pedido.forma_pagamento !== 'cartao') {
      const p = deps.documentoWoovi
        ? { documento: await deps.documentoWoovi(pedido.abacatepay_id), nome: null as string | null }
        : await (deps.pagadorWoovi ?? pagadorDaCobrancaWoovi)(pedido.abacatepay_id)
      const h = hashDoPagador(p.documento, segredo)
      if (h) upd.pagador_hash = h
      // NFS-e payer (encrypted, server only). Never throws.
      if (p.documento) await (deps.gravarTomador ?? gravarTomador)(supabase, pedido.id, { documento: p.documento, nome: p.nome, origem: 'woovi' })
    }
    // AbacatePay orders capture no payer yet: their NFS-e falls to sem_tomador until a
    // payer lookup for that provider is implemented.
    if (pedido.forma_pagamento === 'cartao' && pedido.stripe_session_id?.startsWith('pi_')) {
      const fp = await (deps.fingerprintStripe ?? fingerprintDoCartao)(pedido.stripe_session_id)
      if (fp && /^[A-Za-z0-9]{8,64}$/.test(fp)) upd.pagador_hash_cartao = fp
    }
    if (!Object.keys(upd).length) return
    await supabase.from('pedidos_premium').update(upd).eq('id', pedido.id)
  } catch (e: any) {
    console.warn('[pagador] identificador nao gravado:', String(e?.name || 'erro'))
  }
}
