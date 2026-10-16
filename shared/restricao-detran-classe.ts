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
}

/** Classifica a lista inteira, aplicando os vereditos do revisor ja conhecidos. */
export function restricoesDetranParaTela(lista: RestricaoDetran[] | null | undefined, vereditos: VereditosRevisor = {}): RestricoesDetranTela {
  const reais: RestricaoClassificada[] = []
  const informativas: RestricaoClassificada[] = []
  const pendentes: RestricaoClassificada[] = []
  let negas = 0
  for (const r of Array.isArray(lista) ? lista : []) {
    const c = classificarRestricaoDetran(r)
    if (c.classe === 'duvida') {
      const v = vereditos[c.chave]
      if (v?.classe === 'restricao') reais.push({ ...c, classe: 'restricao' })
      else if (v?.classe === 'nega') negas++
      else { informativas.push(c); pendentes.push(c) }
    } else if (c.classe === 'restricao') reais.push(c)
    else negas++
  }
  return { reais, informativas, semRestricao: negas > 0 && !reais.length && !informativas.length, pendentesRevisor: pendentes }
}
