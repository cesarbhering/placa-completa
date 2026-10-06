// RENAINF aceso + DETRAN da UF sem multa (textos aprovados pelo Cesar, 06/out).
// Caso FUG0A96 (SP): o indicador nacional dizia "consta multa" e, logo abaixo,
// o DETRAN-SP dizia "Multas em aberto: Nada consta". Nao e contradicao: o
// RENAINF registra multa de orgao de outro estado ou federal (PRF), que nao
// aparece no DETRAN de origem. So renderizacao: vale para relatorio entregue.

/**
 * UF do DETRAN que respondeu sem multa quando o RENAINF esta aceso; senao
 * null (com multa no DETRAN, sem DETRAN, indisponivel ou consultando: nada
 * muda). A UF vem da fonte do bloco ("detran_sp") ou, sem ela, da UF do veiculo.
 */
export function ufRenainfForaDoDetran(
  indicadorRenainf: unknown,
  multas: { status?: string | null; fonte?: string | null; uf?: string | null; multas_total_centavos?: number | null } | null | undefined,
  ufVeiculo?: string | null,
): string | null {
  if (indicadorRenainf !== true && indicadorRenainf !== 'true') return null
  if (!multas || (multas.status !== 'ok' && multas.status !== 'sem_debito')) return null
  if (multas.multas_total_centavos == null || Number(multas.multas_total_centavos) !== 0) return null
  const daFonte = /^detran_([a-z]{2})$/i.exec(String(multas.fonte || ''))?.[1]
  const uf = String(multas.uf || daFonte || ufVeiculo || '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(uf) ? uf : null
}

export function textoMultasRenainfForaDoDetran(uf: string): string {
  return `No DETRAN-${uf}: nada consta. O indicador nacional (RENAINF) aponta multa em aberto aplicada por órgão de outro estado ou federal (como a PRF), que não aparece no DETRAN de origem. Confirme com o vendedor antes de fechar negócio.`
}

export const EXPLICA_RENAINF_FORA_DO_DETRAN =
  'Consta multa em aberto registrada no sistema nacional (RENAINF), aplicada fora do estado de registro ou por órgão federal.'
