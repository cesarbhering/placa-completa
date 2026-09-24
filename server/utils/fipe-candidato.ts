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
      codigoModelo: d.codigo_modelo ? String(d.codigo_modelo) : null,
    }))
}

// ---------------------------------------------------------------------------
// Resolucao lazy do codigo_modelo (so pro escolhido, so quando falta).
// /brands e /brands/{id}/models nao mudam com frequencia - cache em memoria
// do processo e suficiente, fail-open (null) em qualquer erro.
// ---------------------------------------------------------------------------

const brandIdCache = new Map<string, number>()

async function resolverBrandId(marca: string, fipeApiUrl: string, fipeApiToken: string): Promise<number | null> {
  const key = marca.trim().toLowerCase()
  if (brandIdCache.has(key)) return brandIdCache.get(key)!
  try {
    const res = await fetch(`${fipeApiUrl}/brands`, { headers: { Authorization: `Bearer ${fipeApiToken}` } })
    if (!res.ok) return null
    const body = await res.json()
    const lista = Array.isArray(body?.data) ? body.data : []
    for (const b of lista) {
      if (typeof b?.name === 'string' && typeof b?.id === 'number') {
        brandIdCache.set(b.name.trim().toLowerCase(), b.id)
      }
    }
    return brandIdCache.get(key) ?? null
  } catch {
    return null
  }
}

async function resolverCodigoModelo(
  marca: string,
  modeloNome: string,
  fipeApiUrl: string,
  fipeApiToken: string,
): Promise<string | null> {
  try {
    const brandId = await resolverBrandId(marca, fipeApiUrl, fipeApiToken)
    if (!brandId) return null
    const res = await fetch(`${fipeApiUrl}/brands/${brandId}/models`, { headers: { Authorization: `Bearer ${fipeApiToken}` } })
    if (!res.ok) return null
    const body = await res.json()
    const lista = Array.isArray(body?.data) ? body.data : []
    const match = lista.find((m: any) => typeof m?.name === 'string' && m.name.trim() === modeloNome.trim())
    return match?.fipe_code ? String(match.fipe_code) : null
  } catch {
    return null
  }
}

// Preenche codigoModelo do escolhido quando faltar (candidato veio do
// universo da fipe-api, nao da wdapi) - sem isso, price-history e seguro
// ficam sem series pra ele. Fail-open: erro/nao-achado deixa null, quem
// consome (valor-custo.ts) ja trata price-history/seguro ausentes.
async function comCodigoModelo(
  candidato: FipeCandidato,
  marca: string,
  fipeApiUrl: string,
  fipeApiToken: string,
): Promise<FipeCandidato> {
  if (candidato.codigoModelo) return candidato
  const codigoModelo = await resolverCodigoModelo(marca, candidato.modelo, fipeApiUrl, fipeApiToken)
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

/**
 * Melhor candidato da fonte livre QUANDO da pra confiar nele sozinho: score
 * alto e nome do modelo casando com o registro. Os dois juntos importam: score
 * alto com nome que nao bate ja apontou carro errado, e nome batendo com score
 * baixo e coincidencia de familia.
 */
const SCORE_CONFIAVEL = 85

function candidatoWdapiConfiavel(wdapi: any, tokensModelo: string[]): FipeCandidato | null {
  if (!tokensModelo.length) return null
  const melhor = melhorScoreWdapi(wdapi)
  if (!melhor) return null
  const dados = wdapi?.fipe?.dados
  const score = Array.isArray(dados)
    ? Math.max(...dados.filter((d: any) => d?.codigo_fipe === melhor.codigo_fipe).map((d: any) => Number(d?.score) || 0))
    : 0
  if (score < SCORE_CONFIAVEL) return null
  const nome = tokensModelo[0]
  return new RegExp(`\\b${escapeRegex(nome)}`, 'i').test(melhor.modelo) ? melhor : null
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

// SENATRAN as vezes gruda o cambio na cilindrada ("1.4MT", sem espaco) -
// por isso o (^|[^A-Z]) no lugar de \b antes de MT/AT/CVT.
function transmissaoDaDescricao(descricaoMarcaModelo: unknown): Transmissao {
  const texto = String(descricaoMarcaModelo || '').toUpperCase()
  if (/(?:^|[^A-Z])MT\b/.test(texto)) return 'manual'
  if (/(?:^|[^A-Z])(AT|CVT)\b/.test(texto)) return 'automatico'
  return null
}

export function candidatoEManual(modelo: string): boolean {
  return /\bMec\b|\bMec\./i.test(modelo)
}

export function candidatoEAutomatico(modelo: string): boolean {
  return /\bAut\b|\bAut\./i.test(modelo)
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
  return semMarca
    .split(/[^A-Z0-9.]+/)
    .filter(Boolean)
    .filter((t) => t.length >= 2 && !VERSAO_GENERICA.has(t))
    .slice(0, 4)
}

/** Mantem os candidatos que casam com o PRIMEIRO token do modelo (o nome). */
function filtrarPorTokensDoModelo(universo: FipeCandidato[], tokens: string[]): FipeCandidato[] {
  if (!tokens.length) return universo
  const nome = tokens[0]
  const comNome = universo.filter((c) => new RegExp(`\\b${escapeRegex(nome)}`, 'i').test(c.modelo))
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

function extrairFatos(senatran: FipeMelhorCandidatoInput['senatran'], wdapi: any): Fatos {
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
    moto: ehMoto(senatran, wdapi),
    tokensModelo: tokensDoModelo(senatran?.descricaoMarcaModelo || wdapi?.MODELO),
    cabine: cabineDaDescricao(senatran?.descricaoMarcaModelo),
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

  if (fatos.litragem.length) {
    const porLitragem = restantes.filter((c) => candidatoTemLitragem(c.modelo, fatos.litragem))
    if (porLitragem.length) restantes = porLitragem
  }

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
    `- marca/modelo/submodelo/versao (wdapi): ${marcaExibicao(wdapi)} / ${wdapi?.MODELO || ''} / ${wdapi?.SUBMODELO || ''} / ${wdapi?.VERSAO || ''}`,
    `- ano modelo: ${wdapi?.anoModelo ?? senatran?.anoModelo ?? 'desconhecido'}`,
    `- combustivel (wdapi): ${wdapi?.extra?.combustivel || 'desconhecido'}`,
    '',
    'Candidatos da tabela FIPE (ja pre-filtrados por cilindrada/carroceria/versao/cambio):',
    ...candidatos.map((c) => `- codigo_fipe=${c.codigo_fipe} | ${c.modelo} | valor=${c.valor ?? 'desconhecido'}`),
    '',
    'Escolha o candidato que melhor corresponde aos dados oficiais. Responda',
    'APENAS com um JSON no formato exato:',
    '{"codigo_fipe": "...", "confianca": "alta"|"media"|"baixa", "justificativa": "..."}',
    'Use "confianca":"baixa" se nao tiver certeza suficiente pra decidir entre os candidatos.',
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
    // texto_marca (fipe.dados) e o nome no "idioma" da propria FIPE/fipe-api -
    // NEM SEMPRE bate com wdapi.marca/MARCA (taxonomia da apiplacas/SENATRAN).
    // Achado real testando ONIX: wdapi.marca = "CHEVROLET", mas a fipe-api so
    // reconhece "GM - Chevrolet" (existe um outro brand "CHEVROLET" pra
    // CAMINHOES, entao usar o nome errado nao so falha - podia casar marca
    // errada). Cai pro wdapi so se fipe.dados vier vazio — e ai usa a marca de
    // EXIBICAO, nao o campo cru: em importado o cru e um codigo ("I"), que
    // buscaria o universo FIPE de uma marca inexistente.
    const marca = input.wdapi?.fipe?.dados?.[0]?.texto_marca || marcaExibicao(input.wdapi)
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

    // Atalho de confianca: quando a fonte livre ja tem um candidato com score
    // alto E o nome dele bate com o modelo do registro, ele E a resposta. Nao
    // ha por que passar isso por funil e por LLM: no caso da PCX 150 o
    // candidato certo vinha com score 92 e foi descartado no meio do caminho,
    // trocado por uma moto de 1000cc.
    const forte = candidatoWdapiConfiavel(input.wdapi, fatos.tokensModelo)
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

    const achado = filtrados.find((c) => c.codigo_fipe === veredito.codigo_fipe) || null
    if (!achado) return fallback()
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
