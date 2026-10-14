import { alertarFalhaHaiku } from './alerta-haiku'
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

import { marcaExibicao } from '../../shared/marca-exibicao'
import { codigoDaTabela, type TabelaFipe } from '../../shared/tabela-fipe'
import { cambioDoNome, versaoFipeManual, versaoFipeAutomatica, opcoesDeCambio } from '../../shared/cambio-nome'
import { cambioPeloChassi } from '../../shared/cambio-chassi'
import { filtrarPelaVersaoDoNome, filtrarPeloModeloDoNome, filtrarPeloNomeDoVeiculo, versaoDoNome, candidatoTemVersaoDoNome, siglasParaPrompt } from '../../shared/versao-fipe'

export { codigoDaTabela, type TabelaFipe }

export interface FipeCandidato {
  codigo_fipe: string
  modelo: string
  valor: number | null
  texto_valor: string | null
  combustivel: string | null
  mes_referencia: string | null
  // Identificador interno da fipe-api usado por /models/fipe/{codigo_modelo}
  // /price-history - NAO e o mesmo numero que codigo_fipe (ex: codigo_fipe
  // "002122-9" tem codigo_modelo "6246"). So vem de graca quando o candidato
  // e da wdapi; quando vem do universo da fipe-api (/modelos, que nao expoe
  // esse campo) e resolvido sob demanda so pro escolhido, ver
  // resolverCodigoModelo().
  codigoModelo?: string | null
}

export type FipeDecididoPor = 'regra' | 'haiku' | 'ambiguo' | 'fallback' | 'wdapi'

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
    // Codigo de combustivel do registro: desempata so diesel/eletrico (claros).
    codigoCombustivel?: number | string | null
    // So pra saber se e moto: o funil de carro (litragem, carroceria, cambio)
    // nao vale pra duas rodas.
    descricaoTipoVeiculo?: string | null
    descricaoEspecie?: string | null
    // Camada 2: cambio de um sinal externo (recall), usado so quando a descricao
    // do registro nao traz MT/AT.
    transmissaoHint?: 'manual' | 'automatico' | null
    /** Chassi (camada 2: cambio pelo prefixo, so pra desempate de cambio). */
    chassi?: string | null
  } | null
  // payload cru da wdapi (fipe.dados[], VERSAO, marca, anoModelo, extra.combustivel)
  wdapi: any
  /** Segmento ja decidido (server/utils/segmento.ts). Escolhe a tabela FIPE. */
  segmento?: string | null
  fipeApiUrl: string
  fipeApiToken: string
  anthropicApiKey?: string
  /** Token do pedido, so pra o alerta de falha do Haiku (nunca vai pro prompt). */
  pedidoToken?: string | null
}

// Haiku 5.5 (pedido do Cesar, 10/out). Nele `temperature` da 400 (deprecated)
// e o thinking vem ligado por padrao (content[0] vira um bloco 'thinking' e os
// tokens acabam pensando): por isso sem temperature, thinking desligado e o
// texto lido do bloco 'text', onde quer que ele esteja.
export const HAIKU_MODEL = 'claude-haiku-5-5'
// Com thinking desligado ele responde em ~1,6 s; 5 s da folga sem segurar a
// entrega (HSX1F20: 3 s estourava no modelo anterior).
export const HAIKU_TIMEOUT_MS = 5000
// fipe-api tem timeout proprio: a frio ela passou de 3 s, o funil caia no
// fallback e o valor virava o melhor score da fonte livre.
export const FIPE_API_TIMEOUT_MS = 8000

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
  const timeout = setTimeout(() => controller.abort(), FIPE_API_TIMEOUT_MS)
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

// ---------------------------------------------------------------------------
// Tabela FIPE (carros, motos, caminhoes).
//
// A FIPE tem tres tabelas e o codigo FIPE diz de qual e: carros comecam com 0,
// motos com 8, caminhoes e onibus com 5. A busca por marca na fipe-api mistura
// as tabelas quando o nome coincide (HONDA traz moto e carro), e o apelido de
// marca leva pra tabela de carros ("VW" vira "VW - VolksWagen"). Foi assim que
// um caminhao VW 24.280 (PUF7J27) saiu com o valor de um Touareg. Por isso o
// universo inteiro, inclusive os candidatos da fonte livre, passa pelo filtro
// da tabela certa.
// ---------------------------------------------------------------------------

const RE_TIPO_MOTO = /MOTOCICLETA|MOTONETA|CICLOMOTOR|TRICICLO|QUADRICICLO|SCOOTER|\bMOTO\b/i
const RE_TIPO_CAMINHAO = /CAMINH[AÃ]O|[OÔ]NIBUS|MICRO-?[OÔ]NIBUS|CAVALO MEC|TRATOR/i

/**
 * Tabela FIPE do veiculo. O tipo do registro manda (CAMINHAO, CAMINHAO TRATOR,
 * ONIBUS -> caminhoes; MOTOCICLETA, MOTONETA, CICLOMOTOR -> motos); depois o
 * segmento ja decidido; o resto e carro (inclusive CAMINHONETE, que na FIPE e
 * tabela de carros).
 */
export function tabelaFipe(
  senatran: FipeMelhorCandidatoInput['senatran'],
  wdapi?: any,
  segmento?: string | null,
): TabelaFipe {
  const tipo = `${senatran?.descricaoTipoVeiculo ?? ''} ${senatran?.descricaoEspecie ?? ''}`
  if (RE_TIPO_CAMINHAO.test(tipo)) return 'caminhoes'
  if (RE_TIPO_MOTO.test(tipo)) return 'motos'
  if (segmento === 'caminhao') return 'caminhoes'
  if (segmento === 'moto') return 'motos'
  const fonte = `${wdapi?.segmento ?? ''} ${wdapi?.sub_segmento ?? ''} ${wdapi?.extra?.tipo_veiculo ?? ''} ${wdapi?.extra?.segmento ?? ''}`
  if (RE_TIPO_CAMINHAO.test(fonte)) return 'caminhoes'
  if (ehMoto(senatran, wdapi)) return 'motos'
  return 'carros'
}

const soAlnum = (t: string) => t.toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * Algum pedaco do nome FIPE casa com o nome do modelo ("24.280" ~ "24-280",
 * "L 2638" ~ "L-2638"). Nome so com numero ("2638") tambem casa como sufixo de
 * prefixo curto ("L-2638", "LK-2638", "LS-2638"): ai quem desempata e o nome
 * composto com a letra (ver nomesDoModelo).
 */
function nomeCasa(modelo: string, nome: string): boolean {
  const n = soAlnum(nome)
  if (!n) return false
  return String(modelo || '').split(/\s+/).some((t) => {
    const a = soAlnum(t)
    if (a === n || (a.startsWith(n) && /\d$/.test(n))) return true
    return /^\d{3,}$/.test(n) && /^[A-Z]{1,3}\d+$/.test(a) && a.endsWith(n)
  })
}

/**
 * Nomes do modelo pra casar com a FIPE, do mais especifico ao mais geral.
 * Caminhao: "M.BENZ/L 2638" -> ["L2638", "2638"]; "M.BENZ/LS 2638" ->
 * ["LS2638", "2638"] (prefixo de ate 3 letras + numero). Caso CYU7D91: o "L"
 * sumia e o nome virava "2638", que nao casava com "L-2638".
 */
export function nomesDoModelo(tokens: string[]): string[] {
  const [a, b] = tokens
  if (a && b && /^[A-Z]{1,3}$/.test(a) && /^\d{3,5}$/.test(b)) return [a + b, b]
  return a ? [a] : []
}

/**
 * Candidato serve pra este veiculo? Da tabela certa, sempre. Da tabela de
 * carros num caminhao, so se o nome bater: van e caminhao leve (Master, HR,
 * Bongo) sao registrados como CAMINHAO mas estao na tabela de carros da FIPE.
 * Moto nunca aceita outra tabela.
 */
export function candidatoDaTabela(
  codigo: string | null | undefined,
  modelo: string | null | undefined,
  tabela: TabelaFipe,
  nomeModelo: string | null | undefined,
): boolean {
  if (codigoDaTabela(codigo, tabela)) return true
  if (tabela !== 'caminhoes' || !nomeModelo) return false
  return codigoDaTabela(codigo, 'carros') && nomeCasa(String(modelo || ''), nomeModelo)
}

/** Nome do modelo no registro: "VW/24.280 CRM 6X2" -> "24.280". */
export function nomeDoModelo(senatran: FipeMelhorCandidatoInput['senatran'], wdapi?: any): string | null {
  const t = tokensDoModelo(senatran?.descricaoMarcaModelo || wdapi?.MODELO)
  // Prefixo de 1 letra + numero ("L 2638", "F 4000"): o nome e o composto.
  if (t[0]?.length === 1 && /^\d{3,5}$/.test(t[1] || '')) return t[0] + t[1]
  return t[0] || null
}

function soDaTabela<T extends { codigo_fipe: string; modelo: string }>(lista: T[], tabela: TabelaFipe, nome: string | null): T[] {
  return lista.filter((c) => candidatoDaTabela(c.codigo_fipe, c.modelo, tabela, nome))
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
      codigoModelo: d.codigo_modelo ? String(d.codigo_modelo) : null,
    }))
}

// ---------------------------------------------------------------------------
// Resolucao lazy do codigo_modelo (so pro escolhido, so quando falta).
// /brands e /brands/{id}/models nao mudam com frequencia - cache em memoria
// do processo e suficiente, fail-open (null) em qualquer erro.
// ---------------------------------------------------------------------------

// Marcas da fipe-api com o tipo de veiculo (1 carros, 2 motos, 3 caminhoes).
// O NOME sozinho colide entre tabelas ("Honda" carros x "HONDA" motos,
// "Fiat" x "FIAT"): o cache antigo por nome em minusculas guardava so uma
// delas, e a PCX 150 (FZK5F28) ficou sem historico e sem seguro.
type MarcaFipe = { id: number; nome: string; tipo: number | null }
const marcasCache = new Map<string, { em: number; lista: MarcaFipe[] }>()
const TTL_MARCAS = 12 * 60 * 60 * 1000
const TIPO_DA_TABELA: Record<TabelaFipe, number> = { carros: 1, motos: 2, caminhoes: 3 }

async function marcasFipe(fipeApiUrl: string, fipeApiToken: string): Promise<MarcaFipe[]> {
  const hit = marcasCache.get(fipeApiUrl)
  if (hit && Date.now() - hit.em < TTL_MARCAS) return hit.lista
  const res = await fetch(`${fipeApiUrl}/brands`, { headers: { Authorization: `Bearer ${fipeApiToken}` } })
  if (!res.ok) return []
  const body = await res.json()
  const lista: MarcaFipe[] = (Array.isArray(body?.data) ? body.data : [])
    .filter((b: any) => typeof b?.name === 'string' && typeof b?.id === 'number')
    .map((b: any) => ({ id: b.id, nome: b.name.trim().toLowerCase(), tipo: typeof b.vehicle_type === 'number' ? b.vehicle_type : null }))
  if (lista.length) marcasCache.set(fipeApiUrl, { em: Date.now(), lista })
  return lista
}

/** Tabela do candidato pelo codigo FIPE (0 carros, 8 motos, 5 caminhoes). */
function tabelaDoCodigo(codigo: string): TabelaFipe | null {
  for (const t of ['carros', 'motos', 'caminhoes'] as TabelaFipe[]) {
    if (/^\d{6}-\d$/.test(codigo) && codigoDaTabela(codigo, t)) return t
  }
  return null
}

/**
 * Marcas onde procurar o modelo: as do tipo da tabela do candidato primeiro,
 * com o nome da marca nessa tabela (VOLKSWAGEN x "VW - VolksWagen"); as
 * outras com o mesmo nome so depois.
 */
export async function marcasParaResolver(
  marca: string,
  codigoFipe: string,
  fipeApiUrl: string,
  fipeApiToken: string,
): Promise<number[]> {
  const lista = await marcasFipe(fipeApiUrl, fipeApiToken)
  const tabela = tabelaDoCodigo(codigoFipe)
  const nomes = new Set([marca, tabela ? marcaParaFipeApi(marca, tabela) : marca].map((n) => String(n || '').trim().toLowerCase()))
  const comNome = lista.filter((b) => nomes.has(b.nome))
  const tipo = tabela ? TIPO_DA_TABELA[tabela] : null
  const daTabela = tipo ? comNome.filter((b) => b.tipo === tipo) : []
  return [...daTabela, ...comNome.filter((b) => !daTabela.includes(b))].map((b) => b.id)
}

async function resolverCodigoModelo(
  marca: string,
  modeloNome: string,
  codigoFipe: string,
  fipeApiUrl: string,
  fipeApiToken: string,
): Promise<string | null> {
  try {
    for (const brandId of await marcasParaResolver(marca, codigoFipe, fipeApiUrl, fipeApiToken)) {
      const res = await fetch(`${fipeApiUrl}/brands/${brandId}/models`, { headers: { Authorization: `Bearer ${fipeApiToken}` } })
      if (!res.ok) continue
      const body = await res.json()
      const lista = Array.isArray(body?.data) ? body.data : []
      const match = lista.find((m: any) => typeof m?.name === 'string' && m.name.trim() === modeloNome.trim())
      if (match?.fipe_code) return String(match.fipe_code)
    }
    return null
  } catch {
    return null
  }
}

// Preenche codigoModelo do escolhido quando faltar (candidato veio do
// universo da fipe-api, nao da wdapi) - sem isso, price-history e seguro
// ficam sem series pra ele. Fail-open: erro/nao-achado deixa null, quem
// consome (valor-custo.ts) ja trata price-history/seguro ausentes.
export async function comCodigoModelo(
  candidato: FipeCandidato,
  marca: string,
  fipeApiUrl: string,
  fipeApiToken: string,
): Promise<FipeCandidato> {
  if (candidato.codigoModelo) return candidato
  const codigoModelo = await resolverCodigoModelo(marca, candidato.modelo, candidato.codigo_fipe, fipeApiUrl, fipeApiToken)
  return { ...candidato, codigoModelo }
}

function unirUniverso(a: FipeCandidato[], b: FipeCandidato[]): FipeCandidato[] {
  const porCodigo = new Map<string, FipeCandidato>()
  // wdapi primeiro: se a fipe-api tiver o mesmo codigo, ela sobrescreve
  // (valor/mes_referencia mais fresco).
  for (const item of a) porCodigo.set(item.codigo_fipe, item)
  for (const item of b) porCodigo.set(item.codigo_fipe, { ...porCodigo.get(item.codigo_fipe), ...item })
  return [...porCodigo.values()]
}

function melhorScoreWdapi(wdapi: any, tabela: TabelaFipe = 'carros', nome: string | null = null, descricao: string | null = null): FipeCandidato | null {
  const daTabela = Array.isArray(wdapi?.fipe?.dados)
    ? wdapi.fipe.dados.filter((d: any) => candidatoDaTabela(d?.codigo_fipe, d?.texto_modelo, tabela, nome))
    : null
  const dados = daTabela && descricao ? filtrarPeloNomeDoVeiculo(daTabela, descricao, (d: any) => String(d?.texto_modelo || '')) : daTabela
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
    // Ja vem da fonte: sem ele, o escolhido pelo atalho (score alto) caia na
    // resolucao por nome e podia ficar sem historico/seguro.
    codigoModelo: melhor.codigo_modelo ? String(melhor.codigo_modelo) : null,
  }
}

/**
 * Melhor candidato da fonte livre QUANDO da pra confiar nele sozinho: score
 * alto e nome do modelo casando com o registro. Os dois juntos importam: score
 * alto com nome que nao bate ja apontou carro errado, e nome batendo com score
 * baixo e coincidencia de familia.
 */
const SCORE_CONFIAVEL = 85

function candidatoWdapiConfiavel(wdapi: any, tokensModelo: string[], tabela: TabelaFipe): FipeCandidato | null {
  if (!tokensModelo.length) return null
  // Caminhao: nome composto ("L2638"); carro/moto: o 1o token, como sempre
  // (PCX 150 nao pode virar "PCX150").
  const nome = tabela === 'caminhoes' ? nomesDoModelo(tokensModelo)[0] : tokensModelo[0]
  const melhor = melhorScoreWdapi(wdapi, tabela, nome)
  if (!melhor) return null
  const dados = wdapi?.fipe?.dados
  const score = Array.isArray(dados)
    ? Math.max(...dados.filter((d: any) => d?.codigo_fipe === melhor.codigo_fipe).map((d: any) => Number(d?.score) || 0))
    : 0
  if (score < SCORE_CONFIAVEL) return null
  return new RegExp(`\\b${escapeRegex(nome)}`, 'i').test(melhor.modelo) || nomeCasa(melhor.modelo, nome) ? melhor : null
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

// Motores reais nao respeitam fronteira exata (1.4 costuma vir 1368-1398cc,
// 1.5 costuma vir 1451-1499cc, mas varia por fabricante/ano). Perto da
// fronteira entre duas faixas, devolve AS DUAS - na duvida entre rotulos
// vizinhos, o funil nao elimina nenhum (melhor sobrar candidato de menos pra
// decidir por nome/Haiku do que eliminar o certo por engano).
const TOLERANCIA_FRONTEIRA_CC = 20

function litragensDaCilindrada(cilindrada: unknown): string[] {
  const cc = Number(cilindrada)
  if (!Number.isFinite(cc) || cc <= 0) return []
  const idx = FAIXAS_CILINDRADA.findIndex((f) => cc >= f.min && cc <= f.max)
  if (idx === -1) return []
  const labels = new Set([FAIXAS_CILINDRADA[idx].label])
  if (idx + 1 < FAIXAS_CILINDRADA.length && FAIXAS_CILINDRADA[idx].max - cc <= TOLERANCIA_FRONTEIRA_CC) {
    labels.add(FAIXAS_CILINDRADA[idx + 1].label)
  }
  if (idx - 1 >= 0 && cc - FAIXAS_CILINDRADA[idx].min <= TOLERANCIA_FRONTEIRA_CC) {
    labels.add(FAIXAS_CILINDRADA[idx - 1].label)
  }
  return [...labels]
}

type Carroceria = 'hatch' | 'sedan' | 'sw' | null

function carroceriaDaDescricao(descricaoMarcaModelo: unknown): Carroceria {
  const texto = String(descricaoMarcaModelo || '').toUpperCase()
  if (/\bSW\b|\bPERUA\b/.test(texto)) return 'sw'
  if (/\bSED\b|\bSEDAN\b/.test(texto)) return 'sedan'
  if (/\bHB\b|\bHATCH\b/.test(texto)) return 'hatch'
  return null
}

type Transmissao = 'manual' | 'automatico' | null

// Cambio do nome do cadastro (camada 1): dicionario por marca em
// shared/cambio-nome.ts ("1.4MT", "10TAT", Hyundai "1.6M", AT6, CVT, DCT...).
function transmissaoDaDescricao(descricaoMarcaModelo: unknown): Transmissao {
  return cambioDoNome(String(descricaoMarcaModelo || ''))
}

export function candidatoEManual(modelo: string): boolean {
  return versaoFipeManual(modelo)
}

/** Aut. e os automatizados que a FIPE nomeia pelo sistema (Dualogic, I-Motion...). */
export function candidatoEAutomatico(modelo: string): boolean {
  return versaoFipeAutomatica(modelo)
}

// SENATRAN codigo de combustivel (RENAVAM) -> so os casos CLAROS e de valor
// FIPE bem diferente: diesel e eletrico. Flex/gasolina/alcool ficam null (a FIPE
// nao separa flex de forma consistente; filtrar por eles estreitaria errado).
function combustivelDoCodigo(codigo: unknown): 'diesel' | 'eletrico' | null {
  const c = String(codigo ?? '').trim()
  if (c === '3' || c === '11') return 'diesel' // Diesel / Diesel+GNV
  if (c === '6' || c === '7') return 'eletrico' // Eletrico (fonte interna/externa)
  return null
}

function candidatoEDiesel(c: FipeCandidato): boolean {
  return /diesel/i.test(`${c.combustivel ?? ''} ${c.modelo ?? ''}`)
}

function candidatoEEletrico(c: FipeCandidato): boolean {
  return /el[eé]tric|electric|\bEV\b/i.test(`${c.combustivel ?? ''} ${c.modelo ?? ''}`)
}

function candidatoESedan(modelo: string): boolean {
  return /\bSED\b|\bSEDAN\b/i.test(modelo)
}

function candidatoESw(modelo: string): boolean {
  return /\bSW\b|\bPERUA\b/i.test(modelo)
}

function candidatoTemLitragem(modelo: string, labels: string[]): boolean {
  return labels.some((label) => modelo.includes(label))
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Palavras que aparecem no campo VERSAO mas NAO distinguem versao nenhuma:
// sao equipamento, cambio, combustivel ou adjetivo comercial, e o nome do
// modelo na FIPE quase nunca as repete.
//
// Isto virou bug de produto (placa FZK5F28): VERSAO chegou como "ABS", o funil
// filtrou o universo por "ABS" no nome, e o PCX 150/DLX correto, que na FIPE
// nao tem "ABS" no nome, foi eliminado. Sobraram tres motos grandes com "ABS"
// no nome, e a scooter 150 virou uma CB 1000R de R$58 mil no relatorio.
const VERSAO_GENERICA = new Set([
  'ABS', 'CBS', 'FLEX', 'DLX', 'DELUXE', 'CVT', 'AT', 'MT', 'AUT', 'MEC',
  '4X4', '4X2', 'AWD', '4WD', 'TURBO', 'GNV', 'HIB', 'HYBRID', 'ELET',
  'ELETRICO', 'LIMITED', 'PLUS', 'SPORT', 'STD', 'BASE', 'PREMIUM', 'TOP',
  'FULL', 'ADV', 'PRO', 'MAX', 'GL', 'GLS', 'STANDARD', 'ESPECIAL',
])

/** Versao que serve pra filtrar: existe, e curta, e nao e palavra generica. */
function versaoDiscriminante(bruta: unknown): string | null {
  const v = String(bruta ?? '').trim()
  if (!v || v.length > 12) return null
  if (VERSAO_GENERICA.has(v.toUpperCase())) return null
  return v
}

function candidatoTemVersao(modelo: string, versao: string): boolean {
  const v = versao.trim()
  if (!v) return true
  const re = new RegExp(`\\b${escapeRegex(v)}\\b`, 'i')
  return re.test(modelo)
}

interface Fatos {
  litragem: string[]
  carroceria: Carroceria
  versao: string | null
  transmissao: Transmissao
  /** Diesel/eletrico do registro: desempata versoes de combustivel bem diferente. */
  combustivel: 'diesel' | 'eletrico' | null
  /** Duas rodas: o funil de carro nao vale, e cilindrada nao vira litragem. */
  moto: boolean
  /** Nome e cilindrada do modelo, pra casar moto por texto ("PCX", "150"). */
  tokensModelo: string[]
  /** Cabine da picape: simples e dupla sao veiculos de preco bem diferente. */
  cabine: 'simples' | 'dupla' | null
  /** Caminhao/onibus: funil proprio (modelo numerico e tracao). */
  caminhao: boolean
  /** Tracao do caminhao na descricao ("6X2"), quando houver. */
  tracao: string | null
  /** Nome do registro, pra versao/motorizacao que ja vem nele (XEI18VVT). */
  descricao: string
}

function tracaoDaDescricao(descricao: unknown): string | null {
  const m = String(descricao ?? '').toUpperCase().match(/\b(\d{1,2})X(\d)\b/)
  return m ? `${m[1]}X${m[2]}` : null
}

/**
 * Caminhao: o modelo e um numero ("24.280" no registro, "24-280" na FIPE) e a
 * tracao (6x2, 8x2) separa versoes de preco bem diferente. O funil de carro
 * (litragem, carroceria, cambio) nao serve aqui.
 */
function filtrarCaminhao(universo: FipeCandidato[], fatos: Fatos): FipeCandidato[] {
  let restantes = universo
  // Nome do modelo antes de tudo: o composto ("L2638") primeiro, o numero
  // ("2638") se o composto nao casar com ninguem.
  for (const nome of nomesDoModelo(fatos.tokensModelo.map(soAlnum))) {
    const porModelo = restantes.filter((c) => nomeCasa(c.modelo, nome))
    if (porModelo.length) { restantes = porModelo; break }
  }
  if (fatos.tracao) {
    const re = new RegExp(`\\b${fatos.tracao}\\b`, 'i')
    const porTracao = restantes.filter((c) => re.test(c.modelo))
    if (porTracao.length) restantes = porTracao
  }
  if (fatos.combustivel === 'diesel') {
    const porDiesel = restantes.filter(candidatoEDiesel)
    if (porDiesel.length) restantes = porDiesel
  }
  return restantes
}

function cabineDaDescricao(descricao: unknown): 'simples' | 'dupla' | null {
  const d = String(descricao ?? '').toUpperCase()
  if (/\bCD\b|CABINE DUPLA/.test(d)) return 'dupla'
  if (/\bCS\b|CABINE SIMPLES/.test(d)) return 'simples'
  return null
}

// Tokens uteis do nome do modelo, pra casar moto por nome em vez de cilindrada:
// "HONDA/PCX 150 DLX ABS" vira ["PCX", "150"]. Marca, generico e numero solto
// de 4 digitos ficam de fora.
function tokensDoModelo(descricao: unknown): string[] {
  const bruto = String(descricao ?? '').toUpperCase()
  const semMarca = bruto.includes('/') ? bruto.slice(bruto.indexOf('/') + 1) : bruto
  const partes = semMarca.split(/[^A-Z0-9.]+/).filter(Boolean)
  return partes
    // Letra solta so fica quando vem antes de numero ("L 2638", "F 4000"): e prefixo do nome.
    .filter((t, i) => (t.length >= 2 || (/^[A-Z]$/.test(t) && /^\d{3,5}$/.test(partes[i + 1] || ''))) && !VERSAO_GENERICA.has(t))
    .slice(0, 4)
}

/** Mantem os candidatos que casam com o PRIMEIRO token do modelo (o nome). */
function filtrarPorTokensDoModelo(universo: FipeCandidato[], tokens: string[]): FipeCandidato[] {
  if (!tokens.length) return universo
  const nome = tokens[0]
  const comNome = universo.filter((c) => new RegExp(`\\b${escapeRegex(nome)}`, 'i').test(c.modelo) || nomeCasa(c.modelo, nome))
  if (!comNome.length) return []
  if (tokens.length < 2) return comNome
  // Com o segundo token (normalmente a cilindrada, "150") da pra separar
  // PCX 150 de PCX 160 sem depender do funil de carro.
  const comSegundo = comNome.filter((c) => c.modelo.toUpperCase().includes(tokens[1]))
  return comSegundo.length ? comSegundo : comNome
}

// Moto pela fonte livre (segmento/tipo) ou pelo registro (especie/tipo). A
// cilindrada sozinha NAO decide: 149cc e moto, mas 1000cc tambem pode ser.
function ehMoto(senatran: FipeMelhorCandidatoInput['senatran'], wdapi: any): boolean {
  const sinais = [
    wdapi?.segmento, wdapi?.sub_segmento, wdapi?.extra?.tipo_veiculo,
    wdapi?.extra?.especie, wdapi?.extra?.segmento,
    senatran?.descricaoTipoVeiculo, senatran?.descricaoEspecie,
  ]
  return sinais.some((v) => /MOTO|SCOOTER|CICLOMOTOR|TRICICLO/i.test(String(v ?? '')))
}

function extrairFatos(senatran: FipeMelhorCandidatoInput['senatran'], wdapi: any, tabela: TabelaFipe = 'carros'): Fatos {
  const litragem = litragensDaCilindrada(senatran?.cilindrada)
  const carroceria = carroceriaDaDescricao(senatran?.descricaoMarcaModelo)
  // Cambio: primeiro o do registro (MT/AT na descricao); se nao houver, o hint
  // externo (Camada 2, texto do recall). O registro sempre tem prioridade.
  const transmissao =
    transmissaoDaDescricao(senatran?.descricaoMarcaModelo) ?? (senatran?.transmissaoHint ?? null)
  // Versao generica (ABS, FLEX, DLX...) nao filtra: ver VERSAO_GENERICA.
  const versao = versaoDiscriminante(wdapi?.VERSAO)
  return {
    litragem, carroceria, versao, transmissao,
    combustivel: combustivelDoCodigo(senatran?.codigoCombustivel),
    moto: tabela === 'motos',
    tokensModelo: tokensDoModelo(senatran?.descricaoMarcaModelo || wdapi?.MODELO),
    cabine: cabineDaDescricao(senatran?.descricaoMarcaModelo),
    caminhao: tabela === 'caminhoes',
    tracao: tracaoDaDescricao(senatran?.descricaoMarcaModelo),
    descricao: String(senatran?.descricaoMarcaModelo || ''),
  }
}

function aplicarFunil(universo: FipeCandidato[], fatos: Fatos): FipeCandidato[] {
  let restantes = universo

  // Moto nao passa pelo funil de carro. Cilindrada de moto nao vira "litragem"
  // (149cc nao e "1.4"), scooter nao tem carroceria sedan/hatch/SW e o cambio
  // da descricao nao se aplica. Rodar esse funil numa moto so servia pra
  // eliminar o candidato certo, que foi o que aconteceu com a PCX 150.
  if (fatos.moto) {
    const porModelo = filtrarPorTokensDoModelo(restantes, fatos.tokensModelo)
    return porModelo.length ? porModelo : restantes
  }

  if (fatos.caminhao) return filtrarCaminhao(restantes, fatos)

  // Modelo do nome primeiro: TRACKER nao pode terminar com ONIX (TTR6F65).
  restantes = filtrarPeloModeloDoNome(restantes, fatos.descricao)

  if (fatos.litragem.length) {
    const porLitragem = restantes.filter((c) => candidatoTemLitragem(c.modelo, fatos.litragem))
    if (porLitragem.length) restantes = porLitragem
  }

  // Versao e motorizacao do NOME do registro (shared/versao-fipe.ts): "COROLLA
  // XEI18VVT" nao pode sobrar com um SE-G na lista. Fail-safe por filtro.
  restantes = filtrarPelaVersaoDoNome(restantes, fatos.descricao)

  // Combustivel: so diesel e eletrico (valor FIPE bem diferente do a gasolina).
  // Fail-safe: se nenhum candidato bate, mantem todos (nao inventa exclusao).
  if (fatos.combustivel) {
    const porCombustivel = restantes.filter((c) =>
      fatos.combustivel === 'diesel' ? candidatoEDiesel(c) : candidatoEEletrico(c),
    )
    if (porCombustivel.length) restantes = porCombustivel
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

  // Cabine da picape: CS (simples) e CD (dupla) sao carros diferentes com
  // precos bem diferentes. Caso real (GMF8I88): "SAVEIRO CS RB MF" tinha entre
  // os candidatos a Saveiro Extreme CD, R$25 mil mais cara que a Robust certa.
  if (fatos.cabine) {
    const porCabine = restantes.filter((c) => {
      const temCd = /\bCD\b|CABINE DUPLA/i.test(c.modelo)
      const temCs = /\bCS\b|CABINE SIMPLES/i.test(c.modelo)
      return fatos.cabine === 'simples' ? !temCd : !temCs
    })
    if (porCabine.length) restantes = porCabine
  }

  if (fatos.versao) {
    const porVersao = restantes.filter((c) => candidatoTemVersao(c.modelo, fatos.versao!))
    if (porVersao.length) restantes = porVersao
  }

  if (fatos.transmissao) {
    const porTransmissao = restantes.filter((c) =>
      fatos.transmissao === 'manual' ? candidatoEManual(c.modelo) : candidatoEAutomatico(c.modelo),
    )
    if (porTransmissao.length) restantes = porTransmissao
  }

  return restantes
}

// ---------------------------------------------------------------------------
// Juiz Haiku (so quando sobra >1 candidato)
// ---------------------------------------------------------------------------

interface HaikuVeredito {
  /** null = o juiz disse que nenhum candidato serve (resposta valida, vira duvida com lista). */
  codigo_fipe: string | null
  confianca: 'alta' | 'media' | 'baixa'
  justificativa: string
}

/** Valor do enum que o juiz usa quando nenhum candidato serve. */
export const HAIKU_NENHUM = 'nenhum'
// O 5.5 escreve justificativa longa e cerca o JSON de ```json: com 300 tokens a
// resposta era cortada no meio (FAG9103, 11/out: "JSON invalido" 3x). Com
// structured outputs o formato e garantido; 600 da folga pra justificativa.
const HAIKU_MAX_TOKENS = 600

/** Schema do structured output: codigo so dentre os candidatos (ou "nenhum"). */
export function schemaVeredito(codigos: string[]) {
  return {
    type: 'object',
    properties: {
      codigo_fipe: { type: 'string', enum: [...codigos, HAIKU_NENHUM] },
      confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] },
      justificativa: { type: 'string' },
    },
    required: ['codigo_fipe', 'confianca', 'justificativa'],
    additionalProperties: false,
  }
}

/** Trecho saneado do texto cru pro log (sem placa, chassi ou numero longo). */
export function trechoSaneado(texto: string, max = 200): string {
  return String(texto || '')
    .replace(/\b[A-HJ-NPR-Z0-9]{17}\b/gi, (m) => (/\d/.test(m) && /[A-Z]/i.test(m) ? '<chassi>' : m))
    .replace(/\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b/gi, '<placa>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/**
 * Le o veredito. Tolerante: cerca de ```json, texto em volta, mais de um
 * objeto (fica o 1o) e JSON cortado no meio (codigo e confianca vem antes da
 * justificativa, entao sao lidos mesmo sem o fecho). "nenhum"/null/"" no
 * codigo = nenhum candidato serve: veredito valido com codigo null.
 */
export function parseVereditoHaiku(texto: string): HaikuVeredito | null {
  const t = String(texto || '').replace(/```(?:json)?/gi, '')
  let obj: any = null
  const ini = t.indexOf('{')
  if (ini >= 0) {
    let prof = 0, emStr = false, esc = false
    for (let i = ini; i < t.length; i++) {
      const ch = t[i]
      if (emStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') emStr = false; continue }
      if (ch === '"') emStr = true
      else if (ch === '{') prof++
      else if (ch === '}' && --prof === 0) { try { obj = JSON.parse(t.slice(ini, i + 1)) } catch { obj = null } break }
    }
  }
  if (!obj) {
    // Cortado (max_tokens): pega os campos que ja vieram.
    const cod = t.match(/"codigo_fipe"\s*:\s*(null|"([^"]*)")/)
    const conf = t.match(/"confianca"\s*:\s*"(alta|media|baixa)"/)
    if (!cod || !conf) return null
    const just = t.match(/"justificativa"\s*:\s*"((?:[^"\\]|\\.)*)/)
    obj = { codigo_fipe: cod[1] === 'null' ? null : cod[2], confianca: conf[1], justificativa: just ? just[1] : '' }
  }
  if (!obj || !['alta', 'media', 'baixa'].includes(obj.confianca)) return null
  const cod = obj.codigo_fipe == null ? '' : String(obj.codigo_fipe).trim()
  const nenhum = !cod || /^(nenhum|none|null)$/i.test(cod)
  return {
    codigo_fipe: nenhum ? null : cod,
    confianca: nenhum ? 'baixa' : obj.confianca,
    justificativa: String(obj.justificativa || ''),
  }
}

/** Texto do primeiro bloco 'text' (o 5.5 pode mandar 'thinking' antes). */
export function textoDaResposta(body: any): string | null {
  const bloco = Array.isArray(body?.content) ? body.content.find((b: any) => b?.type === 'text') : null
  return typeof bloco?.text === 'string' ? bloco.text : null
}

/** Log [fipe-haiku] + e-mail (com anti-spam) ao Cesar. Sem placa/chassi. */
function falhaHaiku(motivo: string, detalhe: string | null, token: string | null | undefined) {
  console.warn(`[fipe-haiku] ${motivo}${detalhe ? ` ${detalhe}` : ''}`)
  void alertarFalhaHaiku({ motivo, detalhe, modelo: HAIKU_MODEL, token: token ?? null }).catch(() => {})
}

async function julgarComHaiku(
  fatos: Fatos,
  senatran: FipeMelhorCandidatoInput['senatran'],
  wdapi: any,
  candidatos: FipeCandidato[],
  anthropicApiKey: string,
  pedidoToken?: string | null,
): Promise<HaikuVeredito | null> {
  const prompt = [
    'Voce e um perito em identificacao de versao de veiculo pela tabela FIPE.',
    'Dados oficiais do veiculo (SENATRAN + wdapi):',
    `- descricao SENATRAN: ${senatran?.descricaoMarcaModelo || 'desconhecida'}`,
    `- cilindrada: ${senatran?.cilindrada ?? 'desconhecida'}`,
    `- potencia: ${senatran?.potencia ?? 'desconhecida'}`,
    `- marca/modelo/submodelo/versao (wdapi): ${marcaExibicao(wdapi)} / ${wdapi?.MODELO || ''} / ${wdapi?.SUBMODELO || ''} / ${wdapi?.VERSAO || ''}`,
    `- ano modelo: ${wdapi?.anoModelo ?? senatran?.anoModelo ?? 'desconhecido'}`,
    `- combustivel (wdapi): ${wdapi?.extra?.combustivel || 'desconhecido'}`,
    '',
    'Candidatos da tabela FIPE (ja pre-filtrados por cilindrada/carroceria/versao/cambio):',
    ...candidatos.map((c) => `- codigo_fipe=${c.codigo_fipe} | ${c.modelo} | valor=${c.valor ?? 'desconhecido'}`),
    '',
    'Escolha o candidato que melhor corresponde aos dados oficiais. Responda',
    'APENAS com um JSON no formato exato (justificativa em ate 25 palavras):',
    '{"codigo_fipe": "...", "confianca": "alta"|"media"|"baixa", "justificativa": "..."}',
    `Se NENHUM candidato corresponder ao veiculo, responda "codigo_fipe":"${HAIKU_NENHUM}".`,
    'Use "confianca":"baixa" se nao tiver certeza suficiente pra decidir entre os candidatos.',
    'A sigla de versao no nome do cadastro identifica a versao FIPE escrita por extenso.',
    `Siglas conhecidas: ${siglasParaPrompt()}. Ex.: "VW/NIVUS HL TSI" e o Nivus Highline.`,
    'Se a sigla do cadastro corresponde a um unico candidato, escolha esse candidato com confianca alta.',
    'IMPORTANTE: se os candidatos so se diferenciam pelo cambio (Mec./Aut./',
    'Dualogic/CVT) e NENHUM dado oficial acima indica o cambio do veiculo,',
    'isso e ambiguidade real, nao adivinhe - responda "confianca":"baixa".',
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
        max_tokens: HAIKU_MAX_TOKENS,
        thinking: { type: 'disabled' },
        // Structured outputs: o JSON sai no formato do schema, sem cerca nem texto em volta.
        output_config: { format: { type: 'json_schema', schema: schemaVeredito(candidatos.map((c) => c.codigo_fipe)) } },
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      // So status e tipo do erro (sem placa/chassi): o caso HSX1F20 caiu no
      // fallback sem deixar rastro nenhum.
      let tipo = '', msg = ''
      try { const b: any = await res.json(); tipo = String(b?.error?.type || ''); msg = String(b?.error?.message || '').slice(0, 200) } catch { /* corpo nao e json */ }
      falhaHaiku(`HTTP ${res.status}${tipo ? ` ${tipo}` : ''}`, msg || null, pedidoToken)
      return null
    }
    const body = await res.json()
    const texto = textoDaResposta(body)
    if (typeof texto !== 'string') {
      falhaHaiku('sem bloco text', `stop_reason=${body?.stop_reason ?? '?'}`, pedidoToken)
      return null
    }
    const veredito = parseVereditoHaiku(texto)
    if (!veredito) falhaHaiku('JSON invalido', `stop_reason=${body?.stop_reason ?? '?'} texto="${trechoSaneado(texto)}"`, pedidoToken)
    return veredito
  } catch (e: any) {
    if (e?.name === 'AbortError') falhaHaiku(`timeout ${HAIKU_TIMEOUT_MS} ms`, null, pedidoToken)
    else falhaHaiku('erro de rede', String(e?.message || e).slice(0, 200), pedidoToken)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------------
// Orquestracao
// ---------------------------------------------------------------------------

// Nome da marca no "idioma" da fipe-api quando nao veio o texto_marca da
// FIPE. CHEVROLET cru casa com a marca de CAMINHOES na fipe-api; os carros
// estao em "GM - Chevrolet". Mesmo cuidado com VW e Mercedes.
const ALIAS_MARCA_FIPE: Record<string, string> = {
  GM: 'GM - Chevrolet', CHEV: 'GM - Chevrolet', CHEVROLET: 'GM - Chevrolet',
  VW: 'VW - VolksWagen', VOLKSWAGEN: 'VW - VolksWagen', VOLKS: 'VW - VolksWagen',
  'M.BENZ': 'Mercedes-Benz', MBENZ: 'Mercedes-Benz', MB: 'Mercedes-Benz', MERCEDES: 'Mercedes-Benz', 'MERCEDES-BENZ': 'Mercedes-Benz',
  KIA: 'Kia Motors', CITROEN: 'Citroën',
}
// Na tabela de caminhoes os nomes sao outros: VOLKSWAGEN (nao "VW -
// VolksWagen"), CHEVROLET, MERCEDES-BENZ.
const ALIAS_MARCA_CAMINHAO: Record<string, string> = {
  VW: 'VOLKSWAGEN', VOLKS: 'VOLKSWAGEN', VOLKSWAGEN: 'VOLKSWAGEN', 'VW - VOLKSWAGEN': 'VOLKSWAGEN',
  GM: 'CHEVROLET', CHEV: 'CHEVROLET', CHEVROLET: 'CHEVROLET', 'GM - CHEVROLET': 'CHEVROLET',
  'M.BENZ': 'MERCEDES-BENZ', MBENZ: 'MERCEDES-BENZ', MB: 'MERCEDES-BENZ', MERCEDES: 'MERCEDES-BENZ', 'MERCEDES-BENZ': 'MERCEDES-BENZ',
  IVECOFIAT: 'IVECO', 'IVECO-FIAT': 'IVECO',
}
export function marcaParaFipeApi(marca: string | null | undefined, tabela: TabelaFipe = 'carros'): string {
  const m = String(marca || '').trim()
  if (tabela === 'caminhoes') return ALIAS_MARCA_CAMINHAO[m.toUpperCase()] || m.toUpperCase()
  // A busca por marca na fipe-api ignora caixa: HONDA serve pra moto. So nao
  // pode virar o nome da tabela de carros.
  if (tabela === 'motos') return m
  return ALIAS_MARCA_FIPE[m.toUpperCase()] || m
}

/**
 * Marca do registro SENATRAN: "CHEVROLET/CELTA 1.0L LT" -> CHEVROLET,
 * "I/LAMBORGHINI HURAC SPYD" -> LAMBORGHINI (I/ = importado). Codigo de uma
 * letra ou REB (reboque) nao e marca: devolve ''.
 */
export function marcaDoRegistro(descricao: string | null | undefined): string {
  let d = String(descricao || '').trim().toUpperCase()
  if (!d) return ''
  d = d.replace(/^I\s*\//, '')
  const antesDaBarra = d.includes('/') ? d.split('/')[0] : d.split(/\s+/)[0]
  const marca = antesDaBarra.trim().split(/\s+/)[0] || ''
  if (marca.length < 2 || marca === 'REB' || marca === 'SREB') return ''
  return marca
}

export async function escolherMelhorFipe(input: FipeMelhorCandidatoInput): Promise<FipeMelhorCandidatoResultado> {
  const tabela = tabelaFipe(input.senatran, input.wdapi, input.segmento)
  const nome = nomeDoModelo(input.senatran, input.wdapi)
  const fallback = (): FipeMelhorCandidatoResultado => ({
    escolhido: melhorScoreWdapi(input.wdapi, tabela, nome, input.senatran?.descricaoMarcaModelo ?? null),
    decididoPor: 'fallback',
    candidatos: [],
  })

  try {
    // texto_marca (fipe.dados) e o nome no "idioma" da propria FIPE/fipe-api -
    // NEM SEMPRE bate com wdapi.marca/MARCA (taxonomia da apiplacas/SENATRAN).
    // Achado real testando ONIX: wdapi.marca = "CHEVROLET", mas a fipe-api so
    // reconhece "GM - Chevrolet" (existe um outro brand "CHEVROLET" pra
    // CAMINHOES, entao usar o nome errado nao so falha - podia casar marca
    // errada). Cai pro wdapi so se fipe.dados vier vazio — e ai usa a marca de
    // EXIBICAO, nao o campo cru: em importado o cru e um codigo ("I"), que
    // buscaria o universo FIPE de uma marca inexistente.
    // Sem fipe.dados (caso FUG0A96, Lamborghini, e os zero-km que a fonte
    // devolve vazios), a marca sai da wdapi ou do proprio registro SENATRAN
    // ("I/LAMBORGHINI HURAC SPYD"), traduzida pro nome da fipe-api.
    // Fora da tabela de carros o texto_marca da fonte nao serve: no caminhao
    // VW ela devolveu "VW - VolksWagen", que e a marca de CARROS. Ai vale a
    // marca do registro traduzida pra tabela certa.
    const marca = tabela === 'carros'
      ? (input.wdapi?.fipe?.dados?.[0]?.texto_marca
        || marcaParaFipeApi(marcaExibicao(input.wdapi) || marcaDoRegistro(input.senatran?.descricaoMarcaModelo)))
      : marcaParaFipeApi(
        marcaDoRegistro(input.senatran?.descricaoMarcaModelo) || marcaExibicao(input.wdapi) || input.wdapi?.fipe?.dados?.[0]?.texto_marca,
        tabela,
      )
    const ano = input.wdapi?.anoModelo || input.senatran?.anoModelo
    if (!marca || !ano) return fallback()

    let universoFipeApi = await buscarUniversoFipeApi(marca, ano, input.fipeApiUrl, input.fipeApiToken)
    // Caminhao sem o modelo na tabela de caminhoes: pode ser van ou caminhao
    // leve que a FIPE lista entre os carros (Master, HR, Bongo). Busca tambem
    // la; o filtro abaixo so deixa entrar o que tiver o nome do modelo.
    if (tabela === 'caminhoes' && universoFipeApi !== null && nome
      && !universoFipeApi.some((c) => codigoDaTabela(c.codigo_fipe, 'caminhoes') && nomeCasa(c.modelo, nome))) {
      const marcaCarro = marcaParaFipeApi(marcaDoRegistro(input.senatran?.descricaoMarcaModelo) || marcaExibicao(input.wdapi))
      const deCarro = marcaCarro ? await buscarUniversoFipeApi(marcaCarro, ano, input.fipeApiUrl, input.fipeApiToken) : null
      if (deCarro) universoFipeApi = [...universoFipeApi, ...deCarro]
    }
    if (universoFipeApi === null) {
      // fipe-api fora do ar: sem universo confiavel, nao vale a pena rodar o
      // funil so com os (poucos) candidatos da wdapi.
      return fallback()
    }
    const universoWdapi = soDaTabela(candidatosDaWdapi(input.wdapi), tabela, nome)
    const universo = unirUniverso(universoWdapi, soDaTabela(universoFipeApi, tabela, nome))
    if (!universo.length) return fallback()

    const fatos = extrairFatos(input.senatran, input.wdapi, tabela)

    // Atalho de confianca: quando a fonte livre ja tem um candidato com score
    // alto E o nome dele bate com o modelo do registro, ele E a resposta. Nao
    // ha por que passar isso por funil e por LLM: no caso da PCX 150 o
    // candidato certo vinha com score 92 e foi descartado no meio do caminho,
    // trocado por uma moto de 1000cc.
    // O atalho tambem respeita a versao do nome: score alto num SE-G nao
    // vale pra um Corolla XEi.
    const versoesNome = versaoDoNome(input.senatran?.descricaoMarcaModelo).versoes
    const forteBruto = candidatoWdapiConfiavel(input.wdapi, fatos.tokensModelo, tabela)
    const forte = forteBruto && candidatoTemVersaoDoNome(forteBruto.modelo, versoesNome) ? forteBruto : null
    if (forte) {
      const escolhido = await comCodigoModelo(forte, marca, input.fipeApiUrl, input.fipeApiToken)
      return { escolhido, decididoPor: 'wdapi', candidatos: [forte], confianca: 'alta' }
    }

    const filtrados = aplicarFunil(universo, fatos)

    if (filtrados.length === 0) return fallback()

    if (filtrados.length === 1) {
      const escolhido = await comCodigoModelo(filtrados[0], marca, input.fipeApiUrl, input.fipeApiToken)
      return { escolhido, decididoPor: 'regra', candidatos: filtrados, confianca: 'alta' }
    }

    // Camada 2: sobraram exatamente uma versao manual e uma automatica (a
    // duvida e SO o cambio) e o nome do cadastro nao disse o cambio: o prefixo
    // do chassi decide quando ha regra unanime (shared/cambio-chassi.ts).
    if (!fatos.transmissao) {
      const par = opcoesDeCambio(filtrados)
      const pelo = par ? cambioPeloChassi(input.senatran?.chassi) : null
      if (par && pelo) {
        const achado = pelo === 'manual' ? par.manual : par.automatico
        const escolhido = await comCodigoModelo(achado, marca, input.fipeApiUrl, input.fipeApiToken)
        return { escolhido, decididoPor: 'regra', candidatos: [achado], confianca: 'alta', justificativa: 'cambio pelo prefixo do chassi' }
      }
    }

    if (!input.anthropicApiKey) {
      // Sem juiz disponivel e mais de um candidato: ambiguidade honesta em
      // vez de chute - mostra shortlist, nao decide sozinho.
      return { escolhido: null, decididoPor: 'ambiguo', candidatos: filtrados.slice(0, 5) }
    }

    const veredito = await julgarComHaiku(fatos, input.senatran, input.wdapi, filtrados.slice(0, 8), input.anthropicApiKey, input.pedidoToken)
    // Haiku fora do ar/timeout/parse ruim ou codigo fora da lista: com FIPE na
    // fonte, fail-open pro comportamento antigo (melhor score da fonte). SEM
    // FIPE na fonte o fallback nao tem candidato nenhum (HSX1F20: Celta Spirit
    // saiu sem FIPE e sem lista), entao vira duvida honesta com a shortlist do
    // funil: o relatorio mostra as versoes (e a pergunta de cambio, se for o caso).
    const semAjuda = () => (candidatosDaWdapi(input.wdapi).length
      ? fallback()
      : { escolhido: null, decididoPor: 'ambiguo' as const, candidatos: filtrados.slice(0, 5), confianca: 'baixa' as const })
    if (!veredito) return semAjuda()
    // O juiz disse que nenhum candidato serve: resposta valida, nao falha.
    // Duvida honesta com a lista do funil (nunca o melhor score da fonte).
    if (veredito.codigo_fipe === null) {
      return { escolhido: null, decididoPor: 'ambiguo', candidatos: filtrados.slice(0, 5), confianca: 'baixa', justificativa: veredito.justificativa }
    }

    const achado = filtrados.find((c) => c.codigo_fipe === veredito.codigo_fipe) || null
    if (!achado) return semAjuda()
    const escolhido = await comCodigoModelo(achado, marca, input.fipeApiUrl, input.fipeApiToken)

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
