// O que o card de leilao do relatorio pago MOSTRA de cada passagem.
//
// Decisao do Cesar (01/out): por enquanto NENHUM valor em R$ (venda, lance,
// avaliacao). E filtro de EXIBICAO: vale tambem pra snapshot antigo, que ainda
// traz valor/valor_final gravados.

// O que a fonte expoe sobre o ESTADO DO VEICULO, e so isso. A lista e curada
// de proposito: com dado real, cada passagem vinha tambem com "status:
// encerrado" e "subcategoria: Hatches", que nao dizem nada sobre o carro.
// Chave fora da lista e ignorada; a ordem aqui e a ordem da tela. valor_final
// SAIU (sem R$ no card).
export const ROTULO_DETALHE: Record<string, string> = {
  sucata: 'Sucata',
  monta: 'Monta',
  sinistro: 'Sinistro',
  dano: 'Dano',
  condicao: 'Condição',
  km: 'Quilometragem',
  patio: 'Pátio',
  desfecho: 'Desfecho',
  observacao: 'Observação',
}
const ORDEM_DETALHE = Object.keys(ROTULO_DETALHE)

const TEM_REAIS = /R\$\s*\d|\d\s*reais\b/i

/**
 * Tira do texto os trechos com valor em reais ("Lance inicial: R$ 12.000,00").
 * Corta por frase/separador e descarta o trecho inteiro que tiver R$; se nao
 * sobrar nada, null.
 */
export function semValorEmReais(texto: unknown): string | null {
  const s = String(texto ?? '').trim()
  if (!s) return null
  if (!TEM_REAIS.test(s)) return s
  const resto = s
    .split(/(?<=[;|·\n])\s*|(?<=\.)\s+|\s+-\s+/)
    .map((t) => t.trim())
    .filter((t) => t && !TEM_REAIS.test(t))
    .join(' ')
    .replace(/\s*[;|·,-]\s*$/, '')
    .trim()
  return resto || null
}

export function detalhesLegiveis(bruto: unknown): { rotulo: string; valor: string }[] {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return []
  const dados = bruto as Record<string, unknown>
  const out: { rotulo: string; valor: string }[] = []
  for (const k of ORDEM_DETALHE) {
    const v = dados[k]
    if (v === null || v === undefined || v === '') continue
    const valor = typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : semValorEmReais(v)
    if (valor) out.push({ rotulo: ROTULO_DETALHE[k], valor })
  }
  return out
}

// ---------- Fonte, comitente e leiloeiro (decisao do Cesar, 06/out) ----------
//
// REVERTE a regra antiga de mascarar a casa privada como "Leiloeira
// particular": o card mostra o nome da CASA. O leiloeiro (a pessoa) de casa
// privada continua fora. Continua SEM valor em R$. DETRAN segue "Detran UF".

/** Nome de exibicao das casas privadas, pela chave `fonte` do indice. */
export const NOME_CASA_LEILAO: Record<string, string> = {
  copart: 'Copart', copart_brasil: 'Copart',
  superbid: 'Superbid',
  sodre: 'Sodré Santoro', sodre_santoro: 'Sodré Santoro',
  freitas: 'Freitas Leiloeiro',
  vip: 'VIP Leilões',
  palacio: 'Palácio dos Leilões',
  serpa: 'Serpa Leilões',
  aj: 'AJ Leilões',
  guariglia: 'Guariglia Leilões',
  balbino: 'Balbino Leilões',
  sancar: 'Sancar Leilões',
  lagoa_santa: 'Lagoa Santa Leilões',
  eleiloes: 'E-Leilões', e_leiloes: 'E-Leilões',
  leilo: 'Leilo',
  flex: 'Flex Leilões',
  pestana: 'Pestana Leilões',
  milan: 'Milan Leilões',
  sato: 'Sato Leilões',
  fidalgo: 'Fidalgo Leilões',
  kronberg: 'Kronberg Leilões',
  sold: 'Sold Leilões',
}

const titulo = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

/**
 * Nome publico da fonte de uma passagem. Orgao: "Detran SP" (fonte_exibicao
 * da API ou montado do codigo). Casa privada: nome da casa pelo mapa; casa
 * fora do mapa vira a chave humanizada ("lagoa_santa" -> "Lagoa Santa"),
 * nunca mais o generico "Leiloeira particular".
 */
export function fonteExibicaoLeilao(p: { fonte?: string | null; fonte_tipo?: string | null; fonte_exibicao?: string | null }): string {
  const chave = String(p.fonte || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (p.fonte_tipo === 'detran') {
    if (p.fonte_exibicao) return String(p.fonte_exibicao)
    return chave.split('_').filter(Boolean).map((x) => (x.length === 2 ? x.toUpperCase() : titulo(x))).join(' ')
  }
  if (NOME_CASA_LEILAO[chave]) return NOME_CASA_LEILAO[chave]
  const exib = String(p.fonte_exibicao || '').trim()
  if (exib && !/^leiloeira particular$/i.test(exib)) return exib
  if (!chave) return 'Leiloeira'
  return chave.split('_').filter(Boolean).map(titulo).join(' ')
}

export const COMITENTE_GENERICO = 'Particular ou empresa (a leiloeira não divulga o nome)'
const GENERICO = /^(particular\s*\/\s*empresa|empresa\s*\/\s*particular|particular|empresa|diversos|varios|vários|n[aã]o\s+informado|nao\s+divulgado|-+)$/i
const CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

/**
 * Comitente pra tela. Generico ("PARTICULAR/EMPRESA", Copart) vira a frase
 * explicita; nome em caixa alta e humanizado ("CPFL SERVICOS, ..." ->
 * "Cpfl Servicos, ..."), mantendo siglas sem vogal (CPFL, S/A) e conectivos
 * em minuscula. Nome ja em caixa mista fica como veio.
 */
export function comitenteExibicao(bruto: unknown): { texto: string; generico: boolean } | null {
  const s = String(bruto ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return null
  if (GENERICO.test(s)) return { texto: COMITENTE_GENERICO, generico: true }
  if (s !== s.toUpperCase()) return { texto: s, generico: false }
  const texto = s.split(' ').map((w, i) => {
    const min = w.toLowerCase()
    if (i > 0 && CONECTIVOS.has(min)) return min
    if (!/[AEIOUÁÉÍÓÚÂÊÔÃÕ]/i.test(w)) return w // CPFL, S/A, SP
    return w.split(/([/-])/).map((p) => (/^[/-]$/.test(p) ? p : titulo(p))).join('')
  }).join(' ')
  return { texto, generico: false }
}

/**
 * Frase curta pelo tipo do comitente, inferido do nome. So "costuma ser",
 * nunca afirma o fato. Generico ou desconhecido: null. Ordem importa:
 * "Tribunal de Justica do Estado de SP" e Justica, nao orgao publico.
 */
export function fraseComitente(bruto: unknown): string | null {
  const c = comitenteExibicao(bruto)
  if (!c || c.generico) return null
  const n = c.texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/tribunal|justica|\bvara\b|\bjuizo\b|\btj[a-z]{2}\b|\btr[tf]\b/.test(n)) return 'Justiça: leilão judicial, por dívida ou processo.'
  if (/segurador|\bseguros?\b|mapfre|allianz|suhai|tokio marine|\bhdi\b|liberty|porto seguro/.test(n)) return 'Seguradora: costuma ser carro indenizado por sinistro ou roubo.'
  if (/\bbanco\b|financeir|credito|leasing|\bfidc\b|bradesco|santander|\bitau\b|\bsafra\b|creditas|\bpan\b|caixa economica/.test(n)) return 'Banco ou financeira: costuma ser retomada de financiamento.'
  if (/localiza|movida|unidas|locadora|locacao de veiculos|foco aluguel|rent a car|hertz/.test(n)) return 'Locadora: costuma ser renovação de frota.'
  if (/detran|prefeitura|policia|\bprf\b|municipio|secretaria|departamento|governo|receita federal|\bder\b/.test(n)) return 'Órgão público: costuma ser veículo apreendido ou removido ao pátio.'
  return null
}

// ---------- Pagina publica do lote (edital judicial que nao pode ser entregue) ----------
//
// Decisao do Cesar (07/out): edital judicial que reprovou no portao de LGPD
// (traz dados pessoais das partes) vira LINK pra pagina publica do lote na
// leiloeira. So https e so host de leiloeira conhecida: o link sai do nosso
// relatorio pago, entao nunca pode apontar pra qualquer lugar.
export const HOSTS_PAGINA_LEILOEIRA = ['superbid.net']

export function paginaPublicaLeilao(bruto: unknown, hosts: string[] = HOSTS_PAGINA_LEILOEIRA): string | null {
  if (typeof bruto !== 'string' || !bruto.trim()) return null
  let url: URL
  try { url = new URL(bruto.trim()) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password) return null
  const h = url.hostname.toLowerCase()
  if (!hosts.some((base) => h === base || h.endsWith('.' + base))) return null
  return url.toString()
}

export const AVISO_PAGINA_PUBLICA = 'O edital deste leilão judicial traz dados pessoais das partes, por isso fica disponível só no site da leiloeira.'
