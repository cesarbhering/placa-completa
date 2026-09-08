// Regra de quando o e-mail informado DEPOIS do pagamento dispara a entrega.
// Fica fora do endpoint pra poder ser testada sem banco nem servidor de e-mail:
// e uma decisao de negocio de duas linhas que, errada, ou deixa alguem que
// pagou sem receber, ou manda o mesmo relatorio duas vezes.

/** Status em que o relatorio ja existe e pode ser entregue por e-mail. */
export const STATUS_JA_ENTREGUE = ['pago', 'consultando', 'entregue']

export interface PedidoParaEntrega {
  status?: string | null
  /** Carimbo de quando o relatorio ja foi enviado por este caminho. */
  email_enviado_em?: string | null
}

export function entregaTardiaPendente(pedido: PedidoParaEntrega | null | undefined): boolean {
  if (!pedido) return false
  // Ja enviado por este caminho: nao repete.
  if (pedido.email_enviado_em) return false
  return STATUS_JA_ENTREGUE.includes(String(pedido.status || ''))
}
