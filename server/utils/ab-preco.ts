import { abPrecoLigadoPorEnv, bracoDoPedido, colunasAbPreco, type BracoPreco } from '../../shared/ab-preco'

// Server side of the price A/B test (shared/ab-preco.ts). One place decides,
// for every endpoint that computes a price, which arm the order belongs to.

/** Flag on? Reads runtimeConfig.public.abPreco (NUXT_PUBLIC_AB_PRECO). */
export function abPrecoLigadoNoServidor(config: any): boolean {
  return abPrecoLigadoPorEnv(config?.public?.abPreco)
}

export interface AbPrecoCheckout {
  /** Arm recorded on the order (null = outside the test). Only 'B' changes the price. */
  braco: BracoPreco | null
  /** Columns to spread into the pedidos_premium insert ({} with the flag off). */
  colunas: { ab_preco?: BracoPreco | null }
}

/**
 * Arm of a checkout request. `canal` comes from getDispositivo(event): the app
 * (Google Play UA marker) never enters the test; missing or invalid variant = null (A price).
 */
export function abPrecoDoCheckout(body: any, config: any, canal: string | null | undefined): AbPrecoCheckout {
  const ligado = abPrecoLigadoNoServidor(config)
  const braco = bracoDoPedido(body?.ab_preco, { ligado, canal })
  return { braco, colunas: colunasAbPreco(braco, ligado) }
}

/** Extra select fragment for reading ab_preco ('' with the flag off, so the code runs before the migration). */
export function colunaAbPrecoSelect(config: any): string {
  return abPrecoLigadoNoServidor(config) ? ',ab_preco' : ''
}
