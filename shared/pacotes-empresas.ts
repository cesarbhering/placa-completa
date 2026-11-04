import { PLANOS } from './planos'

// Pacotes B2B fixados pelo Cesar em 04/nov/2026. Cada consulta do pacote e o
// relatorio completo; a comparacao e sempre contra a Completa avulsa do site
// (shared/planos.ts), entao subir o avulso atualiza a economia sozinho.
// Acima de 50 por mes segue o "montamos para o seu volume" do formulario.

export interface PacoteEmpresa {
  id: 'p10' | 'p50'
  consultas: number
  totalCentavos: number
  /** Faixa do formulario que o botao do pacote pre-seleciona (shared/empresas.ts). */
  volumeFaixa: 'até 20' | '20 a 50'
}

export const PACOTES_EMPRESAS: PacoteEmpresa[] = [
  { id: 'p10', consultas: 10, totalCentavos: 34900, volumeFaixa: 'até 20' },
  { id: 'p50', consultas: 50, totalCentavos: 149000, volumeFaixa: '20 a 50' },
]

/** Preco por consulta, em centavos (arredondado pro centavo). */
export function precoPorConsulta(p: PacoteEmpresa): number {
  return Math.round(p.totalCentavos / p.consultas)
}

/** Quanto o pacote economiza contra a mesma quantidade de Completas avulsas. */
export function economiaPacote(p: PacoteEmpresa): { centavos: number; pct: number; avulsoCentavos: number } {
  const avulsoCentavos = PLANOS.completa.valorCentavos * p.consultas
  const centavos = avulsoCentavos - p.totalCentavos
  return { centavos, pct: Math.round((centavos / avulsoCentavos) * 100), avulsoCentavos }
}
