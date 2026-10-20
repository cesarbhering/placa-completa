// Porta de entrada do checkout (pedido do Cesar, 13/out: qual botao gerou cada
// checkout e cada venda). Enum fechado: o front passa a origem de quem abriu o
// checkout, o servidor saneia e grava em pedidos_premium.origem_checkout, e o
// evento premium_checkout_open leva o mesmo valor. Pedido antigo (nulo) =
// "nao medido"; nada retroativo.

export const ORIGENS_CHECKOUT = [
  'bloco_bloqueado', // oferta no bloco do resultado (inclui o layout A e o CTA do sinal de leilao/recall)
  'barra_fixa', //      barra fixa de compra do celular
  'escada_planos', //   comparativo de planos e secao de preco
  'hero_home', //       botao do topo da home (header)
  'hero_apos_cta', //   clicou num CTA pago sem placa, digitou a placa no topo e seguiu
  'link_direto', //     /?placa=...&plano=... (upgrade da basica, links)
  'link_plano', //      /?plano=... sem placa: digita a placa e vai direto ao pagamento
  'pix_recovery', //    /premium?placa=... (e-mail de recuperacao de Pix)
  'app', //             reservado: abertura propria do app (hoje o app usa os mesmos botoes do site)
  'outro', //           demais botoes (secao final, FIPE por placa...)
] as const
export type OrigemCheckout = typeof ORIGENS_CHECKOUT[number]

export function sanearOrigemCheckout(v: unknown): OrigemCheckout | null {
  return typeof v === 'string' && (ORIGENS_CHECKOUT as readonly string[]).includes(v) ? (v as OrigemCheckout) : null
}

/** origem_cta do clique (cta_completa_click) -> origem do checkout. */
export function origemDoCta(origemCta: unknown): OrigemCheckout {
  const o = String(origemCta || '')
  if (o === 'barra_fixa') return 'barra_fixa'
  if (o === 'bloco_bloqueado' || o === 'tag' || o.startsWith('layout_a') || o.startsWith('la_')) return 'bloco_bloqueado'
  return sanearOrigemCheckout(o) ?? 'outro'
}

export const ROTULO_ORIGEM_CHECKOUT: Record<OrigemCheckout | 'nao_medido', string> = {
  bloco_bloqueado: 'Bloco da oferta',
  barra_fixa: 'Barra fixa',
  escada_planos: 'Escada de planos',
  hero_home: 'Topo da home',
  hero_apos_cta: 'Topo depois do CTA',
  link_direto: 'Link direto',
  link_plano: 'Link com plano',
  pix_recovery: 'Recuperação de Pix',
  app: 'App',
  outro: 'Outro botão',
  nao_medido: 'não medido',
}
