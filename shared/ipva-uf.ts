// Aliquotas de IPVA por UF (automoveis de passeio). Fonte unica: server/utils/icv5.ts reexporta.
export function aliquotaIPVA(uf: string): number {
  const aliquotas: Record<string, number> = {
    AC: 0.02,
    AL: 0.0275,
    AP: 0.03,
    AM: 0.03,
    BA: 0.025,
    CE: 0.03,
    DF: 0.035,
    ES: 0.02,
    GO: 0.0375,
    MA: 0.025,
    MT: 0.03,
    MS: 0.035,
    MG: 0.04,
    PA: 0.025,
    PB: 0.025,
    PR: 0.035,
    PE: 0.03,
    PI: 0.025,
    RJ: 0.04,
    RN: 0.03,
    RS: 0.03,
    RO: 0.03,
    RR: 0.03,
    SC: 0.02,
    SP: 0.04,
    SE: 0.025,
    TO: 0.03,
  }
  return aliquotas[uf.toUpperCase()] ?? 0.03
}

