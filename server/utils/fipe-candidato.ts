// Melhor candidato FIPE pro relatorio PAGO (ver docs/feat-fipe-melhor-candidato.md).
//
// O problema real (OXK7426, Etios HB X 1.3): a wdapi devolveu so 3
// candidatos de score, todos Sedan 1.5 - a versao certa nem estava na
// lista. Aqui a gente monta um universo maior (nossa fipe-api) e aplica um
// funil deterministico (cilindrada->litragem, carroceria, versao) antes de
// recorrer a um LLM. So entra no jogo quando sobra mais de um candidato
// depois do funil; quando sobra exatamente um, a decisao e por REGRA, sem
// LLM nenhum.
//
// Fail-open TOTAL: qualquer erro (fipe-api fora do ar, Haiku fora/timeout,
// parse ruim) cai no comportamento de sempre - melhor score da wdapi - e so
// loga. Isto nunca pode quebrar a montagem do relatorio.

export interface FipeCandidato {
  codigo_fipe: string
  modelo: string
  valor: number | null
  texto_valor: string | null
  combustivel: string | null
  mes_referencia: string | null
}

export type FipeDecididoPor = 'regra' | 'haiku' | 'ambiguo' | 'fallback'

export interface FipeMelhorCandidatoResultado {
  escolhido: FipeCandidato | null
  decididoPor: FipeDecididoPor
  candidatos: FipeCandidato[]
  confianca?: 'alta' | 'media' | 'baixa'
  justificativa?: string
}

export interface FipeMelhorCandidatoInput {
  // registro cru do senatran_consultas.response[0] (ou equivalente)
  senatran: {
    cilindrada?: number | string | null
    potencia?: number | string | null
    descricaoMarcaModelo?: string | null
    anoModelo?: number | string | null
  } | null
  // payload cru da wdapi (fipe.dados[], VERSAO, marca, anoModelo, extra.combustivel)
  wdapi: any
  fipeApiUrl: string
  fipeApiToken: string
  anthropicApiKey?: string
}

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const HAIKU_TIMEOUT_MS = 3000

// ---------------------------------------------------------------------------
// Universo: fipe-api (marca/ano) UNIAO com os candidatos da wdapi.
// ---------------------------------------------------------------------------

function parseValorReais(texto: string | null | undefined): number | null {
  if (!texto) return null
  const n = Number(texto.replace(/[^\d,]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// null = a chamada falhou (fora do ar, timeout, resposta invalida) - sinal
// distinto de "[]" (chamou certinho e nao achou nada), pra quem chama saber
// que deve abortar o funil TODO e cair no fallback, em vez de tentar montar
// o universo so com os poucos candidatos da wdapi (que e exatamente o
// problema que a gente esta tentando resolver).
async function buscarUniversoFipeApi(
  marca: string,
  ano: string | number,
  fipeApiUrl: string,
  fipeApiToken: string,
): Promise<FipeCandidato[] | null> {
  if (!marca || !ano || !fipeApiUrl) return null
  const url = `${fipeApiUrl}/modelos?marca=${encodeURIComponent(marca)}&ano=${encodeURIComponent(String(ano))}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), HAIKU_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${fipeApiToken}` },
      signal: controller.signal,
    })
    if (!res.ok) return null
    const body = await res.json()
    const lista = Array.isArray(body?.data) ? body.data : []
    return lista
      .filter((item: any) => item?.codigo_fipe && item?.modelo)
      .map((item: any) => ({
        codigo_fipe: String(item.codigo_fipe),
        modelo: String(item.modelo),
        valor: typeof item.valor === 'number' ? item.valor : parseValorReais(String(item.valor ?? '')),
        texto_valor: null,
        combustivel: item.combustivel ?? null,
        mes_referencia: item.mes_referencia ?? null,
      }))
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function candidatosDaWdapi(wdapi: any): FipeCandidato[] {
  const dados = wdapi?.fipe?.dados
  if (!Array.isArray(dados)) return []
  return dados
    .filter((d: any) => d?.codigo_fipe && d?.texto_modelo)
    .map((d: any) => ({
      codigo_fipe: String(d.codigo_fipe),
      modelo: String(d.texto_modelo),
      valor: parseValorReais(d.texto_valor),
      texto_valor: d.texto_valor ?? null,
      combustivel: d.combustivel ?? null,
      mes_referencia: d.mes_referencia ?? null,
    }))
}

function unirUniverso(a: FipeCandidato[], b: FipeCandidato[]): FipeCandidato[] {
  const porCodigo = new Map<string, FipeCandidato>()
  // wdapi primeiro: se a fipe-api tiver o mesmo codigo, ela sobrescreve
  // (valor/mes_referencia mais fresco).
  for (const item of a) porCodigo.set(item.codigo_fipe, item)
  for (const item of b) porCodigo.set(item.codigo_fipe, { ...porCodigo.get(item.codigo_fipe), ...item })
  return [...porCodigo.values()]
}

function melhorScoreWdapi(wdapi: any): FipeCandidato | null {
  const dados = wdapi?.fipe?.dados
  if (!Array.isArray(dados) || !dados.length) return null
  const melhor = dados.reduce((best: any, item: any) => ((item?.score || 0) > (best?.score || 0) ? item : best), dados[0])
  if (!melhor?.codigo_fipe) return null
  return {
    codigo_fipe: String(melhor.codigo_fipe),
    modelo: String(melhor.texto_modelo || ''),
    valor: parseValorReais(melhor.texto_valor),
    texto_valor: melhor.texto_valor ?? null,
    combustivel: melhor.combustivel ?? null,
    mes_referencia: melhor.mes_referencia ?? null,
  }
}

// ---------------------------------------------------------------------------
// Funil deterministico
// ---------------------------------------------------------------------------

// Faixas de cilindrada (cc) -> litragem nominal, como aparece no nome FIPE
// ("1.0", "1.3", "1.5"...). Faixas com folga pra cobrir variacao entre
// fabricante/ano do mesmo motor nominal.
const FAIXAS_CILINDRADA: { min: number; max: number; label: string }[] = [
  { min: 0, max: 1050, label: '1.0' },
  { min: 1051, max: 1250, label: '1.2' },
  { min: 1251, max: 1350, label: '1.3' },
  { min: 1351, max: 1430, label: '1.4' },
  { min: 1431, max: 1520, label: '1.5' },
  { min: 1521, max: 1620, label: '1.6' },
  { min: 1621, max: 1850, label: '1.8' },
  { min: 1851, max: 2050, label: '2.0' },
  { min: 2051, max: 2450, label: '2.4' },
  { min: 2451, max: 3200, label: '3.0' },
]

function litragemDaCilindrada(cilindrada: unknown): string | null {
  const cc = Number(cilindrada)
  if (!Number.isFinite(cc) || cc <= 0) return null
  const faixa = FAIXAS_CILINDRADA.find((f) => cc >= f.min && cc <= f.max)
  return faixa?.label ?? null
}

type Carroceria = 'hatch' | 'sedan' | 'sw' | null

function carroceriaDaDescricao(descricaoMarcaModelo: unknown): Carroceria {
  const texto = String(descricaoMarcaModelo || '').toUpperCase()
  if (/\bSW\b|\bPERUA\b/.test(texto)) return 'sw'
  if (/\bSED\b|\bSEDAN\b/.test(texto)) return 'sedan'
  if (/\bHB\b|\bHATCH\b/.test(texto)) return 'hatch'
  return null
}

function candidatoESedan(modelo: string): boolean {
  return /\bSED\b|\bSEDAN\b/i.test(modelo)
}

function candidatoESw(modelo: string): boolean {
  return /\bSW\b|\bPERUA\b/i.test(modelo)
}

function candidatoTemLitragem(modelo: string, label: string): boolean {
  return modelo.includes(label)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function candidatoTemVersao(modelo: string, versao: string): boolean {
  const v = versao.trim()
  if (!v) return true
  const re = new RegExp(`\\b${escapeRegex(v)}\\b`, 'i')
  return re.test(modelo)
}

interface Fatos {
  litragem: string | null
  carroceria: Carroceria
  versao: string | null
}

function extrairFatos(senatran: FipeMelhorCandidatoInput['senatran'], wdapi: any): Fatos {
  const litragem = litragemDaCilindrada(senatran?.cilindrada)
  const carroceria = carroceriaDaDescricao(senatran?.descricaoMarcaModelo)
  const versaoBruta = typeof wdapi?.VERSAO === 'string' ? wdapi.VERSAO.trim() : null
  // versao generica demais pra discriminar sozinha (ex: vazia, "0", marca
  // repetida) - melhor nao filtrar do que filtrar tudo fora por engano.
  const versao = versaoBruta && versaoBruta.length >= 1 && versaoBruta.length <= 12 ? versaoBruta : null
  return { litragem, carroceria, versao }
}

function aplicarFunil(universo: FipeCandidato[], fatos: Fatos): FipeCandidato[] {
  let restantes = universo

  if (fatos.litragem) {
    const porLitragem = restantes.filter((c) => candidatoTemLitragem(c.modelo, fatos.litragem!))
    if (porLitragem.length) restantes = porLitragem
  }

  if (fatos.carroceria) {
    const porCarroceria = restantes.filter((c) => {
      if (fatos.carroceria === 'sedan') return candidatoESedan(c.modelo)
      if (fatos.carroceria === 'sw') return candidatoESw(c.modelo)
      // hatch: nem sedan, nem SW
      return !candidatoESedan(c.modelo) && !candidatoESw(c.modelo)
    })
    if (porCarroceria.length) restantes = porCarroceria
  }

  if (fatos.versao) {
    const porVersao = restantes.filter((c) => candidatoTemVersao(c.modelo, fatos.versao!))
    if (porVersao.length) restantes = porVersao
  }

  return restantes
}

// ---------------------------------------------------------------------------
// Juiz Haiku (so quando sobra >1 candidato)
// ---------------------------------------------------------------------------

interface HaikuVeredito {
  codigo_fipe: string
  confianca: 'alta' | 'media' | 'baixa'
  justificativa: string
}

function parseVereditoHaiku(texto: string): HaikuVeredito | null {
  try {
    const match = texto.match(/\{[\s\S]*\}/)
    if (!match) return null
    const obj = JSON.parse(match[0])
    if (!obj?.codigo_fipe || !obj?.confianca) return null
    if (!['alta', 'media', 'baixa'].includes(obj.confianca)) return null
    return {
      codigo_fipe: String(obj.codigo_fipe),
      confianca: obj.confianca,
      justificativa: String(obj.justificativa || ''),
    }
  } catch {
    return null
  }
}

async function julgarComHaiku(
  fatos: Fatos,
  senatran: FipeMelhorCandidatoInput['senatran'],
  wdapi: any,
  candidatos: FipeCandidato[],
  anthropicApiKey: string,
): Promise<HaikuVeredito | null> {
  const prompt = [
    'Voce e um perito em identificacao de versao de veiculo pela tabela FIPE.',
    'Dados oficiais do veiculo (SENATRAN + wdapi):',
    `- descricao SENATRAN: ${senatran?.descricaoMarcaModelo || 'desconhecida'}`,
    `- cilindrada: ${senatran?.cilindrada ?? 'desconhecida'}`,
    `- potencia: ${senatran?.potencia ?? 'desconhecida'}`,
    `- marca/modelo/submodelo/versao (wdapi): ${wdapi?.marca || ''} / ${wdapi?.MODELO || ''} / ${wdapi?.SUBMODELO || ''} / ${wdapi?.VERSAO || ''}`,
    `- ano modelo: ${wdapi?.anoModelo ?? senatran?.anoModelo ?? 'desconhecido'}`,
    `- combustivel (wdapi): ${wdapi?.extra?.combustivel || 'desconhecido'}`,
    '',
    'Candidatos da tabela FIPE (ja pre-filtrados por cilindrada/carroceria/versao):',
    ...candidatos.map((c) => `- codigo_fipe=${c.codigo_fipe} | ${c.modelo} | valor=${c.valor ?? 'desconhecido'}`),
    '',
    'Escolha o candidato que melhor corresponde aos dados oficiais. Responda',
    'APENAS com um JSON no formato exato:',
    '{"codigo_fipe": "...", "confianca": "alta"|"media"|"baixa", "justificativa": "..."}',
    'Use "confianca":"baixa" se nao tiver certeza suficiente pra decidir entre os candidatos.',
  ].join('\n')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), HAIKU_TIMEOUT_MS)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 300,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const body = await res.json()
    const texto = body?.content?.[0]?.text
    if (typeof texto !== 'string') return null
    return parseVereditoHaiku(texto)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------------
// Orquestracao
// ---------------------------------------------------------------------------

export async function escolherMelhorFipe(input: FipeMelhorCandidatoInput): Promise<FipeMelhorCandidatoResultado> {
  const fallback = (): FipeMelhorCandidatoResultado => ({
    escolhido: melhorScoreWdapi(input.wdapi),
    decididoPor: 'fallback',
    candidatos: [],
  })

  try {
    const marca = input.wdapi?.marca || input.wdapi?.MARCA
    const ano = input.wdapi?.anoModelo || input.senatran?.anoModelo
    if (!marca || !ano) return fallback()

    const universoFipeApi = await buscarUniversoFipeApi(marca, ano, input.fipeApiUrl, input.fipeApiToken)
    if (universoFipeApi === null) {
      // fipe-api fora do ar: sem universo confiavel, nao vale a pena rodar o
      // funil so com os (poucos) candidatos da wdapi.
      return fallback()
    }
    const universoWdapi = candidatosDaWdapi(input.wdapi)
    const universo = unirUniverso(universoWdapi, universoFipeApi)
    if (!universo.length) return fallback()

    const fatos = extrairFatos(input.senatran, input.wdapi)
    const filtrados = aplicarFunil(universo, fatos)

    if (filtrados.length === 0) return fallback()

    if (filtrados.length === 1) {
      return { escolhido: filtrados[0], decididoPor: 'regra', candidatos: filtrados, confianca: 'alta' }
    }

    if (!input.anthropicApiKey) {
      // Sem juiz disponivel e mais de um candidato: ambiguidade honesta em
      // vez de chute - mostra shortlist, nao decide sozinho.
      return { escolhido: null, decididoPor: 'ambiguo', candidatos: filtrados.slice(0, 5) }
    }

    const veredito = await julgarComHaiku(fatos, input.senatran, input.wdapi, filtrados.slice(0, 8), input.anthropicApiKey)
    if (!veredito) {
      // Haiku fora do ar/timeout/parse ruim: fail-open pro comportamento antigo.
      return fallback()
    }

    const escolhido = filtrados.find((c) => c.codigo_fipe === veredito.codigo_fipe) || null
    if (!escolhido) return fallback()

    if (veredito.confianca === 'baixa') {
      return {
        escolhido,
        decididoPor: 'ambiguo',
        candidatos: filtrados.slice(0, 5),
        confianca: 'baixa',
        justificativa: veredito.justificativa,
      }
    }

    return {
      escolhido,
      decididoPor: 'haiku',
      candidatos: filtrados,
      confianca: veredito.confianca,
      justificativa: veredito.justificativa,
    }
  } catch (err) {
    console.error('[fipe-candidato] erro inesperado, caindo no fallback:', err)
    return fallback()
  }
}
