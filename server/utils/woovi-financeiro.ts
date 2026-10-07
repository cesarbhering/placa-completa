import { comTagAmbiente } from './ambiente-alerta'
// Encaminha todo webhook da Woovi com assinatura VALIDA pra
// financeiro@placacompleta.com.br (pedido do Cesar, 08/out: conciliacao e
// nota). Conteudo COMPLETO, como chega, inclusive nome e CPF do pagador: vai
// SO no e-mail; no banco a regra do pagador_hash continua (nada em claro).
//
// Fail-open e fora do caminho: quem chama dispara sem await; erro aqui nunca
// muda a resposta 200 a Woovi nem o processamento do pedido.

export const DESTINO_FINANCEIRO = 'financeiro@placacompleta.com.br'
const JANELA_DEDUP_MS = 15 * 60 * 1000

// A Woovi entrega cada evento 2x (~30 s). 1 e-mail por evento: chave em
// memoria (um container so em prod), com janela curta.
const vistos = new Map<string, number>()

export function chaveDedupWoovi(payload: any): string {
  const c = payload?.charge || {}
  const pix = payload?.pix || {}
  return [payload?.event || payload?.evento || '', c.identifier || c.correlationID || '', pix.endToEndId || c.paymentMethods?.pix?.endToEndId || ''].join('|')
}

export function primeiraVez(chave: string, agora = Date.now(), mapa = vistos): boolean {
  for (const [k, t] of mapa) if (agora - t > JANELA_DEDUP_MS) mapa.delete(k)
  if (mapa.has(chave)) return false
  mapa.set(chave, agora)
  return true
}

/** Envio falhou: libera a chave pra 2a entrega da Woovi tentar de novo. */
export function esquecer(chave: string, mapa = vistos): void {
  mapa.delete(chave)
}

const brl = (centavos: unknown) => {
  const n = Number(centavos)
  return Number.isFinite(n) ? `R$ ${(n / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'
}
const txt = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v))

/** Pagador do evento: payer, customer ou pix.payer, o que vier. */
export function pagadorWoovi(payload: any): { nome: string; documento: string } {
  const c = payload?.charge || {}
  const p = c.payer || payload?.pix?.payer || c.customer || {}
  const doc = p?.taxID?.taxID ?? p?.taxID ?? p?.cpf ?? p?.cnpj ?? null
  return { nome: txt(p?.name), documento: txt(typeof doc === 'object' ? null : doc) }
}

export function montarEmailFinanceiro(payload: any, raw: string, pedido?: { placa?: string | null; token_entrega?: string | null; id?: string | null } | null) {
  const c = payload?.charge || {}
  const pix = payload?.pix || {}
  const evt = txt(payload?.event)
  const valor = brl(c.value ?? pix.value)
  const ref = pedido?.placa || c.correlationID || c.identifier || ''
  const pag = pagadorWoovi(payload)
  const linhas = [
    `Evento: ${evt}`,
    `Valor: ${valor}`,
    `Status da cobranca: ${txt(c.status)}`,
    `Pago em: ${txt(c.paidAt ?? pix.time)}`,
    `endToEndId: ${txt(pix.endToEndId ?? c.paymentMethods?.pix?.endToEndId)}`,
    `correlationID: ${txt(c.correlationID)}`,
    `identifier (Woovi): ${txt(c.identifier)}`,
    `Pedido: ${txt(pedido?.id)}`,
    `Placa: ${txt(pedido?.placa)}`,
    `Relatorio: ${pedido?.token_entrega ? `https://placacompleta.com.br/premium/${pedido.token_entrega}` : '-'}`,
    `Pagador: ${pag.nome}`,
    `CPF/CNPJ do pagador: ${pag.documento}`,
  ]
  let bruto = raw
  try { bruto = JSON.stringify(JSON.parse(raw), null, 2) } catch { /* vai como veio */ }
  return {
    subject: `Woovi: ${evt} ${valor} ${ref}`.trim(),
    text: `${linhas.join('\n')}\n\n---------- payload bruto (como chegou da Woovi) ----------\n${bruto}\n`,
  }
}

/**
 * Dispara o e-mail (sem await no chamador). Dedup por evento; acha o pedido
 * pra placa/token so como enfeite (falhou, segue sem). Nunca lanca.
 */
export async function encaminharWebhookFinanceiro(supabase: any, payload: any, raw: string, pedidoId: string, chargeId: string): Promise<boolean> {
  let chave = ''
  try {
    chave = chaveDedupWoovi(payload)
    if (!primeiraVez(chave)) return false
    const config = useRuntimeConfig()
    if (!config.resendApiKey) { esquecer(chave); return false }
    let pedido: any = null
    try {
      if (pedidoId) ({ data: pedido } = await supabase.from('pedidos_premium').select('id,placa,token_entrega').eq('id', pedidoId).maybeSingle())
      if (!pedido && chargeId) ({ data: pedido } = await supabase.from('pedidos_premium').select('id,placa,token_entrega').eq('abacatepay_id', chargeId).maybeSingle())
    } catch { /* sem pedido no resumo */ }
    const { subject, text } = montarEmailFinanceiro(payload, raw, pedido)
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: { from: 'PlacaCompleta <contato@placacompleta.com.br>', to: [DESTINO_FINANCEIRO], subject: comTagAmbiente(subject, config), text },
      timeout: 10000,
    })
    return true
  } catch (e: any) {
    if (chave) esquecer(chave) // a 2a entrega da Woovi tenta de novo
    console.warn('[woovi-financeiro] encaminhar falhou:', e?.message || e)
    return false
  }
}
