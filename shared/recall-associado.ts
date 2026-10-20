// "Recall associado a este veiculo" no relatorio pago (pedido do Cesar, 14/out).
//
// Quem comprou pelo hook de recall da consulta gratis (a base de recalls achou
// campanha pro chassi ou pro modelo/ano) precisa saber QUAL recall era, mesmo
// quando hoje nada consta como pendente. Antes o relatorio so dizia "sem recall
// pendente" e a pessoa ficava sem resposta.
//
// Regra de copy: a base sabe que o carro CONSTA numa campanha, nunca se ja foi
// atendido. Nao afirmar que foi feito; sem travessao.

import { agrupamentoValido, type AgrupamentoRecall } from './recall-agrupamento'

export interface CampanhaBase {
  codigo: string | null
  nome: string | null
  modelo: string | null
  ano_modelo: string | number | null
  inicio: string | null
  nivel: 'firme' | 'suave'
  // Detalhe da campanha (leiloes-api, 15/out), quando vier. Snapshot antigo: ausente.
  risco?: string | null
  oQueFazer?: string | null
  /** Inicio e fim do periodo de fabricacao afetado: 'AAAA-MM-DD', 'AAAA-MM' ou 'AAAA'. */
  fabricacaoDe?: string | null
  fabricacaoAte?: string | null
}

export interface RecallBase {
  consultado: boolean
  /** Campanhas parecidas agrupadas pelo agente (shared/recall-agrupamento.ts). Ausente/null = lista original. */
  agrupado?: AgrupamentoRecall | null
  /** Sinal da consulta gratis que a pessoa viu: firme (chassi) ou suave (modelo/ano). */
  sinal: 'firme' | 'suave' | null
  fonte: 'base_recalls'
  campanhas: CampanhaBase[]
}

export interface ItemRecallAssociado {
  nome: string
  meta: string
  risco?: string | null
  oQueFazer?: string | null
  fabricacao?: string | null
  /** Grupo do agente: frase leiga e as campanhas originais (o "ver as N campanhas"). */
  resumo?: string | null
  campanhas?: { nome: string; meta: string }[]
}

export interface CardRecallAssociado {
  titulo: string
  itens: ItemRecallAssociado[]
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

// ---------- periodo de fabricacao da campanha ----------

/** 'AAAA-MM-DD' | 'AAAA-MM' | 'AAAA' -> { ano, mes?, dia? }. */
function partesData(v: string | null | undefined): { ano: number; mes: number | null; dia: number | null } | null {
  const m = String(v ?? '').trim().match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/)
  if (!m) return null
  return { ano: Number(m[1]), mes: m[2] ? Number(m[2]) : null, dia: m[3] ? Number(m[3]) : null }
}
function dataLegivel(p: { ano: number; mes: number | null; dia: number | null }): string {
  if (p.dia && p.mes) return `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}/${p.ano}`
  if (p.mes) return `${String(p.mes).padStart(2, '0')}/${p.ano}`
  return String(p.ano)
}

/**
 * "Veículos fabricados entre X e Y", e so quando o ANO de fabricacao do carro
 * permite concluir, ", fabricado em 2015, dentro do período da campanha".
 * O cadastro so tem o ano: num ano de borda com mes/dia (ex.: campanha a partir
 * de 06/2015, carro de 2015) nao da pra saber, e ai nao afirma nada.
 */
export function textoFabricacao(de: string | null | undefined, ate: string | null | undefined, anoFab: unknown): string | null {
  const a = partesData(de), b = partesData(ate)
  if (!a && !b) return null
  const faixa = a && b ? `Campanha para veículos fabricados entre ${dataLegivel(a)} e ${dataLegivel(b)}`
    : a ? `Campanha para veículos fabricados a partir de ${dataLegivel(a)}`
      : `Campanha para veículos fabricados até ${dataLegivel(b!)}`
  const ano = Number(anoFab)
  if (!Number.isInteger(ano) || ano < 1950) return faixa
  // Dentro com certeza: o ano inteiro do carro cabe no periodo.
  const iniOk = !a || ano > a.ano || (ano === a.ano && (a.mes == null || (a.mes === 1 && (a.dia == null || a.dia === 1))))
  const fimOk = !b || ano < b.ano || (ano === b.ano && (b.mes == null || (b.mes === 12 && (b.dia == null || b.dia === 31))))
  return iniOk && fimOk ? `${faixa}; fabricado em ${ano}, dentro do período da campanha` : faixa
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
  /** Ano de fabricacao do veiculo (cadastro), pra comparar com o periodo da campanha. */
  anoFabricacao?: string | number | null
}): CardRecallAssociado | null {
  if (!sinalPositivo(e.sinal) || e.pendente || e.montadoraComCampanhas) return null
  const camps = (e.base?.campanhas || []).filter((c) => c && (c.nome || c.codigo))
  // Chassi bate (firme) = "este veiculo"; so modelo/ano (suave) = "este modelo e ano".
  const firme = e.sinal === 'firme' || camps.some((c) => c.nivel === 'firme')
  const itemDe = (c: CampanhaBase, modelos: string): ItemRecallAssociado => ({
    nome: c.nome || 'Campanha de recall',
    meta: [
      c.codigo ? `Campanha ${c.codigo}` : null,
      anoDe(c.inicio) ? `iniciada em ${anoDe(c.inicio)}` : null,
      modelos || null,
    ].filter(Boolean).join(' · '),
    ...(c.risco ? { risco: c.risco } : {}),
    ...(c.oQueFazer ? { oQueFazer: c.oQueFazer } : {}),
    ...(textoFabricacao(c.fabricacaoDe, c.fabricacaoAte, e.anoFabricacao) ? { fabricacao: textoFabricacao(c.fabricacaoDe, c.fabricacaoAte, e.anoFabricacao) } : {}),
  })
  // Agrupamento do agente (so se cobre a lista inteira, um indice por grupo).
  const grupos = camps.length === (e.base?.campanhas || []).length ? agrupamentoValido(e.base?.agrupado, camps.length) : null
  if (grupos) {
    return {
      titulo: firme ? 'Recall associado a este veículo' : 'Recall associado a este modelo e ano',
      itens: grupos.map((g) => {
        const membros = g.indices.map((i) => camps[i])
        if (membros.length === 1) {
          const c = membros[0]
          return itemDe(c, [c.modelo, c.ano_modelo].filter((v) => v != null && v !== '').join(' '))
        }
        return {
          nome: g.titulo,
          meta: [`${membros.length} campanhas`, [g.modelo, g.anos ? `modelos ${g.anos}` : null].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
          ...(g.resumo ? { resumo: g.resumo } : {}),
          campanhas: membros.map((c) => itemDe(c, [c.modelo, c.ano_modelo].filter((v) => v != null && v !== '').join(' '))).map((x) => ({ nome: x.nome, meta: x.meta })),
        }
      }),
      situacao: SITUACAO_RECALL_ASSOCIADO,
      fonte: 'Fonte: base de recalls das montadoras.',
      semDetalhe: false,
    }
  }
  return {
    titulo: firme ? 'Recall associado a este veículo' : 'Recall associado a este modelo e ano',
    itens: agruparCampanhas(camps).map((g) => ({
      nome: g.c.nome || 'Campanha de recall',
      meta: [
        g.c.codigo ? `Campanha ${g.c.codigo}` : null,
        anoDe(g.c.inicio) ? `iniciada em ${anoDe(g.c.inicio)}` : null,
        g.modelos || null,
      ].filter(Boolean).join(' · '),
      // So quando vierem: sem eles o item fica igual ao de antes.
      ...(g.c.risco ? { risco: g.c.risco } : {}),
      ...(g.c.oQueFazer ? { oQueFazer: g.c.oQueFazer } : {}),
      ...(textoFabricacao(g.c.fabricacaoDe, g.c.fabricacaoAte, e.anoFabricacao) ? { fabricacao: textoFabricacao(g.c.fabricacaoDe, g.c.fabricacaoAte, e.anoFabricacao) } : {}),
    })),
    situacao: SITUACAO_RECALL_ASSOCIADO,
    fonte: 'Fonte: base de recalls das montadoras.',
    semDetalhe: !camps.length,
  }
}
