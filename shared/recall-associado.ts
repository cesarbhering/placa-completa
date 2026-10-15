// "Recall associado a este veiculo" no relatorio pago (pedido do Cesar, 14/out).
//
// Quem comprou pelo hook de recall da consulta gratis (a base de recalls achou
// campanha pro chassi ou pro modelo/ano) precisa saber QUAL recall era, mesmo
// quando hoje nada consta como pendente. Antes o relatorio so dizia "sem recall
// pendente" e a pessoa ficava sem resposta.
//
// Regra de copy: a base sabe que o carro CONSTA numa campanha, nunca se ja foi
// atendido. Nao afirmar que foi feito; sem travessao.

export interface CampanhaBase {
  codigo: string | null
  nome: string | null
  modelo: string | null
  ano_modelo: string | number | null
  inicio: string | null
  nivel: 'firme' | 'suave'
}

export interface RecallBase {
  consultado: boolean
  /** Sinal da consulta gratis que a pessoa viu: firme (chassi) ou suave (modelo/ano). */
  sinal: 'firme' | 'suave' | null
  fonte: 'base_recalls'
  campanhas: CampanhaBase[]
}

export interface CardRecallAssociado {
  titulo: string
  itens: { nome: string; meta: string }[]
  situacao: string
  fonte: string
  semDetalhe: boolean
}

export const SITUACAO_RECALL_ASSOCIADO = 'Não consta como pendente na data da consulta: pode já ter sido atendido. Confirme na concessionária com o chassi.'

export function sinalPositivo(sinal: unknown): sinal is 'firme' | 'suave' {
  return sinal === 'firme' || sinal === 'suave'
}

function anoDe(iso: string | null): string | null {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})/)
  return m ? `${m[2]}/${m[1]}` : null
}

/**
 * A base devolve a MESMA campanha uma vez por variante de modelo (ex.: "Polo" e
 * "Novo Polo"), o que aparecia como item duplicado no relatorio (SHW1H43,
 * 15/out). Agrupa por codigo (ou nome) e junta os modelos: os de mesmo ano
 * viram "Polo e Novo Polo 2023".
 */
function agruparCampanhas(camps: CampanhaBase[]): { c: CampanhaBase; modelos: string }[] {
  const grupos = new Map<string, { c: CampanhaBase; porAno: Map<string, string[]> }>()
  for (const c of camps) {
    const chave = (c.codigo ? `c:${c.codigo}` : `n:${c.nome || ''}`).trim().toLowerCase()
    let g = grupos.get(chave)
    if (!g) { g = { c, porAno: new Map() }; grupos.set(chave, g) }
    if (!c.modelo) continue
    const ano = c.ano_modelo != null ? String(c.ano_modelo) : ''
    const lista = g.porAno.get(ano) || []
    if (!lista.includes(c.modelo)) lista.push(c.modelo)
    g.porAno.set(ano, lista)
  }
  return [...grupos.values()].map((g) => ({
    c: g.c,
    modelos: [...g.porAno.entries()].map(([ano, ms]) => {
      const nomes = ms.length > 1 ? `${ms.slice(0, -1).join(', ')} e ${ms[ms.length - 1]}` : ms[0]
      return ano ? `${nomes} ${ano}` : nomes
    }).join('; '),
  }))
}

/**
 * Card novo, ou null quando nao se aplica:
 * - sem hook positivo na consulta gratis: null;
 * - ha recall pendente (base nacional, GM ou montadora): o card de pendente ja responde;
 * - a montadora listou campanhas (abertas ou realizadas): o card dela ja responde.
 */
export function cardRecallAssociado(e: {
  sinal: string | null | undefined
  base: RecallBase | null | undefined
  pendente: boolean
  montadoraComCampanhas: boolean
}): CardRecallAssociado | null {
  if (!sinalPositivo(e.sinal) || e.pendente || e.montadoraComCampanhas) return null
  const camps = (e.base?.campanhas || []).filter((c) => c && (c.nome || c.codigo))
  // Chassi bate (firme) = "este veiculo"; so modelo/ano (suave) = "este modelo e ano".
  const firme = e.sinal === 'firme' || camps.some((c) => c.nivel === 'firme')
  return {
    titulo: firme ? 'Recall associado a este veículo' : 'Recall associado a este modelo e ano',
    itens: agruparCampanhas(camps).map((g) => ({
      nome: g.c.nome || 'Campanha de recall',
      meta: [
        g.c.codigo ? `Campanha ${g.c.codigo}` : null,
        anoDe(g.c.inicio) ? `iniciada em ${anoDe(g.c.inicio)}` : null,
        g.modelos || null,
      ].filter(Boolean).join(' · '),
    })),
    situacao: SITUACAO_RECALL_ASSOCIADO,
    fonte: 'Fonte: base de recalls das montadoras.',
    semDetalhe: !camps.length,
  }
}
