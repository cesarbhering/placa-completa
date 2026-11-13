// Registro de NOTIFICACAO para leilao (edital de notificacao do DETRAN).
//
// O DETRAN publica o aviso ao proprietario de que o veiculo vai a leilao. Isso
// NAO prova que o leilao aconteceu: o dono pode ter retirado o veiculo antes.
// Na base de leiloes essas linhas vem com situacao='notificado' e
// detalhes.tipo_registro='notificacao_leilao', e o matcher da leiloes-api
// ganhou o nivel de gravidade 'notificado' (cinza).
//
// A deteccao mora aqui, e nao so no matcher, por dois motivos: (1) a versao da
// API em producao ainda devolve essas linhas como "Leilao de patio (DETRAN)"
// em amarelo, e (2) o snapshot do relatorio e imutavel, entao um relatorio
// comprado antes do nivel novo guarda a gravidade antiga pra sempre. Olhando a
// situacao/tipo_registro, a tela acerta nos dois casos.

export const TIPO_REGISTRO_NOTIFICACAO = 'notificacao_leilao'

export const GRAVIDADE_NOTIFICADO = {
  nivel: 'notificado',
  cor: 'cinza',
  rotulo: 'Notificado para leilão (DETRAN)',
  motivo: 'O veículo constou em edital de notificação; o proprietário pode ter retirado antes do leilão.',
} as const

export const EXPLICA_NOTIFICACAO =
  'O veículo constou em edital de notificação; o proprietário pode ter retirado antes do leilão.'

/** A passagem e um edital de notificacao, nao um leilao realizado? */
export function ehNotificacao(p: any): boolean {
  if (!p || typeof p !== 'object') return false
  if (String(p.situacao || '').toLowerCase() === 'notificado') return true
  const det = p.detalhes
  if (det && typeof det === 'object' && det.tipo_registro === TIPO_REGISTRO_NOTIFICACAO) return true
  return p.gravidade?.nivel === 'notificado'
}

function dataBR(iso: unknown): string | null {
  const s = String(iso || '').trim()
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function orgaoDe(p: any): string {
  const uf = String(p?.fonte_uf || '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(uf) ? `DETRAN-${uf}` : 'DETRAN'
}

/**
 * "Notificado para leilão pelo DETRAN-RJ (leilão previsto para 09/06/2010)".
 * A data so entra quando e mesmo a do leilao (ver datasNotificacao); sem ela,
 * o titulo termina no orgao.
 */
export function tituloNotificacao(p: any): string {
  const { prevista } = datasNotificacao(p)
  return `Notificado para leilão pelo ${orgaoDe(p)}${prevista ? ` (leilão previsto para ${prevista})` : ''}`
}

/**
 * Publicacao e leilao previsto, separados. No RJ o `data_leilao` do indice e
 * coalesce(data do leilao, data de publicacao): ele so vale como "leilao
 * previsto" quando e diferente da publicacao, senao seria chamar a data do
 * Diario Oficial de data do leilao.
 */
export function datasNotificacao(p: any): { publicacao: string | null; prevista: string | null } {
  const det = p?.detalhes && typeof p.detalhes === 'object' && !Array.isArray(p.detalhes) ? p.detalhes : {}
  const publicacao = dataBR(det.data_publicacao) || lerEditalNotificacao(p?.ref).publicacao
  let prevista = dataBR(det.data_prevista_leilao)
  if (!prevista) {
    const dl = dataBR(p?.data_leilao)
    if (dl && dl !== publicacao) prevista = dl
  }
  return { publicacao, prevista }
}

export interface EditalNotificacao {
  /** Numero legivel ("LD 05/2015"), nunca o nome do arquivo. */
  numero: string | null
  /** Data de publicacao no Diario Oficial, dd/mm/aaaa. */
  publicacao: string | null
  tipo: string | null
  retificacao: boolean
}

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const TIPOS: Array<[RegExp, string]> = [
  [/\bsucata\b|\binservive(l|is)\b/, 'Inservível (sucata)'],
  [/\birrecuperave(l|is)\b/, 'Irrecuperável'],
  [/\brecuperave(l|is)\b/, 'Recuperável'],
  [/\bretirada\b/, 'Retirada'],
  [/\brecolhimento\b/, 'Recolhimento'],
]

/**
 * Le o que da pra ler do identificador do edital de notificacao. No RJ ele e o
 * NOME DO ARQUIVO publicado pelo DETRAN ("NOT:leilão_D.O._28.07.2010",
 * "NOT:edital_de_notificação_leilao_LD05_2015_recuperavel"), que nunca pode ir
 * cru pra tela. Daqui sai so o que tem forma conhecida; o resto vira null, e
 * null nao aparece.
 */
export function lerEditalNotificacao(ref: unknown): EditalNotificacao {
  const saida: EditalNotificacao = { numero: null, publicacao: null, tipo: null, retificacao: false }
  const t = semAcento(String(ref || '')).toLowerCase().replace(/^not:/, '').replace(/[_]+/g, ' ').trim()
  if (!t) return saida
  saida.retificacao = /\bretificacao\b/.test(t)
  for (const [re, rotulo] of TIPOS) {
    if (re.test(t)) { saida.tipo = rotulo; break }
  }
  // "D.O. 28.07.2010" / "D.O. 22-06-2009": data de publicacao no Diario Oficial.
  const dou = t.match(/\bd\.?\s?o\.?\s+(\d{2})[.-](\d{2})[.-](\d{4})/)
  if (dou) saida.publicacao = `${dou[1]}/${dou[2]}/${dou[3]}`
  // Serie + numero + ano: "LD05 2015", "LD 001 2014", "PR03 2016".
  const serie = t.match(/\b(ld|pr)\s?(\d{1,3})\s(\d{4})\b/)
  // "convocacao 04 2013" (numero/ano) x "convocacao 21 01 2014" (data).
  const convData = t.match(/\bconvocacao\s(\d{2})\s(\d{2})\s(\d{4})\b/)
  const convNum = t.match(/\bconvocacao\s(\d{1,3})\s(\d{4})\b/)
  const detran = t.match(/\bdetr[a-z]*\s(\d{1,3})\s(\d{4})\b/)
  if (serie) saida.numero = `${serie[1].toUpperCase()} ${serie[2]}/${serie[3]}`
  else if (convData) saida.publicacao = saida.publicacao || `${convData[1]}/${convData[2]}/${convData[3]}`
  else if (convNum) saida.numero = `${convNum[1]}/${convNum[2]}`
  else if (detran) saida.numero = `${detran[1]}/${detran[2]}`
  return saida
}

function texto(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s ? s : null
}

/**
 * Todos os dados do edital de notificacao que a fonte tem, em linhas prontas
 * pra tela. Ordem: edital, orgao, publicacao, leilao previsto, patio, lote,
 * tipo. NUNCA a URL do documento (decisao do Cesar, 30/set): nenhum campo de
 * link e lido aqui.
 *
 * Campos preferidos (contrato com a leiloes-api, em `detalhes`): edital_numero,
 * data_publicacao, data_prevista_leilao, orgao, patio, lote, tipo_notificacao.
 * Sem eles, cai no que da pra ler do identificador do edital e no data_leilao.
 */
export function camposNotificacao(
  p: any,
  opts: { semPrevista?: boolean } = {},
): Array<{ rotulo: string; valor: string }> {
  const det = p?.detalhes && typeof p.detalhes === 'object' && !Array.isArray(p.detalhes) ? p.detalhes : {}
  const lido = lerEditalNotificacao(p?.ref)
  const { publicacao, prevista: prev } = datasNotificacao(p)
  // O relatorio ja poe a data prevista no titulo; la ela nao se repete.
  const prevista = opts.semPrevista ? null : prev
  const numeroBase = texto(det.edital_numero) || lido.numero
  const numero = numeroBase && lido.retificacao ? `${numeroBase} (retificação)` : numeroBase
  const linhas: Array<[string, string | null]> = [
    ['Edital', numero],
    ['Órgão', texto(det.orgao) || orgaoDe(p)],
    ['Publicação', publicacao],
    ['Leilão previsto para', prevista],
    ['Pátio', texto(det.patio)],
    ['Lote', texto(det.lote) || texto(p?.lote)],
    ['Tipo', texto(det.tipo_notificacao) || lido.tipo],
  ]
  return linhas
    .filter(([, v]) => !!v && !/^https?:|\.pdf$/i.test(String(v)))
    .map(([rotulo, valor]) => ({ rotulo, valor: String(valor) }))
}

/**
 * Contagem por nivel de confianca SEM as notificacoes. A API soma notificacao
 * em n_confirmado (ela casa pelo chassi inteiro, entao e "confirmado" que o
 * registro e deste carro), mas pro relatorio "confirmado" quer dizer leilao,
 * e notificacao nao e leilao.
 */
export function contarPassagens(passagens: any[] | null | undefined) {
  const c = { confirmado: 0, provavel: 0, possivel: 0, notificado: 0 }
  for (const p of Array.isArray(passagens) ? passagens : []) {
    if (ehNotificacao(p)) {
      // Notificacao so conta com identificacao forte. Um "possivel" por final
      // de placa num edital de notificacao nao diz nada sobre este carro.
      if (p.nivel === 'confirmado' || p.nivel === 'provavel') c.notificado += 1
      continue
    }
    if (p?.nivel === 'confirmado') c.confirmado += 1
    else if (p?.nivel === 'provavel') c.provavel += 1
    else if (p?.nivel === 'possivel') c.possivel += 1
  }
  return c
}

// ---------- One card per auction (Cesar, 13/11/2026) ----------
//
// A notice and the auction it announced are the same story: the screen shows
// only the auction card, with one line "Notificado em DD/MM/AAAA (edital N)".
// Two origins, same result: the newer leiloes-api already nests the notice in
// the auction passage (detalhes.notificacao); older snapshots keep the two
// passages apart, and they are joined here. Display filter only: the snapshot
// keeps everything.

export interface NotificacaoNoLeilao {
  orgao?: string
  edital_numero?: string
  /** ISO date (YYYY-MM-DD). */
  data_publicacao?: string
  tipo_notificacao?: string
}

const FORTE = new Set(['confirmado', 'provavel'])
const dia = (v: unknown): string | null => {
  const m = String(v ?? '').trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}
const brParaIso = (br: string | null): string | null => {
  const m = String(br || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}
const chaveFonte = (p: any) => String(p?.fonte || '').trim().toLowerCase()
const semLink = (v: string | null) => (v && !/^https?:|\.pdf$/i.test(v) ? v : null)

/** Notice data in the API contract shape, only the fields that exist. */
function dadosNotificacao(n: any): NotificacaoNoLeilao {
  const det = n?.detalhes && typeof n.detalhes === 'object' && !Array.isArray(n.detalhes) ? n.detalhes : {}
  const lido = lerEditalNotificacao(n?.ref)
  const saida: NotificacaoNoLeilao = {}
  const orgao = semLink(texto(det.orgao))
  const edital = semLink(texto(det.edital_numero) || lido.numero)
  const pub = dia(det.data_publicacao) || brParaIso(lido.publicacao)
  const tipo = semLink(texto(det.tipo_notificacao) || lido.tipo)
  if (orgao) saida.orgao = orgao
  if (edital) saida.edital_numero = edital
  if (pub) saida.data_publicacao = pub
  if (tipo) saida.tipo_notificacao = tipo
  return saida
}

function notificacaoDe(p: any): NotificacaoNoLeilao | null {
  const n = p?.detalhes?.notificacao
  return n && typeof n === 'object' && !Array.isArray(n) ? n : null
}

/**
 * Days after the notice publication within which an auction of the same agency
 * is the same event. Same value as the auctions API (api/notificacao_card.py,
 * JANELA_DIAS = 365); later auctions are another trip to auction.
 */
export const JANELA_NOTIFICACAO_DIAS = 365

const somaDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Nested notice and leftover passage are the same notice? */
function mesmaNotificacao(ja: NotificacaoNoLeilao, dados: NotificacaoNoLeilao): boolean {
  const editalJa = texto(ja.edital_numero)
  const edital = texto(dados.edital_numero)
  const diaJa = dia(ja.data_publicacao)
  // Without a date in the nested object, the edital number decides.
  if (!diaJa) return !!editalJa && !!edital && editalJa === edital
  return diaJa === dados.data_publicacao && (!editalJa || !edital || editalJa === edital)
}

/**
 * Joins each notice into the auction of the SAME agency (same `fonte`) held on
 * or after the notice publication and at most JANELA_NOTIFICACAO_DIAS later.
 * In doubt it does not join: other agency, auction before the notice or out of
 * the window, notice without publication date, a candidate auction of that
 * agency without a date, or two auctions on the closest date. The closest
 * auction wins; each auction takes one notice, the one published closest to
 * it, and the others keep their own card.
 */
export function juntarNotificacoes<T = any>(lista: T[] | null | undefined): T[] {
  if (!Array.isArray(lista)) return []
  const saida: any[] = [...lista]
  const remover = new Set<number>()
  const escolha = new Map<number, { pub: string; i: number; dados: NotificacaoNoLeilao }>()
  saida.forEach((n: any, i: number) => {
    if (!ehNotificacao(n) || !FORTE.has(n?.nivel)) return
    const dados = dadosNotificacao(n)
    const pub = dados.data_publicacao
    if (!pub) return
    const candidatos = saida
      .map((p: any, j: number) => ({ p, j }))
      .filter(({ p }) => !ehNotificacao(p) && FORTE.has(p?.nivel) && chaveFonte(p) && chaveFonte(p) === chaveFonte(n))
    if (!candidatos.length || candidatos.some(({ p }) => !dia(p.data_leilao))) return
    const limite = somaDias(pub, JANELA_NOTIFICACAO_DIAS)
    const depois = candidatos
      .filter(({ p }) => dia(p.data_leilao)! >= pub && dia(p.data_leilao)! <= limite)
      .sort((a, b) => dia(a.p.data_leilao)!.localeCompare(dia(b.p.data_leilao)!))
    if (!depois.length) return
    if (depois.length > 1 && dia(depois[0].p.data_leilao) === dia(depois[1].p.data_leilao)) return
    const alvo = depois[0]
    const ja = notificacaoDe(alvo.p)
    if (ja) {
      // The API already nested a notice here: drop the leftover passage only
      // when it is the same notice.
      if (mesmaNotificacao(ja, dados)) remover.add(i)
      return
    }
    const atual = escolha.get(alvo.j)
    if (!atual || pub > atual.pub) escolha.set(alvo.j, { pub, i, dados })
  })
  for (const [j, { i, dados }] of escolha) {
    const p = saida[j]
    saida[j] = { ...p, detalhes: { ...(p.detalhes && typeof p.detalhes === 'object' ? p.detalhes : {}), notificacao: dados } }
    remover.add(i)
  }
  return saida.filter((_, i) => !remover.has(i)) as T[]
}

/** "Notificado em 01/04/2026 (edital 12/2026)"; what is missing is left out. */
export function linhaNotificacao(p: any): string | null {
  const n = notificacaoDe(p)
  if (!n) return null
  const data = dataBR(dia(n.data_publicacao))
  const edital = semLink(texto(n.edital_numero))
  if (!data && !edital) return 'Notificado para leilão'
  return `Notificado${data ? ` em ${data}` : ''}${edital ? ` (edital ${edital})` : ''}`
}
