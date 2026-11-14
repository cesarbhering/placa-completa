// Vehicle history from the second partner base (Completa report only).
//
// Pure (no network). Two jobs:
//  1. parsearRespostaHistorico turns the partner answer into the CLEAN block
//     that goes to fonte_cache and to the order snapshot. The raw answer brings
//     name and CPF/CNPJ of every owner; none of that, nor address, city of an
//     owner, police report number, police station or image, leaves the parser.
//     The raw answer stays only in parceiro_historico_chamadas (server only).
//  2. The display rules of the three report blocks (owners, previous use,
//     insurance) and of the partner part of the auction section, which is
//     merged into historicoLeilao when the report is read.
// The vendor name never appears here: on screen, e-mail and JSON the source is
// "base parceira" (shared/fonte-parceira.ts).

import { FONTE_PARCEIRA, ROTULO_PARCEIRA, naoInformado, historicoComPassagensParceiras, type EstadoParceiro } from './fonte-parceira'
import { comitentePublico } from './leilao-lgpd'
import { comitenteExibicao, NOME_CASA_LEILAO, mesmoEventoLeilao } from './leilao-exibicao'

// divergente: the partner answered for another VIN than the vehicle's (nothing of it is shown).
export type StatusHistorico = 'ok' | 'falhou' | 'teto' | 'divergente'
export type TipoDono = 'pessoa' | 'loja' | 'empresa' | 'banco' | 'locadora' | 'seguradora' | 'orgao'

export interface DonoHistorico {
  /** AAAA-MM-DD */
  data: string
  /** Time with the vehicle as the source counts it ("2 anos e 3 meses"). */
  tempo: string | null
  meses: number | null
  tipo: TipoDono | null
  uf: string | null
  atual: boolean
}

export interface DonosHistorico {
  total: number
  /** Current owner: the latest dated record flagged as current (or the latest dated one). */
  atual: DonoHistorico | null
  /** States the vehicle went through: where it was bought new, then each owner in order. */
  ufs: string[]
  ufZeroKm: string | null
  /** Dated records, most recent first. Records without a date only count in the total. */
  registros: DonoHistorico[]
  semData: number
  /** Previous owners that kept the vehicle for less than 12 months. */
  trocasRapidas: number
}

export interface UsoHistorico {
  locadora: { ano: string | null } | null
  taxiPcd: boolean
  viatura: boolean
  frotaPublica: boolean
  religiosa: boolean
  segurancaPrivada: boolean
  lojaSalvados: boolean
  /** Private company in the chain of owners: never its name. */
  empresas: { loja: boolean; ano: string | null }[]
  frotista: { veiculos: number | null; data: string | null } | null
  /** Bank or finance company that held the vehicle (a company: the name may show). */
  financeiras: { instituicao: string | null; ano: string | null }[]
  /** Insurer that held the vehicle in its portfolio. */
  seguradoras: { seguradora: string | null; ano: string | null }[]
}

export type NivelMonta = 'pequena' | 'media' | 'grande'

export interface SinistroHistorico {
  indenizacoes: { seguradora: string | null; ano: string | null }[]
  monta: { nivel: NivelMonta | null; ano: string | null } | null
  acidentes: { data: string | null; local: string | null; tipo: string | null }[]
  recuperado: boolean
  roubo: { evento: 'registro' | 'recuperacao' | 'devolucao'; ano: string | null }[]
  restricaoSeguro: boolean
  chassiSuspeito: boolean
  alteracaoCaracteristicas: boolean
  /** Computed here, so the two indicators that only feed it never leave the server. */
  parecer: 'alto' | 'atencao' | null
}

export interface RegistroLeilaoHistorico {
  /** edital: notice with a real lot; orgao: public body auction; salvado: salvage sale by an insurer. */
  tipo: 'edital' | 'orgao' | 'salvado'
  ano: string | null
  lote: string | null
  /** Auction house, only when the name is a house (never a person nor a generic text). */
  casa: string | null
  comitente: string | null
}

export interface LeilaoHistorico {
  registros: RegistroLeilaoHistorico[]
  /** Total loss, damage, recovered from claim or accident in the partner base. */
  indicioSinistro: boolean
  /** VIN the partner answered for, to check against the order VIN. Never goes to the page. */
  chassiFonte: string | null
}

export interface HistoricoVeicular {
  status: StatusHistorico
  consultadoEm: string | null
  /** Why it is not here (failure kind, VIN divergence). Never the VIN nor the answer. */
  motivo?: string | null
  donos?: DonosHistorico | null
  uso?: UsoHistorico | null
  sinistro?: SinistroHistorico | null
  leilao?: LeilaoHistorico | null
}

// ---------------------------------------------------------------- helpers

const UFS = new Set(['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'])
const obj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
const sem = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
const digitos = (s: unknown) => String(s ?? '').replace(/\D/g, '')
const umDe = (o: any, ks: string[]) => ks.map((k) => o?.[k]).find((v) => v !== undefined && v !== null && v !== '')

export function ufValida(v: unknown): string | null {
  const s = String(v ?? '').trim().toUpperCase()
  return UFS.has(s) ? s : null
}

/** "dd/mm/aaaa", "aaaa-mm-dd" (with or without time) -> "aaaa-mm-dd"; anything else null. */
export function dataIsoHistorico(v: unknown): string | null {
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

function anoDe(v: unknown): string | null {
  const s = String(v ?? '').trim()
  const m = s.match(/^(\d{4})$/) || s.match(/\b(19\d{2}|20\d{2})\b/)
  return m ? m[1] : null
}

/** "8 anos e 4 meses (Vigente)" -> "8 anos e 4 meses"; "Tempo não informado" -> null. */
export function tempoDePosse(v: unknown): string | null {
  const s = String(v ?? '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  if (!s || /n[aã]o informad/i.test(s) || !/\d/.test(s)) return null
  return s
}

/** "8 anos e 4 meses" -> 100; "1 mês" -> 1; "15 dias" -> 0; nothing readable -> null. */
export function mesesDePosse(v: unknown): number | null {
  const s = sem(v)
  const anos = s.match(/(\d+)\s*ANOS?\b/)
  const meses = s.match(/(\d+)\s*MES(ES)?\b/)
  const dias = s.match(/(\d+)\s*DIAS?\b/)
  if (!anos && !meses && !dias) return null
  return (anos ? Number(anos[1]) * 12 : 0) + (meses ? Number(meses[1]) : 0)
}

// Used-vehicle retail and consignment (CNAE 4511-1/02, 4512-9/02, 4541-2/04).
const CNAE_LOJA_USADOS = new Set(['4511102', '4512902', '4541204'])

/** Kind of owner from the record itself: document type, CNAE, legal nature, entity class. */
export function tipoDoDono(h: any): TipoDono | null {
  if (!obj(h)) return null
  const doc = sem(umDe(h, ['tipo', 'tipoDocumento', 'tipo_documento', 'tipoDoc']))
  const classe = sem(umDe(h, ['classificacaoEntidade', 'tipoEntidade', 'classificacao_entidade']))
  const cnae = digitos(umDe(h, ['cnae', 'cnae_codigo', 'codigoCnae']))
  const desc = sem(umDe(h, ['cnae_descricao', 'cnaeDescricao']))
  const nat = sem(umDe(h, ['natureza_juridica', 'naturezaJuridica']))
  const codNat = digitos(umDe(h, ['codigoNaturezaJuridica', 'codigo_natureza_juridica']))
  if (/FISICA/.test(doc) || /^PARTICULAR$/.test(classe)) return 'pessoa'
  if (/FINANCEIR|BANCO|LEASING/.test(classe) || cnae.startsWith('64')) return 'banco'
  if (/SEGURADOR/.test(classe) || /^65[12]/.test(cnae)) return 'seguradora'
  if (/LOCADORA|LOCACAO/.test(classe) || cnae.startsWith('7711')) return 'locadora'
  if (/ORGAO|PUBLIC|GOVERNO/.test(classe) || codNat.startsWith('1') || /ADMINISTRACAO PUBLICA|ORGAO PUBLICO|AUTARQUIA/.test(nat)) return 'orgao'
  if (CNAE_LOJA_USADOS.has(cnae) || (/^45/.test(cnae) && /USAD/.test(desc))) return 'loja'
  if (/JURIDICA/.test(doc) || /EMPRESA/.test(classe) || cnae) return 'empresa'
  return null
}

const ehLojaUsados = (r: any) => tipoDoDono({ ...r, tipo: 'Pessoa juridica' }) === 'loja'

// ---------------------------------------------------------------- indicators

interface Indicador { positivo: boolean; conteudo: any; mensagem: string }

function lerIndicadores(d: any): Map<string, Indicador> {
  const mapa = new Map<string, Indicador>()
  for (const i of Array.isArray(d?.indicadores) ? d.indicadores : []) {
    if (!obj(i)) continue
    const codigo = String(i.codigo ?? i.chave ?? '').trim().toUpperCase()
    if (!/^P\d{1,2}$/.test(codigo)) continue
    const st = String(i.status ?? '').toLowerCase()
    mapa.set(codigo, {
      positivo: st === 'positivo' || (st !== 'negativo' && i.consta === true),
      conteudo: i.conteudo ?? i.detalhes ?? null,
      mensagem: String(i.mensagem ?? ''),
    })
  }
  return mapa
}

// ---------------------------------------------------------------- owners

function donosDe(d: any): DonosHistorico | null {
  const p = d?.proprietarios
  if (!obj(p)) return null
  const hist: any[] = (Array.isArray(p.historico) ? p.historico : []).filter(obj)
  const total = Math.max(Number(p.total) || 0, hist.length)
  if (!total) return null
  const regs = hist
    .map((h, i) => ({
      ordem: Number(h.ordem) || i + 1,
      dono: {
        data: dataIsoHistorico(umDe(h, ['data', 'dataRaw'])),
        tempo: tempoDePosse(umDe(h, ['tempoDePosse', 'tempoPosse'])),
        meses: mesesDePosse(umDe(h, ['tempoDePosse', 'tempoPosse'])),
        tipo: tipoDoDono(h),
        uf: ufValida(h.uf),
        atual: h.atual === true,
      },
    }))
    .sort((a, b) => a.ordem - b.ordem)
  const datados = regs.filter((r) => r.dono.data).map((r) => r.dono as DonoHistorico)
    .sort((a, b) => a.data.localeCompare(b.data))
  const atual = [...datados].reverse().find((o) => o.atual) ?? datados[datados.length - 1] ?? null
  const ufZeroKm = ufValida(d?.outros_produtos?.circulacao?.adquirido_0km)
  const ufs = [...new Set([ufZeroKm, ...regs.map((r) => r.dono.uf)].filter((u): u is string => !!u))]
  return {
    total,
    atual,
    ufs,
    ufZeroKm,
    registros: [...datados].reverse(),
    semData: Math.max(0, total - datados.length),
    trocasRapidas: datados.filter((o) => o !== atual && o.meses != null && o.meses < 12).length,
  }
}

// ---------------------------------------------------------------- previous use

// CNPJ and CPF, formatted or as plain digits: never go with a company name.
const RE_DOCUMENTO = /\b\d{2}\.?\d{3}\.?\d{3}\s*\/?\s*\d{4}\s*-?\s*\d{2}\b|\b\d{3}\.?\d{3}\.?\d{3}\s*-?\s*\d{2}\b/g

/**
 * Company name for the screen: only when it is a company (bank, insurer,
 * agency), never a person, and never with its CNPJ or a CPF. Read only from
 * company fields: the "nome" field of this partner is the holder's name.
 */
export function nomeDeEmpresa(v: unknown): string | null {
  const s = naoInformado(semDocumento(v))
  if (!s) return null
  return comitentePublico(s)
}

/** The text without CNPJ or CPF (formatted or plain digits) and without the separator left behind. */
function semDocumento(v: unknown): string {
  return String(v ?? '').replace(RE_DOCUMENTO, ' ').replace(/[\s,;:–-]+$/g, '').replace(/\s{2,}/g, ' ').trim()
}

function usoDe(d: any, ind: Map<string, Indicador>): UsoHistorico {
  const pos = (c: string) => ind.get(c)?.positivo === true
  const lista = (c: string, reserva?: unknown): any[] => {
    const v = ind.get(c)?.conteudo
    if (Array.isArray(v)) return v.filter(obj)
    if (obj(v)) return [v]
    return Array.isArray(reserva) ? reserva.filter(obj) : []
  }
  const locadoraLigada = pos('P4') || String(d?.locadoras?.status || '').toLowerCase() === 'positivo'
  const locs = lista('P4', d?.locadoras?.registros)
  const frotaLigada = pos('P3') || String(d?.frota_publica?.status || '').toLowerCase() === 'positivo'

  const empresas: UsoHistorico['empresas'] = []
  for (const r of lista('P23')) {
    const e = { loja: ehLojaUsados(r), ano: anoDe(r.ano) ?? anoDe(dataIsoHistorico(r.data)) }
    if (!empresas.some((x) => x.loja === e.loja && x.ano === e.ano)) empresas.push(e)
  }
  if (pos('P23') && !empresas.length) empresas.push({ loja: false, ano: null })

  let frotista: UsoHistorico['frotista'] = null
  if (pos('P34')) {
    const f = lista('P34')[0] || {}
    const n = Number(digitos(umDe(f, ['qtdade_veiculos_comprados', 'quantidade', 'qtd'])))
    frotista = { veiculos: Number.isFinite(n) && n > 0 ? n : null, data: dataIsoHistorico(umDe(f, ['data_compra', 'data'])) }
  }

  const financeiras: UsoHistorico['financeiras'] = []
  for (const r of pos('P7') || !ind.has('P7') ? lista('P7', d?.financeiras?.registros) : []) {
    const f = { instituicao: nomeDeEmpresa(umDe(r, ['instituicao', 'razao_social'])), ano: anoDe(r.ano) ?? anoDe(dataIsoHistorico(r.data)) }
    if (!financeiras.some((x) => sem(x.instituicao) === sem(f.instituicao) && x.ano === f.ano)) financeiras.push(f)
  }

  const seguradoras: UsoHistorico['seguradoras'] = []
  for (const r of eventosSeguradora(d, ind)) {
    if (!/TITULARIDADE|CARTEIRA/.test(sem(r.tipoEvento))) continue
    const s = { seguradora: nomeDeEmpresa(umDe(r, ['seguradora', 'razao_social'])), ano: anoDe(r.ano) }
    if (!seguradoras.some((x) => sem(x.seguradora) === sem(s.seguradora) && x.ano === s.ano)) seguradoras.push(s)
  }

  return {
    locadora: locadoraLigada ? { ano: locs.map((r) => anoDe(r.ano) ?? anoDe(dataIsoHistorico(r.data))).find(Boolean) ?? null } : null,
    taxiPcd: pos('P27'),
    viatura: pos('P2') || d?.frota_publica?.isViatura === true,
    frotaPublica: frotaLigada,
    religiosa: pos('P5'),
    segurancaPrivada: pos('P6'),
    lojaSalvados: pos('P8'),
    empresas,
    frotista,
    financeiras,
    seguradoras,
  }
}

/** Insurer records (P1, or the insurers block when the indicator is missing). */
function eventosSeguradora(d: any, ind: Map<string, Indicador>): any[] {
  const v = ind.get('P1')
  if (v) return v.positivo && Array.isArray(v.conteudo) ? v.conteudo.filter(obj) : []
  return Array.isArray(d?.seguradoras?.registros) ? d.seguradoras.registros.filter(obj) : []
}

// ---------------------------------------------------------------- insurance and damage

function montaDe(texto: string): SinistroHistorico['monta'] {
  const s = sem(texto)
  const m = s.match(/\b(PEQUENA|MEDIA|GRANDE)\s+MONTA\b/)
  const nivel = m ? ({ PEQUENA: 'pequena', MEDIA: 'media', GRANDE: 'grande' } as const)[m[1] as 'PEQUENA' | 'MEDIA' | 'GRANDE'] : null
  const ano = s.match(/\bEM\s+(\d{4})\b/)?.[1] ?? anoDe(s)
  return { nivel, ano }
}

// Accident records (P12 basic, P13 detailed). No sample of their content yet:
// read tolerantly, taking only date, city/UF of the accident and type (never
// the address). Positive without records: one entry with the year, if any.
function acidentesDe(ind: Map<string, Indicador>): SinistroHistorico['acidentes'] {
  const out: SinistroHistorico['acidentes'] = []
  const positivos = ['P12', 'P13'].map((c) => ind.get(c)).filter((i): i is Indicador => !!i?.positivo)
  for (const i of positivos) {
    const regs = Array.isArray(i.conteudo) ? i.conteudo.filter(obj) : obj(i.conteudo) ? [i.conteudo] : []
    for (const r of regs) {
      const data = dataIsoHistorico(umDe(r, ['data', 'dataHora', 'data_hora', 'data_ocorrencia', 'dataOcorrencia', 'dataAcidente', 'data_acidente'])) ?? anoDe(umDe(r, ['ano']))
      const cidade = naoInformado(umDe(r, ['municipio', 'cidade']))
      const uf = ufValida(umDe(r, ['uf', 'estado']))
      const local = cidade ? `${tituloSimples(cidade)}${uf ? `/${uf}` : ''}` : uf
      const tipoBruto = naoInformado(umDe(r, ['tipo', 'tipoAcidente', 'tipo_acidente', 'natureza', 'classificacao']))
      const tipo = tipoBruto ? tituloSimples(tipoBruto) : null
      if (!out.some((x) => x.data === data && x.tipo === tipo && x.local === local)) out.push({ data, local, tipo })
    }
  }
  if (!out.length && positivos.length) out.push({ data: positivos.map((i) => anoDe(i.mensagem)).find(Boolean) ?? null, local: null, tipo: null })
  return out
}

function rouboDe(d: any, ind: Map<string, Indicador>): SinistroHistorico['roubo'] {
  const i = ind.get('P10')
  const regs: any[] = i
    ? (i.positivo && Array.isArray(i.conteudo) ? i.conteudo.filter(obj) : [])
    : (Array.isArray(d?.roubo_furto?.ocorrencias) ? d.roubo_furto.ocorrencias.filter(obj) : [])
  const out: SinistroHistorico['roubo'] = []
  for (const r of regs) {
    const t = sem(r.tipo)
    const evento = /RECUPERA/.test(t) ? 'recuperacao' as const : /DEVOLU/.test(t) ? 'devolucao' as const : 'registro' as const
    const ano = anoDe(r.ano) ?? anoDe(dataIsoHistorico(r.data)) ?? anoDe(r.data)
    if (!out.some((x) => x.evento === evento && x.ano === ano)) out.push({ evento, ano })
  }
  if (i?.positivo && !out.length) out.push({ evento: 'registro', ano: anoDe(i.mensagem) })
  return out
}

function sinistroDe(d: any, ind: Map<string, Indicador>): SinistroHistorico {
  const pos = (c: string) => ind.get(c)?.positivo === true
  const indenizacoes: SinistroHistorico['indenizacoes'] = []
  const p14 = ind.get('P14')
  const regs14: any[] = p14
    ? (p14.positivo && Array.isArray(p14.conteudo) ? p14.conteudo.filter(obj) : [])
    : (Array.isArray(d?.seguradoras?.registrosIndenizacao) ? d.seguradoras.registrosIndenizacao.filter(obj) : [])
  for (const r of regs14) {
    const x = { seguradora: nomeDeEmpresa(umDe(r, ['seguradora', 'razao_social'])), ano: anoDe(r.ano) }
    if (!indenizacoes.some((y) => sem(y.seguradora) === sem(x.seguradora) && y.ano === x.ano)) indenizacoes.push(x)
  }
  if ((p14?.positivo || (!p14 && d?.seguradoras?.indenizacaoIntegral === true)) && !indenizacoes.length) indenizacoes.push({ seguradora: null, ano: null })

  const p15 = ind.get('P15')
  const monta = p15?.positivo ? montaDe(typeof p15.conteudo === 'string' ? p15.conteudo : p15.mensagem) : null
  const acidentes = acidentesDe(ind)
  const recuperado = pos('P19') || pos('P20') || (!ind.has('P19') && !!naoInformado(d?.outros_produtos?.sinistro_recuperado))
  const roubo = rouboDe(d, ind)
  const restricaoSeguro = pos('P9')
  const chassiSuspeito = pos('P16')
  const alteracaoCaracteristicas = pos('P33')

  // Opinion on insurance acceptance (prototype approved on 13/11/2026). P24
  // (exposure to claims) and P18 (police record) only feed it.
  const alto = indenizacoes.length > 0 || monta?.nivel === 'media' || monta?.nivel === 'grande' || restricaoSeguro || chassiSuspeito
  const atencao = !!monta || acidentes.length > 0 || recuperado || roubo.length > 0 || alteracaoCaracteristicas || pos('P24') || pos('P18')
  return {
    indenizacoes, monta, acidentes, recuperado, roubo, restricaoSeguro, chassiSuspeito, alteracaoCaracteristicas,
    parecer: alto ? 'alto' : atencao ? 'atencao' : null,
  }
}

// ---------------------------------------------------------------- auction

// Generic or automatic auctioneer texts (13/11/2026 sample: "2025 without a lot"
// showed up in 5 of 7 cars with an edital and looks like automatic filling).
const RE_CASA_GENERICA = /COMPARTILHADA|MULTIPLOS LEILOEIROS|MAIS DE UM LEILOEIRO|^WEB\b|NADA CONSTA|^DIVERSOS$|^VARIOS$|NAO INFORMAD|NAO DIVULGAD/
// A house name, not a person: "... Leilões", "Leilão ...", company suffixes.
const RE_CASA = /\bLEILOES\b|\bLEILAO\b|\bLTDA\b|\bS\/?A\b|\bS\.A\.?|\bEIRELI\b/

/** Auction house name for the card, or null (generic, automatic or a person's name). Never with a CNPJ or CPF. */
export function casaDoRegistro(v: unknown): string | null {
  const s = naoInformado(semDocumento(v))
  if (!s) return null
  const n = sem(s)
  if (RE_CASA_GENERICA.test(n)) return null
  const primeira = n.split(/[^A-Z0-9]+/).filter(Boolean)[0]?.toLowerCase() || ''
  if (RE_CASA.test(n) && NOME_CASA_LEILAO[primeira]) return NOME_CASA_LEILAO[primeira]
  if (!RE_CASA.test(n)) return null
  return comitenteExibicao(s)?.texto ?? null
}

// A lot has at least one digit and is not only zeros ("NADA CONSTA", "S/N",
// "SEM NÚMERO", "*", "." and "000" are not a lot).
function loteReal(v: unknown): string | null {
  const s = naoInformado(v)
  if (!s || !/\d/.test(s)) return null
  return /NADA CONSTA|NAO CONSTA|SEM LOTE|^S\s*\/?\s*N$|SEM NUMERO|^N\/?A$|NAO INFORMAD|^0+$/.test(sem(s)) ? null : s
}

// Public body as principal (review 2 of PR #752): without a lot, only these make a passage.
const RE_ORGAO_PUBLICO = /\b(PREFEITURA|DETRAN|MUNICIP\w*|SECRETARIA|POLICIA|DEPARTAMENTO|GOVERNO|RECEITA|DER|TRIBUNAL|JUSTICA)\b/
export function ehOrgaoPublico(v: unknown): boolean {
  return RE_ORGAO_PUBLICO.test(sem(v))
}

/** Principal of the auction: a company or agency by name; generic texts ("PARTICULAR", "DIVERSOS") are not one. */
function comitenteDoRegistro(v: unknown): string | null {
  const c = nomeDeEmpresa(v)
  return c && !comitenteExibicao(c)?.generico ? c : null
}

function leilaoDe(d: any, ind: Map<string, Indicador>): LeilaoHistorico {
  const p11 = ind.get('P11')
  const entradas: any[] = [
    ...(p11?.positivo && Array.isArray(p11.conteudo) ? p11.conteudo : []),
    ...(Array.isArray(d?.outros_produtos?.leiloes) ? d.outros_produtos.leiloes : []),
  ].filter(obj)
  const registros: RegistroLeilaoHistorico[] = []
  const add = (r: RegistroLeilaoHistorico) => {
    const k = (x: RegistroLeilaoHistorico) => [x.tipo, x.ano, sem(x.lote), sem(x.casa), sem(x.comitente)].join('|')
    if (!registros.some((x) => k(x) === k(r))) registros.push(r)
  }
  for (const e of entradas) {
    const lote = loteReal(e.lote)
    const comitente = comitenteDoRegistro(umDe(e, ['comitente', 'orgao', 'orgao_responsavel']))
    const ano = anoDe(e.ano) ?? anoDe(dataIsoHistorico(e.data))
    // Without a lot, only a public body as principal makes a passage (a
    // company or a generic principal does not): the rest stays only in the
    // restricted table.
    if (lote) add({ tipo: 'edital', ano, lote, casa: casaDoRegistro(e.leiloeiro), comitente })
    else if (comitente && ehOrgaoPublico(comitente)) add({ tipo: 'orgao', ano, lote: null, casa: casaDoRegistro(e.leiloeiro), comitente })
  }
  for (const r of eventosSeguradora(d, ind)) {
    if (!/VENDA DIRETA|REMARKETING|SALVAD/.test(sem(r.tipoEvento))) continue
    add({ tipo: 'salvado', ano: anoDe(r.ano), lote: null, casa: null, comitente: nomeDeEmpresa(umDe(r, ['seguradora', 'razao_social'])) })
  }
  const pos = (c: string) => ind.get(c)?.positivo === true
  const indicioSinistro = ['P14', 'P15', 'P19', 'P20', 'P12', 'P13'].some(pos)
    || (!ind.has('P14') && d?.seguradoras?.indenizacaoIntegral === true)
  const chassi = String(umDe(d, ['chassi']) ?? umDe(d?.veiculo, ['chassi']) ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return { registros, indicioSinistro, chassiFonte: chassi.length === 17 ? chassi : null }
}

// ---------------------------------------------------------------- parser

/**
 * Partner answer -> clean block (status 'ok'). null when the answer is not a
 * success or has no data. Nothing personal comes out: the block is built field
 * by field from what the report shows, never by copying the answer.
 */
export function parsearRespostaHistorico(body: any): HistoricoVeicular | null {
  if (!obj(body) || body.success !== true || !obj(body.dados)) return null
  const d = body.dados
  const ind = lerIndicadores(d)
  return {
    status: 'ok',
    consultadoEm: null,
    donos: donosDe(d),
    uso: usoDe(d, ind),
    sinistro: sinistroDe(d, ind),
    leilao: leilaoDe(d, ind),
  }
}

// ---------------------------------------------------------------- auction section merge

const so = (s: unknown) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

export const MOTIVO_CHASSI_DIVERGENTE = 'chassi da base parceira diferente do chassi do veículo'

/**
 * The partner answered for another VIN than this vehicle's (both complete):
 * nothing of it is shown (the three blocks, the auction part, the damage
 * indicator). What stays is only the reason, never the VIN.
 */
export function historicoDoVeiculo(hv: HistoricoVeicular | null | undefined, chassiVeiculo: unknown): HistoricoVeicular | null {
  if (!obj(hv)) return null
  if (hv.status !== 'ok') return hv
  const nosso = so(chassiVeiculo)
  const deles = so(hv.leilao?.chassiFonte)
  if (nosso.length === 17 && deles.length === 17 && nosso !== deles) return { status: 'divergente', consultadoEm: hv.consultadoEm ?? null, motivo: MOTIVO_CHASSI_DIVERGENTE }
  return hv
}

/** Partner records as auction passages (same shape as shared/fonte-parceira.ts). */
export function passagensDoHistorico(l: LeilaoHistorico | null | undefined, ctx: { chassi?: string | null }) {
  if (!l || !Array.isArray(l.registros)) return []
  const nosso = so(ctx.chassi)
  const chassiIgual = nosso.length === 17 && so(l.chassiFonte) === nosso
  return l.registros.map((r) => ({
    nivel: 'confirmado' as const,
    score: 100,
    fonte: FONTE_PARCEIRA,
    fonte_tipo: FONTE_PARCEIRA,
    fonte_uf: null,
    fonte_exibicao: ROTULO_PARCEIRA,
    gravidade: null,
    detalhes: {},
    data_leilao: null,
    // The partner gives only the year; insurer years may be when the record entered its base.
    ano_leilao: r.ano,
    registro: r.tipo,
    ref: null,
    lote: r.lote,
    valor: null,
    situacao: null,
    leiloeiro: r.casa,
    // Same spelling as the blocks (acronyms in capitals: "HDI Seguros S/A").
    comitente: nomeEmpresa(r.comitente),
    veiculo_na_fonte: null,
    evidencias: [chassiIgual ? 'chassi igual' : 'placa igual'],
    conflitos: [] as string[],
    fotos: [] as string[],
    foto_refs: [],
    fotos_pendente: false,
    edital_disponivel: false,
    edital_ref: null,
    pagina_publica_url: null,
    origem: null,
    alertas: [],
    desfecho: null,
    lote_publico: null,
    contexto_judicial: null,
  }))
}

/**
 * The auction history as the report shows it: our base (historicoLeilao, as
 * stored) plus the partner part of the vehicle history. Done on every read, so
 * the snapshot keeps our base intact (lazy fill and rebuild still work on it).
 * Without our base (null) nothing is merged: the section only exists when our
 * base answered. A failed or capped partner call shows as "Base parceira: não
 * foi possível consultar agora" in the empty state.
 */
export function historicoLeilaoComHistorico(h: any, hvBruto: HistoricoVeicular | null | undefined, ctx: { chassi?: string | null } = {}): any {
  const hv = historicoDoVeiculo(hvBruto, ctx.chassi)
  if (!obj(h) || !Array.isArray(h.passagens) || !obj(hv)) return h
  if (hv.status === 'falhou' || hv.status === 'teto') {
    return h.parceiro ? h : { ...h, parceiro: { status: hv.status, consultado_em: hv.consultadoEm ?? null } as EstadoParceiro }
  }
  // Another VIN (divergente) or unknown state: nothing of the partner.
  if (hv.status !== 'ok') return h
  const leilao = obj(hv.leilao) ? hv.leilao : null
  // The auction partner may already be in this history (operator run on an
  // order it served): its records and its damage flag stay, the same auction
  // is not repeated, and the flag is the OR of both.
  const jaTinha = h.parceiro?.status === 'ok'
  const antigas = h.passagens.filter((p: any) => p?.fonte_tipo === FONTE_PARCEIRA || p?.fonte === FONTE_PARCEIRA)
  const novas = passagensDoHistorico(leilao, ctx).filter((n) => !antigas.some((a: any) => mesmoEventoLeilao(n, a)))
  return historicoComPassagensParceiras(h, novas, {
    sinistro: {
      indicio: leilao?.indicioSinistro === true || (jaTinha && h.sinistro_parceiro?.indicio === true),
      mensagem: jaTinha ? (h.sinistro_parceiro?.mensagem ?? null) : null,
    },
    parceiro: jaTinha ? h.parceiro : { status: 'ok', id_consulta: null, consultado_em: hv.consultadoEm ?? null },
  })
}

/**
 * Card title of a partner passage without a full date: "Leilão em 2019" or, for
 * a salvage sale, "Venda de salvado pela X, registrada em 2024" (the insurer
 * year may be when the record entered the partner base). null = default title.
 */
export function tituloPassagemParceira(p: any): string | null {
  if (!obj(p) || p.fonte_tipo !== FONTE_PARCEIRA || p.data_leilao) return null
  const ano = /^\d{4}$/.test(String(p.ano_leilao ?? '')) ? String(p.ano_leilao) : null
  if (p.registro === 'salvado') {
    const quem = comitenteExibicao(p.comitente)?.texto
    return `Venda de salvado ${quem ? `pela ${quem}` : 'por seguradora'}${ano ? `, registrada em ${ano}` : ''}`
  }
  return ano ? `Leilão em ${ano}` : null
}

// ---------------------------------------------------------------- what goes to the page

const txt = (v: unknown, max = 120): string | null => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, max) : null
}
const anoOk = (v: unknown) => (/^\d{4}$/.test(String(v ?? '')) ? String(v) : null)
const dataOk = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : /^\d{4}$/.test(String(v ?? '')) ? String(v) : null)
const TIPOS_DONO = new Set<TipoDono>(['pessoa', 'loja', 'empresa', 'banco', 'locadora', 'seguradora', 'orgao'])
const listaTela = <T>(v: unknown, f: (x: any) => T, max = 60): T[] => (Array.isArray(v) ? v.filter(obj).slice(0, max).map(f) : [])

function donoTela(o: any): DonoHistorico {
  return {
    data: dataOk(o.data) || '',
    tempo: txt(o.tempo, 40),
    meses: Number.isFinite(Number(o.meses)) && o.meses != null ? Number(o.meses) : null,
    tipo: TIPOS_DONO.has(o.tipo) ? o.tipo : null,
    uf: ufValida(o.uf),
    atual: o.atual === true,
  }
}

/**
 * The block as it goes in the report JSON: allow-list of fields, rebuilt one
 * by one (an unexpected field in the snapshot never reaches the page). The
 * auction part is not here: it goes merged into historicoLeilao.
 */
export function historicoVeicularParaTela(hv: any): Omit<HistoricoVeicular, 'leilao'> | null {
  if (!obj(hv) || !['ok', 'falhou', 'teto', 'divergente'].includes(hv.status)) return null
  const base = { status: hv.status as StatusHistorico, consultadoEm: txt(hv.consultadoEm, 40) }
  if (hv.status !== 'ok') return base
  const d = obj(hv.donos) ? hv.donos : null
  const u = obj(hv.uso) ? hv.uso : null
  const s = obj(hv.sinistro) ? hv.sinistro : null
  return {
    ...base,
    donos: d && Number(d.total) > 0
      ? {
          total: Number(d.total),
          atual: obj(d.atual) && dataOk(d.atual.data) ? donoTela(d.atual) : null,
          ufs: Array.isArray(d.ufs) ? [...new Set(d.ufs.map(ufValida).filter((x: string | null): x is string => !!x))] as string[] : [],
          ufZeroKm: ufValida(d.ufZeroKm),
          registros: listaTela(d.registros, donoTela).filter((o) => o.data),
          semData: Math.max(0, Number(d.semData) || 0),
          trocasRapidas: Math.max(0, Number(d.trocasRapidas) || 0),
        }
      : null,
    uso: u
      ? {
          locadora: obj(u.locadora) ? { ano: anoOk(u.locadora.ano) } : null,
          taxiPcd: u.taxiPcd === true,
          viatura: u.viatura === true,
          frotaPublica: u.frotaPublica === true,
          religiosa: u.religiosa === true,
          segurancaPrivada: u.segurancaPrivada === true,
          lojaSalvados: u.lojaSalvados === true,
          empresas: listaTela(u.empresas, (o) => ({ loja: o.loja === true, ano: anoOk(o.ano) }), 20),
          frotista: obj(u.frotista) ? { veiculos: Number(u.frotista.veiculos) > 0 ? Number(u.frotista.veiculos) : null, data: dataOk(u.frotista.data) } : null,
          financeiras: listaTela(u.financeiras, (o) => ({ instituicao: nomeDeEmpresa(txt(o.instituicao)), ano: anoOk(o.ano) }), 20),
          seguradoras: listaTela(u.seguradoras, (o) => ({ seguradora: nomeDeEmpresa(txt(o.seguradora)), ano: anoOk(o.ano) }), 20),
        }
      : null,
    sinistro: s
      ? {
          indenizacoes: listaTela(s.indenizacoes, (o) => ({ seguradora: nomeDeEmpresa(txt(o.seguradora)), ano: anoOk(o.ano) }), 20),
          monta: obj(s.monta) ? { nivel: ['pequena', 'media', 'grande'].includes(s.monta.nivel) ? s.monta.nivel : null, ano: anoOk(s.monta.ano) } : null,
          acidentes: listaTela(s.acidentes, (o) => ({ data: dataOk(o.data), local: txt(o.local, 60), tipo: txt(o.tipo, 60) }), 20),
          recuperado: s.recuperado === true,
          roubo: listaTela(s.roubo, (o) => ({ evento: ['registro', 'recuperacao', 'devolucao'].includes(o.evento) ? o.evento : 'registro', ano: anoOk(o.ano) }), 20),
          restricaoSeguro: s.restricaoSeguro === true,
          chassiSuspeito: s.chassiSuspeito === true,
          alteracaoCaracteristicas: s.alteracaoCaracteristicas === true,
          parecer: s.parecer === 'alto' || s.parecer === 'atencao' ? s.parecer : null,
        }
      : null,
  }
}

// ---------------------------------------------------------------- copy (public)
// Never more than the source says. No dash, no vendor name, no federal agency.

export const ROTULO_TIPO_DONO: Record<TipoDono, string> = {
  pessoa: 'Pessoa',
  loja: 'Loja de usados',
  empresa: 'Empresa',
  banco: 'Banco ou leasing',
  locadora: 'Locadora',
  seguradora: 'Seguradora',
  orgao: 'Órgão público',
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
export const dataBR = (iso: string | null | undefined): string | null => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : /^\d{4}$/.test(String(iso || '')) ? String(iso) : null
}
const juntar = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)
const CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
const SIGLAS = new Set(['SA', 'S/A', 'BB', 'BV', 'BMG', 'HDI', 'BRB', 'BNDES', 'ME', 'EPP', 'EIRELI'])

/** Company name for the screen: "BANCO EXEMPLO S.A. ARRENDAMENTO" -> "Banco Exemplo S.A. Arrendamento". */
export function nomeEmpresa(v: unknown): string | null {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return null
  if (s !== s.toUpperCase()) return s
  const parte = (p: string) => (p.length <= 1 || !/[AEIOU]/.test(sem(p)) ? p.toUpperCase() : p.charAt(0) + p.slice(1).toLowerCase())
  return s.split(' ').map((w, i) => {
    const min = w.toLowerCase()
    if (i > 0 && CONECTIVOS.has(min)) return min
    if (SIGLAS.has(w.replace(/\./g, ''))) return w
    if (/^LTDA\.?$/.test(w)) return 'Ltda'
    if (/^CIA\.?$/.test(w)) return 'Cia'
    return w.split(/([./-])/).map((p) => (/^[./-]$/.test(p) ? p : parte(p))).join('')
  }).join(' ')
}

function tituloSimples(s: string): string {
  const t = String(s).replace(/\s+/g, ' ').trim()
  if (!t || t !== t.toUpperCase()) return t
  return t.toLowerCase().replace(/(^|[\s/-])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase())
}

export interface LinhaDono { data: string; tipo: string; uf: string | null; posse: string; curta: boolean; largura: number; atual: boolean }

export interface TelaDonos {
  total: number
  totalTexto: string
  atual: { desde: string | null; tempo: string | null } | null
  estados: string[]
  zeroKm: string | null
  linhas: LinhaDono[]
  alertaTrocaRapida: string | null
  nota: string
}

export const DONOS_VISIVEIS = 5

/** A tenure inside a sentence starts in lower case ("Dono atual, há menos de 1 mês"). */
function noMeioDaFrase(t: string): string {
  return t.charAt(0).toLowerCase() + t.slice(1)
}

/** Owners block (always when the partner answered with owners). */
export function telaDonos(d: DonosHistorico | null | undefined, nomeVeiculo = 'veículo'): TelaDonos | null {
  if (!d || !(Number(d.total) > 0)) return null
  const registros = Array.isArray(d.registros) ? d.registros : []
  const max = Math.max(1, ...registros.map((o) => Number(o.meses) || 0))
  const atual = d.atual ?? null
  const linhas = registros.map((o) => {
    const ehAtual = !!atual && o.data === atual.data && o.tempo === atual.tempo && o.uf === atual.uf
    const curta = !ehAtual && o.meses != null && o.meses < 12
    return {
      data: dataBR(o.data) || '',
      tipo: o.tipo ? ROTULO_TIPO_DONO[o.tipo] : 'Tipo não informado',
      uf: o.uf,
      posse: ehAtual ? (o.tempo ? `Dono atual, há ${noMeioDaFrase(o.tempo)}` : 'Dono atual') : o.tempo ? `Ficou ${noMeioDaFrase(o.tempo)}` : 'Tempo não informado',
      curta,
      largura: Math.max(4, Math.round((100 * (Number(o.meses) || 0)) / max)),
      atual: ehAtual,
    }
  })
  const n = Number(d.trocasRapidas) || 0
  return {
    total: Number(d.total),
    totalTexto: d.total === 1 ? 'dono encontrado' : 'donos encontrados',
    atual: atual ? { desde: dataBR(atual.data), tempo: atual.tempo } : null,
    estados: Array.isArray(d.ufs) ? d.ufs : [],
    zeroKm: d.ufZeroKm || null,
    linhas,
    alertaTrocaRapida: n >= 3 ? `Troca rápida de dono: ${n} donos ficaram menos de 1 ano com o ${nomeVeiculo}. Vale perguntar o motivo ao vendedor.` : null,
    nota: `${d.semData ? `Há mais ${d.semData === 1 ? '1 registro antigo sem data, que só entra' : `${d.semData} registros antigos sem data, que só entram`} no total. ` : ''}Não mostramos nome nem documento de nenhum proprietário, em conformidade com a LGPD.`,
  }
}

export type Tom = 'neutro' | 'atencao' | 'alerta'
export interface LinhaUso { titulo: string; texto: string; tom: Tom }

/** Previous use (only when there is something). */
export function telaUso(u: UsoHistorico | null | undefined): { linhas: LinhaUso[]; nota: string | null } | null {
  if (!u) return null
  const linhas: LinhaUso[] = []
  const anos = (xs: (string | null)[]) => juntar([...new Set(xs.filter((x): x is string => !!x))].sort())
  if (u.locadora) linhas.push({ titulo: 'Locadora', texto: `Consta como ex-frota de locadora${u.locadora.ano ? ` (${u.locadora.ano})` : ''}`, tom: 'atencao' })
  if (u.frotista) {
    const det = [u.frotista.veiculos ? plural(u.frotista.veiculos, 'veículo', 'veículos') : null, u.frotista.data ? `em ${dataBR(u.frotista.data)}` : null].filter(Boolean).join(', ')
    linhas.push({ titulo: 'Compra em lote', texto: `Comprado numa compra em lote de frotista${det ? ` (${det})` : ''}`, tom: 'atencao' })
  }
  const lojas = (u.empresas || []).filter((e) => e.loja)
  const outras = (u.empresas || []).filter((e) => !e.loja)
  if (lojas.length) {
    const a = anos(lojas.map((e) => e.ano))
    linhas.push({ titulo: 'Loja de usados', texto: `Passou por loja de usados${a ? ` em ${a}` : ''}`, tom: 'neutro' })
  }
  if (outras.length) {
    const a = anos(outras.map((e) => e.ano))
    linhas.push({ titulo: 'Empresa', texto: `Já pertenceu a uma empresa${a ? ` (${a})` : ''}`, tom: 'neutro' })
  }
  if (u.taxiPcd) linhas.push({ titulo: 'Táxi ou PCD', texto: 'Há indício de uso como táxi ou de compra com isenção para pessoa com deficiência', tom: 'atencao' })
  if (u.viatura) linhas.push({ titulo: 'Viatura', texto: 'Consta uso como viatura policial ou de guarda', tom: 'atencao' })
  if (u.frotaPublica) linhas.push({ titulo: 'Frota pública', texto: 'Consta como ex-frota de órgão público', tom: 'atencao' })
  if (u.religiosa) linhas.push({ titulo: 'Entidade religiosa', texto: 'Já pertenceu a uma entidade religiosa', tom: 'neutro' })
  if (u.segurancaPrivada) linhas.push({ titulo: 'Segurança privada', texto: 'Já pertenceu a uma empresa de segurança privada', tom: 'atencao' })
  if (u.lojaSalvados) linhas.push({ titulo: 'Loja de salvados', texto: 'Foi vendido em loja de salvados, que revende veículos recuperados de sinistro', tom: 'alerta' })
  for (const f of u.financeiras || []) {
    const quem = nomeEmpresa(f.instituicao)
    linhas.push({ titulo: 'Banco ou financeira', texto: `Esteve em nome ${quem ? `de ${quem}` : 'de banco ou financeira'}${f.ano ? ` em ${f.ano}` : ''}`, tom: 'neutro' })
  }
  for (const s of u.seguradoras || []) {
    const quem = nomeEmpresa(s.seguradora)
    // Insurer year may be when the record entered the partner base: "registrada em".
    linhas.push({ titulo: 'Seguradora', texto: `Esteve em nome ${quem ? `da ${quem}` : 'de uma seguradora'}${s.ano ? `, registrada em ${s.ano}` : ''}`, tom: 'atencao' })
  }
  if (!linhas.length) return null
  const limpos = ([['locadora', 'locadora'], ['taxiPcd', 'táxi'], ['viatura', 'viatura'], ['frotaPublica', 'frota pública']] as const)
    .filter(([k]) => !u[k]).map(([, r]) => r)
  return { linhas, nota: limpos.length ? `Sem registro de ${juntar(limpos).replace(/ e ([^,]*)$/, ' ou $1')}.` : null }
}

export interface LinhaSinistro { titulo: string; valor: string; detalhe: string | null; tom: Tom }
export interface TelaSinistro { linhas: LinhaSinistro[]; parecer: { tom: 'alerta' | 'atencao'; titulo: string; texto: string } | null }

const ROTULO_MONTA: Record<NivelMonta, string> = { pequena: 'Pequena monta', media: 'Média monta', grande: 'Grande monta' }

/** Insurance and damage (only when there is something). */
export function telaSinistro(s: SinistroHistorico | null | undefined, nomeVeiculo = 'veículo'): TelaSinistro | null {
  if (!s) return null
  const linhas: LinhaSinistro[] = []
  for (const i of s.indenizacoes || []) {
    const quem = nomeEmpresa(i.seguradora)
    const det = [quem, i.ano ? `registrada em ${i.ano}` : null].filter(Boolean).join(', ')
    linhas.push({ titulo: 'Indenização integral', valor: 'Sim', detalhe: `${det ? `${det}. ` : ''}A seguradora pagou o valor do ${nomeVeiculo} ao dono.`, tom: 'alerta' })
  }
  if (s.monta) {
    linhas.push({
      titulo: 'Dano registrado',
      valor: s.monta.nivel ? ROTULO_MONTA[s.monta.nivel] : 'Monta não informada',
      detalhe: s.monta.ano ? `apontamento de ${s.monta.ano}` : null,
      tom: s.monta.nivel === 'media' || s.monta.nivel === 'grande' ? 'alerta' : 'atencao',
    })
  }
  for (const a of s.acidentes || []) {
    const quando = dataBR(a.data)
    linhas.push({ titulo: 'Acidente de trânsito', valor: a.tipo || 'Registro', detalhe: [quando, a.local ? `em ${a.local}` : null].filter(Boolean).join(', ') || null, tom: 'atencao' })
  }
  if (s.recuperado) linhas.push({ titulo: 'Recuperado de sinistro', valor: 'Sim', detalhe: 'voltou a circular depois de um sinistro', tom: 'atencao' })
  if (s.roubo?.length) {
    const nome = { registro: 'registro', recuperacao: 'recuperação', devolucao: 'devolução' } as const
    const partes = s.roubo.map((r) => `${nome[r.evento]}${r.ano ? ` em ${r.ano}` : ''}`)
    const det = partes.join(', ')
    const voltou = s.roubo.some((r) => r.evento !== 'registro')
    linhas.push({ titulo: 'Roubo ou furto', valor: voltou ? 'Com recuperação' : 'Consta registro', detalhe: det ? det.charAt(0).toUpperCase() + det.slice(1) : null, tom: voltou ? 'atencao' : 'alerta' })
  }
  if (s.restricaoSeguro) linhas.push({ titulo: 'Restrição para seguro', valor: 'Consta', detalhe: 'restrição registrada para emissão de apólice', tom: 'alerta' })
  if (s.chassiSuspeito) linhas.push({ titulo: 'Chassi', valor: 'Suspeita de adulteração', detalhe: null, tom: 'alerta' })
  if (s.alteracaoCaracteristicas) linhas.push({ titulo: 'Alteração de características', valor: 'Consta registro', detalhe: null, tom: 'atencao' })
  const danoOuAcidente = !!s.monta || (s.acidentes || []).length > 0 || s.recuperado
  const parecer = s.parecer === 'alto'
    ? { tom: 'alerta' as const, titulo: 'Alto risco de o seguro ser recusado', texto: 'Se uma seguradora aceitar, a cobertura tende a ficar abaixo de 100% da tabela FIPE e a franquia pode ser maior. Consulte uma seguradora antes de fechar negócio.' }
    : s.parecer === 'atencao'
      ? { tom: 'atencao' as const, titulo: 'Pode haver restrição no seguro', texto: `${danoOuAcidente ? 'Há registro de dano ou acidente.' : 'Há registro que pode pesar na aceitação do seguro.'} Algumas seguradoras aceitam com vistoria; confirme antes de comprar.` }
      : null
  // Only with at least one visible line: the two indicators that only feed the
  // opinion never open the block on their own.
  if (!linhas.length) return null
  return { linhas, parecer }
}

/** Indicator card hint when the partner part comes from this source (consulted on every Completa report). */
export const DICA_SINISTRO_HISTORICO = 'Consulta a uma base parceira de leilões e sinistros. Indício de sinistro quer dizer que o veículo aparece em registro de indenização, dano, acidente ou recuperação de sinistro; o detalhe está na seção Sinistro e aceitação em seguro.'
