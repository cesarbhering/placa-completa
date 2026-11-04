// Pedido acoplado: segunda placa com o relatorio completo por este preco.
export const PRECO_BUMP_CENTAVOS = 2990

/** Link da oferta: home com o plano e o cupom; a pessoa digita a placa e vai ao pagamento. */
export function linkBump(codigo: string): string {
  return `/?plano=completa&cupom=${encodeURIComponent(codigo)}&origem=bump`
}

/** /?plano=...&origem=bump marca o checkout como 'bump'. */
export function veioDoBump(query: { origem?: unknown }): boolean {
  const v = Array.isArray(query.origem) ? query.origem[0] : query.origem
  return v === 'bump'
}
