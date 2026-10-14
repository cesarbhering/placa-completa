// Relatorio 2.0, item 7 (Cesar, 14/out): a tela espera ate 5 min pelas fontes
// lentas e entrega tudo junto, com o progresso por fonte. Passou de 5 min, o
// relatorio abre com o que tem e marca o que falta como "chegando": a fila
// (premium_jobs) completa depois e manda UM e-mail quando fechar.
// Puro (testavel): o servidor calcula e manda pronto no report.get.

export const ESPERA_FONTES_MS = 5 * 60 * 1000

export type FonteRelatorio = 'detran' | 'recall' | 'recall_montadora' | 'renajud'
export type EstadoFonte = 'consultando' | 'ok' | 'chegando' | 'indisponivel'

export interface SituacaoFonte { fonte: FonteRelatorio; rotulo: string; estado: EstadoFonte }

export interface EntradaFontes {
  entregueEm: string | null | undefined
  agora?: number
  /** Fontes que se aplicam a este pedido (decidido no servidor na entrega). */
  aplicaveis: { fonte: FonteRelatorio; rotulo: string }[]
  snapshot: { multas?: any; recall?: any; recallMontadora?: any; renajudDetalhe?: any } | null | undefined
  /** Jobs da fila do pedido: so o que importa pra tela. */
  jobs?: { fonte: string; status: string }[]
}

/** A fonte ja trouxe resultado final (com dado ou sem dado)? */
export function fonteConcluida(fonte: FonteRelatorio, s: EntradaFontes['snapshot']): boolean {
  const snap = s || {}
  if (fonte === 'detran') {
    const m = snap.multas
    if (!m || typeof m !== 'object') return false
    if (['ok', 'sem_debito', 'protegido'].includes(String(m.status))) return !m.ipva_pendente_sefaz
    return false
  }
  if (fonte === 'recall') return snap.recall != null
  if (fonte === 'recall_montadora') return snap.recallMontadora != null
  if (fonte === 'renajud') return snap.renajudDetalhe != null && String(snap.renajudDetalhe?.status) !== 'indisponivel'
  return false
}

export function situacaoDasFontes(e: EntradaFontes): { fontes: SituacaoFonte[]; aguardarAte: number | null } {
  const agora = e.agora ?? Date.now()
  const ent = new Date(String(e.entregueEm || '')).getTime()
  const aguardarAte = Number.isFinite(ent) ? ent + ESPERA_FONTES_MS : null
  const dentroDaEspera = aguardarAte != null && agora < aguardarAte
  const jobs = e.jobs || []
  const fontes = e.aplicaveis.map(({ fonte, rotulo }) => {
    if (fonteConcluida(fonte, e.snapshot)) return { fonte, rotulo, estado: 'ok' as EstadoFonte }
    if (dentroDaEspera) return { fonte, rotulo, estado: 'consultando' as EstadoFonte }
    // Depois da espera: so e "chegando" se a fila ainda vai tentar. Sem job
    // (relatorio antigo) ou job esgotado/fechado: indisponivel.
    const job = jobs.find((j) => j.fonte === fonte)
    const naFila = !!job && ['pendente', 'rodando'].includes(job.status)
    return { fonte, rotulo, estado: (naFila ? 'chegando' : 'indisponivel') as EstadoFonte }
  })
  return { fontes, aguardarAte }
}
