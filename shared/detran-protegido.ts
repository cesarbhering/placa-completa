// Texto aprovado (06/out) pro DETRAN que responde "veiculo protegido": o
// proprietario bloqueou a consulta publica (MES3261, DETRAN-SC, code 620).
export function textoDetranProtegido(uf: string | null | undefined): string {
  const u = String(uf || '').trim().toUpperCase()
  return `No DETRAN${u ? '-' + u : ''}, o proprietário bloqueou a consulta pública deste veículo. Peça ao vendedor o extrato de débitos do DETRAN antes de fechar negócio.`
}

// Card de multas (opcao 3 do Cesar, 26/out/2026): o mesmo texto partido em
// linha da fonte, explicacao e orientacao no rodape.
export const PROTEGIDO_STATUS = 'Bloqueado'
export const PROTEGIDO_EXPLICA = 'O proprietário bloqueou a consulta pública. IPVA, licenciamento e multas estaduais não aparecem.'
export const PROTEGIDO_ORIENTA = 'Peça ao vendedor o extrato de débitos do DETRAN antes de fechar negócio.'
