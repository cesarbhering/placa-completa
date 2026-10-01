// Linha "Recall" da grade de indicadores quando ha consulta da montadora por
// chassi (Nissan/Mitsubishi). Decisao do Cesar (01/out): quando SENATRAN e
// montadora DIVERGEM, a linha mostra as duas fontes; quando concordam, fica a
// linha normal (null = nao mexe).

const NOMES: Record<string, string> = { nissan: 'Nissan', mitsubishi: 'Mitsubishi' }

export interface LinhaRecallGrade {
  /** Texto do valor da linha. */
  texto: string
  /** true = vermelho e entra no veredito de alertas; false = amarelo (atencao). */
  alerta: boolean
}

/**
 * @param senatranPendente indicadorRecall do SENATRAN === true
 * @param montadora snapshot.recallMontadora (consultado, com campanhas)
 */
export function linhaRecallGrade(senatranPendente: boolean, montadora: any): LinhaRecallGrade | null {
  if (!montadora || montadora.consultado !== true || !Array.isArray(montadora.campanhas) || !montadora.campanhas.length) return null
  const nome = NOMES[String(montadora.fonte)] || 'montadora'
  const abertoMontadora = montadora.campanhas.some((c: any) => c?.status === 'aberto')
  // A montadora e a fonte do atendimento: amarelo, fora do veredito de alertas.
  if (senatranPendente && !abertoMontadora) return { texto: `PENDENTE no SENATRAN, REALIZADO segundo a ${nome}`, alerta: false }
  if (!senatranPendente && abertoMontadora) return { texto: `EM DIA no SENATRAN, EM ABERTO segundo a ${nome}`, alerta: true }
  return null
}
