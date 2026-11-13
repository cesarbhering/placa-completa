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
 * it is a number equal to the price on screen and not above the price the
 * buyer saw when clicking (`valorNoClique`: the screen can change during the
 * click, when the coupon is re-checked). Otherwise the amount is held and
 * shown, to be paid on the next click; no numeric amount = never confirm.
 */
export function decidirValorCartao(
  valorServidor: unknown,
  valorTela: number,
  reais: (centavos: number) => string,
  temCupom: boolean,
  valorNoClique: number = valorTela,
): DecisaoValorCartao {
  if (typeof valorServidor !== 'number' || !Number.isFinite(valorServidor)) return { acao: 'erro', mensagem: MSG_ERRO_VALOR_CARTAO }
  if (valorServidor === valorTela && valorServidor <= valorNoClique) return { acao: 'confirmar' }
  const valor = `O valor do pagamento é ${reais(valorServidor)}. Toque em pagar de novo para confirmar.`
  // Server and screen agree (only the price at the click was lower): the
  // screen already shows why, so the neutral text; otherwise blame the coupon
  // when one was typed.
  const culpaCupom = temCupom && valorServidor !== valorTela
  return { acao: 'segurar', valor: valorServidor, mensagem: culpaCupom ? `O cupom não pôde ser aplicado. ${valor}` : valor }
}
