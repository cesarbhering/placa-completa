// Small pure decisions of the inline checkout (components/PremiumInlineCheckout.vue),
// kept here so they can be tested on their own as well as through the component.

/**
 * Does the coupon hold the purchase? `passou` = the coupon check passed.
 * A coupon refused by the attempt limit holds the purchase once (the buyer
 * sees the message and the full price); if it was already refused by the
 * limit before this click and still is, the purchase goes on without it.
 */
export function cupomSeguraCompra(passou: boolean, bloqueadoAntes: boolean, bloqueadoAgora: boolean): boolean {
  return !passou && !(bloqueadoAntes && bloqueadoAgora)
}

export const MSG_ERRO_VALOR_CARTAO = 'Não conseguimos iniciar o pagamento. Tente de novo ou use o Pix.'

export type DecisaoValorCartao =
  | { acao: 'confirmar' }
  | { acao: 'segurar'; valor: number; mensagem: string }
  | { acao: 'erro'; mensagem: string }

/**
 * Card: the server answers with the amount it will charge. Confirm only when
 * it is a number equal to the price on screen. A different amount (coupon
 * refused between the checks, or any other cause) is held and shown, to be
 * paid on the next click; no numeric amount = do not confirm at all.
 */
export function decidirValorCartao(
  valorServidor: unknown,
  valorTela: number,
  reais: (centavos: number) => string,
  temCupom: boolean,
): DecisaoValorCartao {
  if (typeof valorServidor !== 'number' || !Number.isFinite(valorServidor)) return { acao: 'erro', mensagem: MSG_ERRO_VALOR_CARTAO }
  if (valorServidor === valorTela) return { acao: 'confirmar' }
  const valor = `O valor do pagamento é ${reais(valorServidor)}. Toque em pagar de novo para confirmar.`
  return { acao: 'segurar', valor: valorServidor, mensagem: temCupom ? `O cupom não pôde ser aplicado. ${valor}` : valor }
}
