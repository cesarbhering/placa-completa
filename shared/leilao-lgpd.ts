// LGPD no historico de leilao (Cesar, 14/out). Duas coisas nunca podem sair no
// relatorio (que e acessivel por token) nem ficar no snapshot:
//   1. numero de processo judicial (CNJ, com ou sem pontuacao, "Processo nº ...");
//   2. comitente PESSOA FISICA: so fica comitente que e empresa ou orgao.
// A leiloes-api ja corta isso desde o PR #95; este filtro e a nossa garantia,
// roda na entrada (sanearHistorico) e na leitura do snapshot (pedidos antigos).

/** CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO, com ou sem pontuacao (20 digitos). */
const RE_CNJ = /\b\d{7}[-.\s]?\d{2}[-.\s]?\d{4}[-.\s]?\d[-.\s]?\d{2}[-.\s]?\d{4}\b/g
/** "Processo nº 123/2019", "Proc. 0001234-55...", "autos n. 123.456". */
const RE_PROCESSO = /\b(?:processo|proc\.?|autos)\s*(?:judicial\s*)?(?:n[º°o.]*\s*)?[:#-]?\s*\d[\d.\-/\s]{3,}\d/gi
/** CPF solto em texto (formatado). */
const RE_CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g

/** Corta processo/CNJ/CPF de um texto. Sobrou vazio: null. */
export function semProcesso(v: string): string {
  return v
    .replace(RE_PROCESSO, '')
    .replace(RE_CNJ, '')
    .replace(RE_CPF, '')
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/\s*[-–,:;·|]\s*([-–,:;·|]\s*)+/g, ' - ')
    .replace(/^[\s\-–,:;·|]+|[\s\-–,:;·|]+$/g, '')
    .replace(/\s{2,}/g, ' ')
}

/** A referencia e (ou contem) um numero de processo? */
export function refEhProcesso(ref: unknown): boolean {
  const s = String(ref ?? '')
  if (!s.trim()) return false
  RE_CNJ.lastIndex = 0; RE_PROCESSO.lastIndex = 0
  const r = RE_CNJ.test(s) || RE_PROCESSO.test(s) || /processo/i.test(s) || /\d{15,}/.test(s.replace(/[.\-/\s]/g, ''))
  RE_CNJ.lastIndex = 0; RE_PROCESSO.lastIndex = 0
  return r
}

/** Casas de leilao judicial: a ref delas e o processo (leiloes-api #95). */
const CASAS_JUDICIAIS = new Set(['eleiloes', 'e_leiloes', 'benedetto', 'balbino'])

// Empresa ou orgao. Tudo que nao casar aqui e tratado como pessoa fisica.
const RE_PJ = new RegExp([
  '\\bs\\s*/?\\s*\\.?a\\.?$', '\\bs/a\\b', '\\bs\\.a\\.', '\\bltda\\b', '\\bme\\b', '\\bepp\\b', '\\beireli\\b', '\\bmei\\b',
  '\\bcia\\b', 'companhia', '\\bgrupo\\b', 'holding', 'participac', 'empreend', 'administrador', '\\bfidc\\b', '\\bfundo\\b',
  '\\bbanco\\b', '\\bbco\\b', 'financeir', 'credito', 'leasing', 'arrendamento', 'consorcio', 'cooperativ', 'sicoob', 'sicredi',
  'segurador', '\\bseguros?\\b', 'porto seguro', 'mapfre', 'allianz', 'tokio', '\\bhdi\\b', 'liberty', 'suhai', 'sompo', 'zurich', 'youse', 'bradesco', 'santander', '\\bitau\\b', '\\bsafra\\b', 'creditas', '\\bbv\\b', '\\bpan\\b', '\\bbmg\\b', 'caixa economica', 'votorantim', '\\bomni\\b',
  'detran', 'tribunal', '\\bvara\\b', '\\bjuizo\\b', 'justica', 'forum', 'prefeitura', 'municipio', 'ministerio', 'policia', '\\bprf\\b', '\\bpm\\b', 'receita', 'secretaria', 'departamento', 'governo', 'fazenda', '\\buniao\\b', 'estado d', '\\bder\\b', '\\bdnit\\b', 'autarquia', 'fundacao', 'instituto', 'associacao', 'sindicato', 'universidade', 'camara municipal', 'camara dos', 'assembleia', 'exercito', 'marinha', 'aeronautica', 'correios', 'petrobras', 'eletro', 'saneamento',
  'locadora', 'locacao', 'localiza', 'movida', 'unidas', 'rent a car', 'hertz', 'frotas', 'veiculos', 'motors', 'automoveis', '\\bauto\\b', 'comercio', 'comercial', 'industria', 'distribuidor', 'transporte', 'logistica', 'servicos', 'engenharia', 'construtora', 'agropecuaria', '\\bagro', 'mineracao', 'energia', 'telecom', 'tecnologia', 'solucoes', 'importadora', 'exportadora', 'concessionaria', '\\bltda\\.?', 'industrial', 'empresa',
].join('|'), 'i')

const RE_GENERICO = /^(particular\s*\/\s*empresa|empresa\s*\/\s*particular|particular|empresa|diversos|varios|vários|n[aã]o\s+informado|nao\s+divulgado|-+)$/i

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Comitente so se for empresa/orgao (ou o generico "PARTICULAR/EMPRESA"); pessoa fisica vira null. */
export function comitentePublico(bruto: unknown): string | null {
  const s = String(bruto ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return null
  if (RE_GENERICO.test(s)) return s
  const limpo = semProcesso(s)
  if (!limpo) return null
  if (/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/.test(s)) return limpo // tem CNPJ
  return RE_PJ.test(semAcento(limpo)) ? limpo : null
}

// Chaves que nunca saem (dados de processo ou das partes).
const CHAVE_PROIBIDA = /processo|autos|\bpartes?\b|executad|exequente|\breu\b|\bautor\b|requerent|requerid|devedor|credor|cpf|advogad|\boab\b/i

/** Limpa qualquer valor (texto, lista, objeto) de processo/CNJ/CPF e de chaves proibidas. */
function limparFundo(v: unknown, prof = 0): unknown {
  if (prof > 6) return null
  if (typeof v === 'string') { const s = semProcesso(v); return s || null }
  if (Array.isArray(v)) return v.map((x) => limparFundo(x, prof + 1)).filter((x) => x != null && x !== '')
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (CHAVE_PROIBIDA.test(k.replace(/_/g, ' '))) continue
      if (/comitente/i.test(k)) { out[k] = comitentePublico(x); continue }
      out[k] = limparFundo(x, prof + 1)
    }
    return out
  }
  return v
}

/** Uma passagem sem processo judicial e sem comitente PF. Nao muta a entrada. */
export function passagemLgpd<T extends Record<string, any>>(p: T): T {
  if (!p || typeof p !== 'object') return p
  const fonte = String(p.fonte || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  const judicial = CASAS_JUDICIAIS.has(fonte) || p?.detalhes?.judicial === true
  const out: any = limparFundo(p)
  // Campos de controle voltam como vieram (token opaco, url de pagina publica e fotos ja saneados).
  for (const k of ['edital_ref', 'pagina_publica_url', 'fotos', 'data_leilao', 'fonte', 'fonte_tipo', 'nivel', 'score', 'valor', 'edital_disponivel']) {
    if (k in p) out[k] = p[k]
  }
  out.ref = p.ref == null || refEhProcesso(p.ref) || (judicial && /\d{6,}/.test(String(p.ref).replace(/\D/g, ''))) ? null : semProcesso(String(p.ref)) || null
  out.comitente = comitentePublico(p.comitente)
  return out as T
}

/** Historico inteiro (snapshot novo ou antigo). Formato desconhecido volta como veio. */
export function historicoLgpd<T>(h: T): T {
  const x: any = h
  if (!x || typeof x !== 'object' || !Array.isArray(x.passagens)) return h
  return { ...x, aviso: typeof x.aviso === 'string' ? (semProcesso(x.aviso) || null) : x.aviso, passagens: x.passagens.map((p: any) => passagemLgpd(p)) }
}
