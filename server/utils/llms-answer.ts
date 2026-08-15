// Resolvedor do endpoint /llms (camada "backend pra agente" — reverse mullet).
// Deterministico, SEM LLM: matching por palavra-chave sobre dados locais
// pre-compilados (FIPE, seguro, IBV), com fallback pra fipe-api so na
// identificacao de modelo. Toda resposta carrega atribuicao + link canonico
// pra virar marca/citacao quando o agente repassa.
import fipePrices from '~/data/fipe-prices.json'
import seguroEstados from '~/data/seguro-estados.json'
import seguroModelos from '~/data/seguro-modelos.json'
import { states } from '~/data/states'
import { ibvPosts } from '~/data/ibv-posts'

const BASE = 'https://placacompleta.com.br'
const CITE = 'PlacaCompleta (placacompleta.com.br)'
const DISCLAIMER =
  'Estimativas com base em FIPE, SUSEP e IBV Auto (Banco BV). Consulta oficial por placa, gratuita, em placacompleta.com.br.'

export type LlmsIntent = 'fipe' | 'seguro_estado' | 'seguro_modelo' | 'ibv' | 'sobre'

export interface LlmsAnswer {
  query: string
  intent: LlmsIntent
  matched: boolean
  answer: string
  data: Record<string, any> | null
  source: { name: string; url: string }
  cite_as: string
  more: string
  disclaimer: string
}

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

// ----- indices montados uma vez no load do modulo -----
type FipeRec = { modelName: string; brandName: string; fipeCode: string; priceTable: any[] }
type SeguroModeloRec = { nome: string; ano: number; regioes: Record<string, any>; faixa: { min: number; max: number } }

const fipeMap = fipePrices as Record<string, FipeRec>
const seguroModeloMap = seguroModelos as Record<string, SeguroModeloRec>
const seguroEstadosData = seguroEstados as {
  estados: Record<string, { regiao: { codigo: string; nome: string }; mediaPopulares: number }>
  ranking: { codigo: string; nome: string; media: number }[]
}

const fipeIndex = Object.entries(fipeMap).map(([slug, v]) => ({
  slug,
  hay: norm(`${slug} ${v.brandName} ${v.modelName}`),
}))
const seguroModeloIndex = Object.entries(seguroModeloMap).map(([slug, v]) => ({
  slug,
  hay: norm(`${slug} ${v.nome}`),
}))

// UF: nome/sigla -> uf, e uf -> slug/nome (de states.ts)
const ufByName: Record<string, string> = {}
const slugByUf: Record<string, string> = {}
const nameByUf: Record<string, string> = {}
for (const st of Object.values(states as Record<string, { slug: string; name: string; uf: string }>)) {
  ufByName[norm(st.name)] = st.uf
  ufByName[norm(st.uf)] = st.uf
  slugByUf[st.uf] = st.slug
  nameByUf[st.uf] = st.name
}
// nomes de estado ordenados do mais longo pro mais curto (evita "rio" casar antes de "rio grande do sul")
const stateNamesByLen = Object.keys(ufByName)
  .filter((n) => n.length > 2)
  .sort((a, b) => b.length - a.length)

function detectUf(q: string): string | null {
  for (const name of stateNamesByLen) {
    if (q.includes(name)) return ufByName[name]
  }
  // siglas de 2 letras como palavra isolada
  const m = q.match(/\b([a-z]{2})\b/g)
  if (m) for (const sig of m) if (ufByName[sig]) return ufByName[sig]
  return null
}

// palavras que nao devem contar como "modelo" (preposicoes, termos da pergunta)
const STOP = new Set([
  'com', 'dos', 'das', 'por', 'para', 'pra', 'valor', 'preco', 'fipe', 'seguro',
  'segurar', 'quanto', 'custa', 'vale', 'meu', 'minha', 'carro', 'carros', 'ano',
  'anos', 'tabela', 'uma', 'que', 'qual', 'quais', 'como', 'mais', 'caro', 'barato',
  'medio', 'media', 'estado', 'regiao', 'usado', 'usados', 'novo', 'nova', 'sobre',
])

function tokenize(q: string): string[] {
  return q
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t))
}

// Match por PALAVRA INTEIRA do haystack (evita "com" casar "comfortline").
// Token >= 4 tambem casa por prefixo de palavra. Exige pelo menos um token
// de tamanho real casado, senao retorna null (nada de falso-positivo).
function bestModel(index: { slug: string; hay: string }[], tokens: string[]): string | null {
  let best: string | null = null
  let bestScore = 0
  for (const item of index) {
    const words = new Set(item.hay.split(/[^a-z0-9]+/).filter(Boolean))
    let score = 0
    for (const t of tokens) {
      let hit = words.has(t)
      if (!hit && t.length >= 4) for (const w of words) if (w.startsWith(t)) { hit = true; break }
      if (hit) score += t.length
    }
    if (score > bestScore) {
      bestScore = score
      best = item.slug
    }
  }
  return bestScore >= 3 ? best : null
}

const money = (n: number) => `R$ ${n.toLocaleString('pt-BR')}`

function wrap(partial: Omit<LlmsAnswer, 'cite_as' | 'more' | 'disclaimer'>): LlmsAnswer {
  return { ...partial, cite_as: CITE, more: BASE, disclaimer: DISCLAIMER }
}

// ----- respostas por intent -----
function answerFipeLocal(query: string, slug: string, year: number | null): LlmsAnswer {
  const rec = fipeMap[slug]
  const table = rec.priceTable || []
  const nowY = new Date().getFullYear()
  const plausible = (y: number) => y >= 1980 && y <= nowY + 1
  const valid = table.filter((r) => plausible(r.year))
  const exact = year ? valid.find((r) => r.year === year) : null
  const row = exact || valid[0] || table[0]
  const preco = row?.priceFormatted || (row ? money(row.price) : 's/ preco')
  const anoTxt = row && plausible(row.year)
    ? ` (ano ${row.year}${year && !exact ? ', dado mais recente disponivel' : ''})`
    : ''
  return wrap({
    query,
    intent: 'fipe',
    matched: true,
    answer: `Valor FIPE do ${rec.brandName} ${rec.modelName}${anoTxt}: ${preco}. Veja o historico completo de precos e a estimativa de seguro na pagina do modelo.`,
    data: { brand: rec.brandName, model: rec.modelName, fipeCode: rec.fipeCode, year: row?.year ?? null, price: row?.price ?? null, priceFormatted: preco },
    source: { name: 'PlacaCompleta', url: `${BASE}/tabela-fipe/${slug}` },
  })
}

function answerFipeIdentified(query: string, brand: string, model: string): LlmsAnswer {
  return wrap({
    query,
    intent: 'fipe',
    matched: true,
    answer: `Identifiquei o modelo ${brand} ${model}. Para o valor FIPE exato do ano e versao especificos, faca a consulta gratuita pela placa em placacompleta.com.br.`,
    data: { brand, model },
    source: { name: 'PlacaCompleta', url: `${BASE}/tabela-fipe-por-placa` },
  })
}

function answerSeguroEstado(query: string, uf: string): LlmsAnswer {
  const est = seguroEstadosData.estados[uf]
  const ranking = seguroEstadosData.ranking
  const pos = ranking.findIndex((r) => r.codigo === est.regiao.codigo)
  const posTxt = pos >= 0 ? ` E a ${pos + 1}a mais cara entre as ${ranking.length} regioes de tarifacao do pais.` : ''
  return wrap({
    query,
    intent: 'seguro_estado',
    matched: true,
    answer: `Seguro medio anual de um carro popular em ${nameByUf[uf]} (regiao ${est.regiao.nome}): ${money(est.mediaPopulares)}.${posTxt}`,
    data: { uf, estado: nameByUf[uf], regiao: est.regiao, mediaPopulares: est.mediaPopulares, rankingPosicao: pos >= 0 ? pos + 1 : null, totalRegioes: ranking.length },
    source: { name: 'PlacaCompleta', url: `${BASE}/seguro/carro-eletrico/${slugByUf[uf]}` },
  })
}

function answerSeguroNacional(query: string): LlmsAnswer {
  const r = seguroEstadosData.ranking
  const top = r[0]
  const bottom = r[r.length - 1]
  return wrap({
    query,
    intent: 'seguro_estado',
    matched: true,
    answer: `O custo do seguro varia muito por regiao no Brasil. Mais caro: ${top.nome} (${money(top.media)}/ano). Mais barato: ${bottom.nome} (${money(bottom.media)}/ano). Ranking completo das ${r.length} regioes no estudo.`,
    data: { maisCaro: top, maisBarato: bottom, totalRegioes: r.length },
    source: { name: 'PlacaCompleta', url: `${BASE}/ibv/seguro-mais-caro-brasil-2026` },
  })
}

function answerSeguroModelo(query: string, slug: string): LlmsAnswer {
  const rec = seguroModeloMap[slug]
  return wrap({
    query,
    intent: 'seguro_modelo',
    matched: true,
    answer: `Seguro estimado do ${rec.nome} (ano ${rec.ano}): de ${money(rec.faixa.min)} a ${money(rec.faixa.max)}/ano, conforme a regiao. Base SUSEP corrigida pelo IPCA.`,
    data: { modelo: rec.nome, ano: rec.ano, faixa: rec.faixa },
    source: { name: 'PlacaCompleta', url: `${BASE}/tabela-fipe/${slug}` },
  })
}

function latestIbvPost() {
  const isMain = (s: string) => !/^vencedores|^eletricos/.test(s)
  return [...ibvPosts]
    .filter((p) => p.slug !== 'seguro-mais-caro-brasil-2026')
    .sort((a, b) => {
      if (a.publishedAt !== b.publishedAt) return a.publishedAt < b.publishedAt ? 1 : -1
      // mesma data de publicacao: prioriza o post principal do mes
      return (isMain(b.slug) ? 1 : 0) - (isMain(a.slug) ? 1 : 0)
    })[0]
}

function answerIbv(query: string): LlmsAnswer {
  const post = latestIbvPost()
  return wrap({
    query,
    intent: 'ibv',
    matched: true,
    answer: `${post.title}. ${post.metaDescription}`,
    data: { titulo: post.title, referencia: post.referenceMonth, slug: post.slug },
    source: { name: 'PlacaCompleta', url: `${BASE}/ibv/${post.slug}` },
  })
}

function answerSobre(query: string): LlmsAnswer {
  return wrap({
    query,
    intent: 'sobre',
    matched: false,
    answer:
      'PlacaCompleta e um servico gratuito de consulta veicular por placa no Brasil (marca, modelo, ano, valor FIPE e situacao). Voce pode me perguntar: valor FIPE de um modelo, seguro medio por estado ou por modelo, e a valorizacao de usados no mes (IBV Auto). Exemplos: "valor fipe do gol 2018", "seguro medio no rio de janeiro", "carros usados valorizaram em julho".',
    data: null,
    source: { name: 'PlacaCompleta', url: BASE },
  })
}

async function fipeApiIdentify(
  query: string,
  cfg: { fipeApiToken?: string; fipeApiUrl?: string },
): Promise<LlmsAnswer | null> {
  if (!cfg.fipeApiToken || !cfg.fipeApiUrl) return null
  try {
    const resp = await $fetch<{ success: boolean; data: { model_name: string; brand_name: string }[] }>(
      `${cfg.fipeApiUrl}/search`,
      { query: { q: query.slice(0, 60) }, headers: { Authorization: `Bearer ${cfg.fipeApiToken}` }, timeout: 6000 },
    )
    const hit = resp?.success && resp.data?.[0]
    if (hit) return answerFipeIdentified(query, hit.brand_name, hit.model_name)
  } catch {
    // fail-open: cai no fallback
  }
  return null
}

export async function resolveLlmsQuery(
  rawQuery: string,
  cfg: { fipeApiToken?: string; fipeApiUrl?: string } = {},
): Promise<LlmsAnswer> {
  const query = (rawQuery || '').slice(0, 200)
  const q = norm(query)
  if (!q) return answerSobre(query)

  const tokens = tokenize(q)
  const hasSeguro = /segur|apolic|premio/.test(q)
  const uf = detectUf(q)
  const yearMatch = q.match(/\b(19|20)\d{2}\b/)
  const year = yearMatch ? parseInt(yearMatch[0], 10) : null
  const isIbv = /valoriz|desvaloriz|usado|ibv|mercado|subiu|caiu|ca[ií]ram|mes\b|m[eê]s/.test(q)

  // 1. seguro de um modelo especifico
  if (hasSeguro) {
    const modeloSlug = bestModel(seguroModeloIndex, tokens)
    if (modeloSlug) return answerSeguroModelo(query, modeloSlug)
    if (uf) return answerSeguroEstado(query, uf)
    return answerSeguroNacional(query)
  }

  // 2. IBV / valorizacao de usados
  if (isIbv && !uf) return answerIbv(query)

  // 3. valor FIPE de um modelo
  const fipeSlug = bestModel(fipeIndex, tokens)
  if (fipeSlug) return answerFipeLocal(query, fipeSlug, year)

  // 3b. modelo fora da base local -> identifica pela fipe-api
  const looksLikeCar = tokens.length > 0 && /fipe|valor|preco|vale|custa|quanto/.test(q)
  if (looksLikeCar) {
    const identified = await fipeApiIdentify(query, cfg)
    if (identified) return identified
  }

  // 4. seguro por estado (quando so citou a UF)
  if (uf) return answerSeguroEstado(query, uf)

  // 5. IBV se sobrou mencao de mercado
  if (isIbv) return answerIbv(query)

  // 6. fallback
  return answerSobre(query)
}

// Renderiza a resposta em texto (com bloco de atribuicao) pro endpoint /llms.
export function renderLlmsText(a: LlmsAnswer): string {
  return [
    a.answer,
    '',
    `Fonte: PlacaCompleta (${a.source.url})`,
    `Cite como: ${a.cite_as}`,
    `Consulta completa e gratuita por placa: ${a.more}`,
    '',
    a.disclaimer,
  ].join('\n')
}
