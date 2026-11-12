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

// The report only reads the nfse_* columns with the module on, so the site keeps
// working against a database where the NFS-e migration has not run yet.
const COLUNAS_NFSE_RELATORIO = 'nfse_status,nfse_numero,nfse_serie,nfse_emitida_em,nfse_cancelada_em,nfse_id'

/** Extra columns for the report's order select: ',nfse_...' with the module on, '' otherwise. */
export function colunasNfseRelatorio(config: { nfse?: string } | null | undefined): string {
  return config?.nfse === 'on' ? `,${COLUNAS_NFSE_RELATORIO}` : ''
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
    pdf: `/api/premium/nfse/${token}/pdf`,
  }
}
