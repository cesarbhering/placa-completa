// Classificador das restricoes que o DETRAN estadual devolve (multas.restricoes_detran),
// para todas as UFs (Cesar, 16/out/2026; caso TDI3E93, DETRAN-MG).
//
// O parser grava o que a fonte manda, inclusive frases que AFIRMAM AUSENCIA
// ("Este veículo não possui impedimentos e/ou restrições.", "SEM RESTRICAO").
// Mostradas como restricao, o relatorio dizia "consta restricao" e "nao ha
// restricao" ao mesmo tempo. Aqui cada item vira:
//   - 'nega':      so diz que nao ha nada  -> sai da lista e das travas;
//   - 'restricao': restricao/anotacao real -> fica, so com os trechos reais;
//   - 'duvida':    nao da pra decidir por regra -> revisor final (Haiku, no
//                  servidor); sem veredito, aparece como "informacao do DETRAN"
//                  neutra, NUNCA como restricao.
// O texto e analisado por TRECHO ("RESTRICAO JUDICIAL DE TRANSFERENCIA. SEM
// RESTRICAO" = um trecho real + um que nega): basta um trecho real pra ser
// restricao, e o texto exibido fica so com os trechos reais.

export type ClasseRestricao = 'nega' | 'restricao' | 'duvida'

export interface RestricaoDetran { tipo?: string | null; texto?: string | null }
export interface RestricaoClassificada {
  tipo: string
  /** Texto pra exibir: so os trechos reais (restricao) ou o original. */
  texto: string
  classe: ClasseRestricao
  /** Texto normalizado: chave do cache do revisor. */
  chave: string
}

export function normalizarTexto(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim()
}

// Frase que afirma ausencia. Cobre "nao possui", "nada consta", "sem
// restricao(oes)", "nao ha", "inexistente", "nao consta", "nenhuma", "livre de".
const RE_NEGA = /\b(NAO POSSUI|NAO HA|NAO EXISTE[M]?|NAO CONSTA[M]?|NADA CONSTA|SEM (RESTRICO(ES)?|RESTRICAO|IMPEDIMENTOS?|BLOQUEIOS?|PENDENCIAS?)|NENHUMA (RESTRICAO|PENDENCIA)|NENHUM (IMPEDIMENTO|BLOQUEIO)|INEXISTENTES?|INEXISTE[M]?|LIVRE DE (RESTRICO(ES)?|RESTRICAO|IMPEDIMENTOS?)|NAO TEM (RESTRICO(ES)?|RESTRICAO|IMPEDIMENTOS?))\b/

// Palavra que, sozinha, ja e restricao ou anotacao real.
const RE_REAL = /\b(ALIENACAO|AL\.?FIDUC|FIDUCIARIA|GRAVAME|ARRENDAMENTO|LEASING|RESERVA DE DOMINIO|RESERVA DE AL|PENHOR|PENHORA|RENAJUD|JUDICI\w*|BLOQUEIO\w*|FURTO|ROUBO|ESTELIONATO|BUSCA E APREENS\w*|LEILAO|SINISTR\w*|RECUPERAD\w*|COMUNICACAO DE VENDA|INTENCAO DE (VENDA|GRAVAME)|AUTUADO|DEBITO\w*|BAIXAD\w*|BAIXA DEFINITIVA|APREENDID\w*|REMOVID\w*|CLONAGEM|CLONADO|ADULTERA\w*|REMARCA\w*|RESTRICAO (ADMINISTRATIVA|JUDICIAL|FINANCEIRA|TRIBUTARIA|DE \w+)|REST\.? ADMINISTRATIVA|PENDENCIA\w*)\b/

// Termo que inverte uma negacao: "nao consta BAIXA do gravame" = gravame ativo.
const RE_INVERTE = /\b(BAIXA|QUITACAO|LIBERACAO|DESBLOQUEIO|RETIRADA|LEVANTAMENTO)\b/

/** Trechos: quebra em ". ", ";", "|" e quebra de linha; junta abreviacao curta ("REST." + "ADMINISTRATIVA"). */
export function trechos(texto: string): string[] {
  const brutos = String(texto || '').split(/(?:\.\s+|;|\||\n)+/).map((s) => s.trim()).filter(Boolean)
  const out: string[] = []
  for (const b of brutos) {
    const ult = out[out.length - 1]
    if (ult && /^[A-Za-zÀ-ú]{1,5}$/.test(ult)) out[out.length - 1] = `${ult}. ${b}`
    else out.push(b)
  }
  return out
}

function classeDoTrecho(t: string): 'nega' | 'restricao' | 'neutro' | 'duvida' {
  const n = normalizarTexto(t)
  if (!n) return 'neutro'
  const nega = RE_NEGA.test(n)
  const real = RE_REAL.test(n)
  if (nega && (real || RE_INVERTE.test(n))) return 'duvida' // "nao consta baixa de alienacao", negacao + termo real
  if (nega) return 'nega'
  if (real) return 'restricao'
  // "CONSTA ..." sem palavra real ou so a categoria ("Administrativa"): nao da pra afirmar.
  return /\b(CONSTA|RESTRICAO|RESTRICOES|IMPEDIMENTO|ADMINISTRATIVA|JUDICIARIA|FINANCEIRA|TRIBUTARIA)\b/.test(n) ? 'duvida' : 'neutro'
}

export function classificarRestricaoDetran(r: RestricaoDetran): RestricaoClassificada {
  const tipo = String(r?.tipo || '')
  const original = String(r?.texto || '').trim()
  const chave = normalizarTexto(`${tipo}|${original}`)
  const ts = trechos(original)
  const cls = ts.map((t) => ({ t, c: classeDoTrecho(t) }))
  const reais = cls.filter((x) => x.c === 'restricao')
  if (reais.length) {
    // Fica so o que e restricao (e os trechos neutros de complemento, ex.: "AGENTE: BANCO X"),
    // sem as frases que negam.
    const exib = cls.filter((x) => x.c !== 'nega' && x.c !== 'duvida').map((x) => x.t.replace(/\.$/, '')).join('. ')
    return { tipo, texto: exib || original, classe: 'restricao', chave }
  }
  if (cls.some((x) => x.c === 'duvida')) return { tipo, texto: original, classe: 'duvida', chave }
  if (cls.some((x) => x.c === 'nega')) return { tipo, texto: original, classe: 'nega', chave }
  // Sem texto ou so complemento: a categoria do tipo sozinha nao basta pra afirmar.
  return { tipo, texto: original, classe: 'duvida', chave }
}

// ---------- Baixa de gravame (Cesar, 21/out/2026; caso MES7B45) ----------
// "Registro de Baixa de Alienação Fiduciária informado em 17/03/2026" (SNG do
// DETRAN-SC) saia como "Gravame (SNG)" com "Bloqueia: transferência". E o
// CONTRARIO: a financeira informou a quitacao. Texto com baixa/cancelamento/
// liberacao/quitacao de alienacao ou gravame vira tipo 'baixa' ("Gravame
// baixado"), fora das restricoes e das travas. "Nao consta baixa", "baixa
// pendente/solicitada" e a baixa DEFINITIVA do veiculo nao entram.
const RE_BAIXA = /\b(BAIXA|BAIXADO|BAIXADA|CANCELAMENTO|CANCELADO|CANCELADA|LIBERACAO|LIBERADO|LIBERADA|QUITACAO|QUITADO|QUITADA)\b/
const RE_CONTEXTO_GRAVAME = /\b(ALIENACAO|AL\.? ?FIDUC\w*|FIDUCIARIA|GRAVAME|FINANCIAMENTO|FINANCEIRA|SNG|ARRENDAMENTO|LEASING|RESERVA DE DOMINIO)\b/
const RE_BAIXA_NAO = /\b(PENDENTE|PENDENCIA|AGUARDANDO|AGUARDA|SOLICITAD[OA]|SOLICITACAO|EM ANDAMENTO|NAO EFETIVAD[OA]|NAO PROCESSAD[OA]|BAIXA DEFINITIVA)\b/

export const ROTULO_GRAVAME_BAIXADO = 'Gravame baixado'

/** O item do DETRAN e o registro da BAIXA (quitacao) do gravame, nao uma restricao? */
export function ehBaixaDeGravame(r: RestricaoDetran | null | undefined): boolean {
  const tipo = String(r?.tipo || '').toLowerCase()
  if (tipo === 'baixa') return true
  const n = normalizarTexto(r?.texto)
  if (!n || !RE_BAIXA.test(n) || RE_BAIXA_NAO.test(n) || RE_NEGA.test(n)) return false
  return RE_CONTEXTO_GRAVAME.test(n) || tipo === 'financeira' || tipo === 'sng'
}

/** dd/mm/aaaa do texto da baixa, ou null. */
export function dataDaBaixa(texto: unknown): string | null {
  const m = String(texto ?? '').match(/\b(\d{2}\/\d{2}\/\d{4})\b/)
  return m ? m[1] : null
}

/** Copy neutra da baixa (com a data quando o DETRAN informa). */
export function textoBaixaGravame(data: string | null): string {
  return `A financeira informou a baixa (quitação) do gravame${data ? ` em ${data}` : ''}. Se o cadastro ainda mostrar a alienação, peça ao vendedor o documento de quitação; a atualização costuma levar alguns dias.`
}

/** Divergencia: ainda ha alienacao ativa no mesmo relatorio. */
export function textoDivergenciaBaixa(data: string | null): string {
  return `O cadastro ainda lista alienação fiduciária; a baixa informada${data ? ` em ${data.slice(0, 5)}` : ''} pode não ter sido processada.`
}

/** Frase do parecer ("" sem baixa). */
export function fraseParecerBaixa(data: string | null, divergente: boolean): string {
  const quando = data ? ` em ${data}` : ''
  return divergente
    ? ` A financeira informou a baixa do gravame${quando}, mas o cadastro ainda lista alienação fiduciária: peça o documento de quitação.`
    : ` A financeira informou a baixa do gravame${quando}: peça o documento de quitação.`
}

/** Veredito do revisor (Haiku) por chave normalizada. */
export type VereditosRevisor = Record<string, { classe: 'nega' | 'restricao'; motivo?: string }>

export interface RestricoesDetranTela {
  /** Restricoes reais (pra lista, travas e efeito). */
  reais: RestricaoClassificada[]
  /** Informacao do DETRAN sem veredito: neutra, nunca restricao. */
  informativas: RestricaoClassificada[]
  /** Todas negam (e nao ha nenhuma real): a secao diz "sem impedimentos ou restricoes". */
  semRestricao: boolean
  /** Itens que ainda precisam do revisor (pro servidor). */
  pendentesRevisor: RestricaoClassificada[]
  /** Registros de BAIXA do gravame (quitacao informada): nao sao restricao. */
  baixas: { texto: string; data: string | null }[]
}

/** Classifica a lista inteira, aplicando os vereditos do revisor ja conhecidos. */
export function restricoesDetranParaTela(lista: RestricaoDetran[] | null | undefined, vereditos: VereditosRevisor = {}): RestricoesDetranTela {
  const reais: RestricaoClassificada[] = []
  const informativas: RestricaoClassificada[] = []
  const pendentes: RestricaoClassificada[] = []
  const baixas: { texto: string; data: string | null }[] = []
  let negas = 0
  for (const r of Array.isArray(lista) ? lista : []) {
    // Baixa do gravame antes de tudo: o texto tem "alienação" e cairia em restricao.
    if (ehBaixaDeGravame(r)) { baixas.push({ texto: String(r?.texto || '').trim(), data: dataDaBaixa(r?.texto) }); continue }
    const c = classificarRestricaoDetran(r)
    if (c.classe === 'duvida') {
      const v = vereditos[c.chave]
      if (v?.classe === 'restricao') reais.push({ ...c, classe: 'restricao' })
      else if (v?.classe === 'nega') negas++
      else { informativas.push(c); pendentes.push(c) }
    } else if (c.classe === 'restricao') reais.push(c)
    else negas++
  }
  return { reais, informativas, semRestricao: (negas > 0 || baixas.length > 0) && !reais.length && !informativas.length, pendentesRevisor: pendentes, baixas }
}
