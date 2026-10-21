import { FONTE_PARCEIRA, ROTULO_PARCEIRA } from './fonte-parceira'
// O que o card de leilao do relatorio pago MOSTRA de cada passagem.
//
// Decisao do Cesar (01/out): por enquanto NENHUM valor em R$ (venda, lance,
// avaliacao). E filtro de EXIBICAO: vale tambem pra snapshot antigo, que ainda
// traz valor/valor_final gravados.

// O que a fonte expoe sobre o ESTADO DO VEICULO. Ordem aqui = ordem da tela.
// 18/out/2026 (Cesar, caso GDL8A24): o card mostra tambem chave, categoria,
// combustivel e judicial, e o km no leilao comparado com o km atual. Chave
// fora da lista e ignorada (status, tipo, valor_*). Campo vazio nao aparece.
export const ROTULO_DETALHE: Record<string, string> = {
  condicao: 'Condição',
  monta: 'Monta',
  sinistro: 'Sinistro',
  dano: 'Dano',
  km: 'Km no leilão',
  possui_chave: 'Chave',
  funcionando: 'Funcionando',
  subcategoria: 'Categoria',
  categoria: 'Categoria',
  combustivel: 'Combustível',
  sucata: 'Sucata',
  judicial: 'Leilão judicial',
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

// Palavras que as fontes mandam sem acento (evidencias e condicao).
const ACENTOS: Record<string, string> = {
  compativel: 'compatível', incompativel: 'incompatível', fabricacao: 'fabricação', versao: 'versão',
  cambio: 'câmbio', motorizacao: 'motorização', combustivel: 'combustível', numero: 'número',
  media: 'média', mecanica: 'mecânica', eletrica: 'elétrica', alcool: 'álcool', hidraulica: 'hidráulica',
  veiculo: 'veículo', veiculos: 'veículos', mecanico: 'mecânico', patio: 'pátio', informacao: 'informação',
  identificacao: 'identificação', avaria: 'avaria', avarias: 'avarias', recuperavel: 'recuperável', irrecuperavel: 'irrecuperável',
}
/** Poe acento nas palavras conhecidas, preservando o resto do texto. */
export function comAcentos(texto: string): string {
  return String(texto ?? '').replace(/[A-Za-zÀ-ú]+/g, (w) => {
    const a = ACENTOS[w.toLowerCase()]
    if (!a) return w
    if (w === w.toUpperCase()) return a.toUpperCase()
    if (w[0] === w[0].toUpperCase()) return a[0].toUpperCase() + a.slice(1)
    return a
  })
}

/** "SINISTRADO MEDIA MONTA" -> "Sinistrado média monta"; texto ja em caixa mista fica como veio. */
export function humanizarValorFonte(v: string): string {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return s
  const base = s === s.toUpperCase() && /[A-Z]/.test(s) ? s.toLowerCase() : s
  const c = comAcentos(base)
  return c[0].toUpperCase() + c.slice(1)
}

const km = (n: number) => `${Math.round(n).toLocaleString('pt-BR')} km`

/**
 * Detalhes do veiculo na passagem, rotulo e valor. `kmAtual` (hodometro mais
 * recente do relatorio, com data) acrescenta a comparacao com o km do leilao,
 * so quando a leitura e posterior ao leilao. `semDesfecho` tira o desfecho
 * cru quando o card ja mostra o desfecho saneado.
 */
export function detalhesLegiveis(bruto: unknown, op: { kmAtual?: { km: number; data: string | null } | null; dataLeilao?: string | null; semDesfecho?: boolean } = {}): { rotulo: string; valor: string }[] {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return []
  const dados = bruto as Record<string, unknown>
  const out: { rotulo: string; valor: string }[] = []
  const vistos = new Set<string>()
  for (const k of ORDEM_DETALHE) {
    if (op.semDesfecho && k === 'desfecho') continue
    const v = dados[k]
    if (v === null || v === undefined || v === '') continue
    const rotulo = ROTULO_DETALHE[k]
    if (vistos.has(rotulo)) continue // categoria x subcategoria: so a primeira
    let valor: string | null
    if (typeof v === 'boolean') valor = v ? 'Sim' : 'Não'
    else if (k === 'km') {
      const n = Number(String(v).replace(/\D/g, ''))
      if (!Number.isFinite(n) || n <= 0) continue
      valor = km(n)
      const atual = op.kmAtual
      const dl = String(op.dataLeilao || '').slice(0, 10)
      const da = String(atual?.data || '').slice(0, 10)
      if (atual && Number.isFinite(atual.km) && atual.km > 0 && dl && da && da > dl) {
        const dif = atual.km - n
        const quando = `${da.slice(8, 10)}/${da.slice(5, 7)}/${da.slice(0, 4)}`
        valor += dif >= 0
          ? `; hoje ${km(atual.km)} (leitura de ${quando}), ${km(dif)} rodados desde o leilão`
          : `; leitura de ${quando} com ${km(atual.km)}, MENOR que a do leilão: confira o painel`
      }
    } else {
      const t = semValorEmReais(v)
      valor = t ? humanizarValorFonte(t) : null
    }
    if (valor) { out.push({ rotulo, valor }); vistos.add(rotulo) }
  }
  return out
}

// ---------- Gravidade do sinistro (18/out/2026) ----------
//
// O nivel vem da leiloes-api (o que a LEILOEIRA declarou), nao da
// classificacao do DETRAN: a copy diz "declarada" e o que a regra do Contran
// (Res. 810/2020) preve, sem afirmar que ja consta no documento deste carro.
// Nivel sem explicacao (desconhecido, notificado): so o chip.
export const EXPLICA_GRAVIDADE: Record<string, string> = {
  pequena_monta: 'Pequena monta declarada pela leiloeira: dano leve, com no máximo uma peça estrutural ou de segurança afetada. Pela regra do Contran, só média e grande monta bloqueiam o cadastro. Confira o reparo na vistoria.',
  media_monta: 'Média monta declarada pela leiloeira: dano em 2 a 6 peças estruturais ou de segurança, recuperável. Pela regra do Contran, quando o DETRAN registra a média monta, o carro só volta a circular depois do reparo, com Certificado de Segurança Veicular (CSV) e vistoria, e o documento passa a trazer "Sinistrado" ou "DMM" de forma permanente. Peça ao vendedor o CSV e as notas do reparo, e confira o documento.',
  sucata: 'Sucata ou irrecuperável declarada pela leiloeira. Pela regra do Contran, a grande monta (mais de 6 peças estruturais ou de segurança danificadas) torna o veículo irrecuperável, sem volta à circulação. Se este carro está rodando, confira o documento com muita atenção.',
  sinistro: 'Sinistro sem a monta informada pela leiloeira: o dano pode ir de leve a grave. Peça uma vistoria cautelar e confira se o documento traz "Sinistrado" ou "DMM".',
  patio: 'Leilão de pátio: veículo removido ou apreendido e não retirado pelo dono. Isso, por si só, não indica dano.',
  financiamento: 'Retomada de financiamento: o banco recuperou o veículo por falta de pagamento. Isso, por si só, não indica dano.',
  conservado: 'A leiloeira declarou o veículo em condição de circular.',
}

export function explicaGravidade(nivel: unknown): string | null {
  return EXPLICA_GRAVIDADE[String(nivel || '')] || null
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
  // Base parceira: rotulo unico, nunca o nome do fornecedor (shared/fonte-parceira.ts).
  if (chave === FONTE_PARCEIRA || p.fonte_tipo === FONTE_PARCEIRA) return ROTULO_PARCEIRA
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

/**
 * Tipo curto do comitente e a leitura em poucas palavras, para o chip do card
 * de passagem (ficha em linhas, Cesar 21/out/2026). Sai da mesma regra de
 * fraseComitente. null quando nao da pra dizer.
 */
export function tipoComitente(bruto: unknown): { tipo: string; leitura: string } | null {
  const f = fraseComitente(bruto)
  if (!f) return null
  const [antes, depois = ''] = f.split(': ')
  const tipo = antes === 'Banco ou financeira' ? 'Banco' : antes === 'Órgão público' ? 'Órgão' : antes
  const leitura = depois.replace(/\.$/, '').replace(/^costuma ser (carro )?/, '').replace(/^leilão judicial, /, '')
  return { tipo, leitura }
}

/** Nota curta do nivel na linha "Nivel" do card. */
export const NOTA_NIVEL: Record<string, string> = {
  confirmado: 'placa ou chassi iguais',
  provavel: 'identificador parcial',
  possivel: 'pode ser outro veículo',
}
