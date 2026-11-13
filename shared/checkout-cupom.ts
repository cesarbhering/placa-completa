// Small pure decisions of the inline checkout (components/PremiumInlineCheckout.vue),
// kept here so they can be tested without mounting the component.

/**
 * Does the coupon hold the purchase? `passou` = the coupon check passed.
 * A coupon refused by the attempt limit holds the purchase once (the buyer
 * sees the message and the full price); if it was already refused by the
 * limit before this click and still is, the purchase goes on without it.
 */
export function cupomSeguraCompra(passou: boolean, bloqueadoAntes: boolean, bloqueadoAgora: boolean): boolean {
  return !passou && !(bloqueadoAntes && bloqueadoAgora)
}

/**
 * Card: the server answers with the amount it will charge. When it differs
 * from the price on screen (coupon refused between the screen check and the
 * server, or any other cause), the payment must not be confirmed on this
 * click: returns the message to show, or null when the amounts match.
 */
export function avisoValorCartao(valorServidor: unknown, valorTela: number, reais: (centavos: number) => string): string | null {
  if (typeof valorServidor !== 'number' || !Number.isFinite(valorServidor)) return null
  if (valorServidor === valorTela) return null
  return `O cupom não pôde ser aplicado. O valor do pagamento é ${reais(valorServidor)}. Toque em pagar de novo para confirmar.`
}
