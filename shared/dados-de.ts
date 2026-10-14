// "Dados de dd/mm" por bloco do relatorio pago (Relatorio 2.0): com o cache por
// placa (fonte_cache), um bloco pode vir de consulta de outro dia. A linha so
// aparece quando o dia da consulta (horario de Brasilia) difere do dia da
// entrega do relatorio; no mesmo dia ela nao acrescenta nada.

function diaBrt(iso: string | null | undefined): string | null {
  const t = iso ? new Date(iso) : null
  if (!t || Number.isNaN(t.getTime())) return null
  return t.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** "Dados de 12/10" quando consultadoEm e de outro dia que a referencia (entrega); senao null. */
export function dadosDe(consultadoEm: string | null | undefined, referencia: string | null | undefined): string | null {
  const dia = diaBrt(consultadoEm)
  if (!dia) return null
  const ref = diaBrt(referencia) ?? diaBrt(new Date().toISOString())
  if (dia === ref) return null
  return `Dados de ${dia.slice(0, 5)}`
}
