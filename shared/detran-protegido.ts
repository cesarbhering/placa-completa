// Texto aprovado (06/out) pro DETRAN que responde "veiculo protegido": o
// proprietario bloqueou a consulta publica (MES3261, DETRAN-SC, code 620).
export function textoDetranProtegido(uf: string | null | undefined): string {
  const u = String(uf || '').trim().toUpperCase()
  return `No DETRAN${u ? '-' + u : ''}, o proprietário bloqueou a consulta pública deste veículo. Peça ao vendedor o extrato de débitos do DETRAN antes de fechar negócio.`
}
