// Agrupamento de campanhas de recall parecidas (Cesar, 20/out/2026; caso
// HOI8752, Voyage: 6 campanhas "Gerador de gas do airbag do motorista" e
// "do motorista e/ou do passageiro" com faixas de ano diferentes viravam 4+
// cards quase iguais).
//
// Um agente (Haiku, server/utils/recall-agrupar.ts) agrupa na geracao do
// relatorio; o resultado fica no snapshot (recallBase.agrupado). Regra de
// seguranca: cada campanha original cai em EXATAMENTE um grupo. Qualquer
// indice perdido, repetido ou fora da lista invalida a resposta inteira e a
// tela mostra a lista original.

export interface GrupoRecall {
  /** Titulo curto do grupo, ex.: "Airbag do motorista e/ou passageiro". */
  titulo: string
  /** Uma frase em linguagem leiga: o que o defeito pode causar. */
  resumo: string
  /** Indices (0-based) das campanhas originais deste grupo. */
  indices: number[]
  /** Faixa de anos somada das campanhas, ex.: "2009 a 2016". */
  anos: string | null
  /** Modelo(s), ex.: "Voyage". */
  modelo: string | null
}

export interface AgrupamentoRecall {
  /** Hash do conjunto de campanhas agrupado (cache e conferencia). */
  hash: string
  /** Quantas campanhas havia: a tela confere com a lista atual. */
  total: number
  grupos: GrupoRecall[]
}

const texto = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').replace(/\s*[—–]\s*/g, ', ').trim().slice(0, max)

/**
 * Valida e saneia a resposta do agente pra `n` campanhas. null se qualquer
 * indice faltar, repetir ou estiver fora da lista, se algum grupo vier vazio
 * ou sem titulo, ou se nao houver ganho (tantos grupos quanto campanhas).
 */
export function validarGrupos(grupos: unknown, n: number): GrupoRecall[] | null {
  if (!Array.isArray(grupos) || !grupos.length || n < 2) return null
  const vistos = new Set<number>()
  const out: GrupoRecall[] = []
  for (const g of grupos as any[]) {
    const indices = Array.isArray(g?.indices) ? g.indices : null
    if (!indices || !indices.length) return null
    for (const i of indices) {
      if (!Number.isInteger(i) || i < 0 || i >= n || vistos.has(i)) return null
      vistos.add(i)
    }
    const titulo = texto(g?.titulo, 90)
    if (!titulo) return null
    out.push({
      titulo,
      resumo: texto(g?.resumo, 220),
      indices: [...indices].sort((a, b) => a - b),
      anos: texto(g?.anos, 40) || null,
      modelo: texto(g?.modelo, 60) || null,
    })
  }
  if (vistos.size !== n) return null
  if (out.length >= n) return null
  return out
}

/** Agrupamento gravado que ainda vale pra esta lista de campanhas (senao, lista original). */
export function agrupamentoValido(a: AgrupamentoRecall | null | undefined, n: number): GrupoRecall[] | null {
  if (!a || a.total !== n) return null
  return validarGrupos(a.grupos, n)
}
