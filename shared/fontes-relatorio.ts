// Relatorio 2.0, item 7 (Cesar, 14/out): a tela espera ate 5 min pelas fontes
// lentas e entrega tudo junto, com o progresso por fonte. Passou de 5 min, o
// relatorio abre com o que tem e marca o que falta como "chegando": a fila
// (premium_jobs) completa depois e manda UM e-mail quando fechar.
// Puro (testavel): o servidor calcula e manda pronto no report.get.

export const ESPERA_FONTES_MS = 5 * 60 * 1000

// historico_veicular: owners, previous use, insurance and the partner part of
// the auction section (vehicle history partner, 13/11/2026; Completa only).
export type FonteRelatorio = 'detran' | 'recall' | 'recall_montadora' | 'renajud' | 'historico_veicular'
export type EstadoFonte = 'consultando' | 'ok' | 'chegando' | 'indisponivel'

export interface SituacaoFonte { fonte: FonteRelatorio; rotulo: string; estado: EstadoFonte }

export interface EntradaFontes {
  entregueEm: string | null | undefined
  agora?: number
  /** Fontes que se aplicam a este pedido (decidido no servidor na entrega). */
  aplicaveis: { fonte: FonteRelatorio; rotulo: string }[]
  snapshot: { multas?: any; recall?: any; recallMontadora?: any; renajudDetalhe?: any; historicoVeicular?: any } | null | undefined
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
  // Failed or capped call: not done yet (the queue tries again). Another VIN
  // (divergente) is a final answer: nothing of it is shown.
  if (fonte === 'historico_veicular') return ['ok', 'divergente'].includes(String(snap.historicoVeicular?.status))
  return false
}

/**
 * The source will not come within the wait (review 1 of PR #752): the call
 * started with the paid query is over and failed (timeout, 5xx, network,
 * balance, key) or the daily ceiling was reached, and nothing tries again
 * before the queue (delivery + 5 min). The screen does not keep the customer
 * in "consultando" for it: "chegando" while the queue may bring it, otherwise
 * "indisponivel".
 */
export function fonteNaoVemAgora(fonte: FonteRelatorio, s: EntradaFontes['snapshot']): boolean {
  if (fonte !== 'historico_veicular') return false
  const st = (s || {}).historicoVeicular?.status
  return st === 'teto' || st === 'falhou'
}

/**
 * Line of a source on the waiting screen (review 2 of PR #752): the tick only
 * for what came; what is still to come or did not come says so. No dash.
 */
export function linhaEsperaFonte(f: { rotulo: string; estado: EstadoFonte | string }): string {
  if (f.estado === 'consultando') return `Consultando ${f.rotulo}…`
  if (f.estado === 'chegando') return `${f.rotulo}: chegando, avisamos por e-mail`
  if (f.estado === 'indisponivel') return `${f.rotulo}: indisponível agora`
  return `${f.rotulo} ✓`
}

export function situacaoDasFontes(e: EntradaFontes): { fontes: SituacaoFonte[]; aguardarAte: number | null } {
  const agora = e.agora ?? Date.now()
  const ent = new Date(String(e.entregueEm || '')).getTime()
  const aguardarAte = Number.isFinite(ent) ? ent + ESPERA_FONTES_MS : null
  const dentroDaEspera = aguardarAte != null && agora < aguardarAte
  const jobs = e.jobs || []
  const fontes = e.aplicaveis.map(({ fonte, rotulo }) => {
    if (fonteConcluida(fonte, e.snapshot)) return { fonte, rotulo, estado: 'ok' as EstadoFonte }
    if (dentroDaEspera) {
      if (!fonteNaoVemAgora(fonte, e.snapshot)) return { fonte, rotulo, estado: 'consultando' as EstadoFonte }
      // Inside the wait the queue job may not exist yet (it is created after the
      // delivery photos, up to 60 s later), and the queue will try: "chegando"
      // (review 2 of PR #752).
      return { fonte, rotulo, estado: 'chegando' as EstadoFonte }
    }
    // Depois da espera: so e "chegando" se a fila ainda vai tentar. Sem job
    // (relatorio antigo) ou job esgotado/fechado: indisponivel.
    const job = jobs.find((j) => j.fonte === fonte)
    const naFila = !!job && ['pendente', 'rodando'].includes(job.status)
    return { fonte, rotulo, estado: (naFila ? 'chegando' : 'indisponivel') as EstadoFonte }
  })
  return { fontes, aguardarAte }
}
