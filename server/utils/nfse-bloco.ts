// NFS-e block of the report payload: only issued/cancelled notes, only with the module on.
export interface NfseBloco {
  status: 'emitida' | 'cancelada'
  numero: string | null
  serie: string | null
  emitida_em: string | null
  cancelada_em: string | null
  valor_centavos: number | null
  pdf: string
}

export function blocoNfse(pedido: any, token: string, config: { nfse?: string }): NfseBloco | null {
  if (config?.nfse !== 'on') return null
  const status = pedido?.nfse_status
  if (status !== 'emitida' && status !== 'cancelada') return null
  return {
    status,
    numero: pedido.nfse_numero ?? null,
    serie: pedido.nfse_serie ?? null,
    emitida_em: pedido.nfse_emitida_em ?? null,
    cancelada_em: pedido.nfse_cancelada_em ?? null,
    valor_centavos: pedido.valor_centavos ?? null,
    pdf: `/api/premium/nfse/${token}.pdf`,
  }
}
