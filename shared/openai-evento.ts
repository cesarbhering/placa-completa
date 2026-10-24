import { PLANOS, isPlanoPago } from './planos'

// Dados do order_created da OpenAI Ads, iguais no servidor (CAPI,
// server/utils/openai-capi.ts) e no navegador (pixel, oaiq 'measure'): mesmo
// valor, mesma moeda, mesmo contents. Com o mesmo event_id (o token do pedido)
// a OpenAI deduplica e conta uma venda so.

/** Valor da conversao: o que foi pago; cupom 100% (R$ 0) vai com o preco cheio do plano. */
export function valorDoEvento(valorCentavos: number | null | undefined, plano: keyof typeof PLANOS): number {
  const v = Math.round(Number(valorCentavos))
  return v > 0 ? v : PLANOS[plano].valorCentavos
}

/** Bloco `data` do order_created (tipo contents; amount inteiro em centavos). */
export function dadosOrderCreated(valorCentavos: number | null | undefined, planoBruto: string | null | undefined) {
  const plano = isPlanoPago(planoBruto) ? planoBruto : 'completa'
  const valor = valorDoEvento(valorCentavos, plano)
  return {
    type: 'contents' as const,
    amount: valor,
    currency: 'BRL',
    contents: [{ id: `plano-${plano}`, name: PLANOS[plano].nome, content_type: 'product', quantity: 1, amount: valor, currency: 'BRL' }],
  }
}
