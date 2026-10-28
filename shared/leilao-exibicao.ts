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

// Passagem achada pelo canhao de PDFs chega com fonte "canhao:<dominio>" e
// fonte_tipo "privado" (Cesar, 27/out, HIY1244: aparecia "Canhao:leilao.detran
// .mg.gov.br"). Edital de DETRAN vira a passagem do orgao ("Detran MG"); outro
// dominio mostra so o dominio. O nome "canhao" nunca vai pra tela.
const RE_CANHAO = /^canhao:(.+)$/i
const RE_DETRAN_GOV = /(?:^|\.)detran\.([a-z]{2})\.gov\.br$/

export function passagemSemCanhao<T extends { fonte?: string | null; fonte_tipo?: string | null; fonte_exibicao?: string | null }>(p: T): T & { via_canhao?: boolean } {
  const m = RE_CANHAO.exec(String(p?.fonte || '').trim())
  if (!m) return p
  const dominio = m[1].trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
  const uf = RE_DETRAN_GOV.exec(dominio)?.[1]
  if (uf) return { ...p, fonte: `detran_${uf}`, fonte_tipo: 'detran', fonte_exibicao: `Detran ${uf.toUpperCase()}`, via_canhao: true }
  return { ...p, fonte_exibicao: dominio, via_canhao: true }
}

/**
 * Normaliza as passagens do canhao e tira a que repete um lote que a coleta
 * do proprio orgao ja trouxe (mesma fonte e mesmo lote): e o mesmo leilao
 * achado pelo PDF. Filtro de exibicao; o snapshot continua com tudo.
 */
export function passagensSemCanhao(lista: unknown): any[] {
  if (!Array.isArray(lista)) return []
  const norm = lista.map((p: any) => passagemSemCanhao(p))
  const diretas = new Set(norm.filter((p: any) => !p.via_canhao && p.lote).map((p: any) => `${p.fonte}|${String(p.lote).replace(/^0+/, '')}`))
  return norm.filter((p: any) => !(p.via_canhao && p.fonte_tipo === 'detran' && p.lote && diretas.has(`${p.fonte}|${String(p.lote).replace(/^0+/, '')}`)))
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

/**
 * A fonte classificou o estado do veiculo? (Cesar, 21/out/2026: a linha
 * "Gravidade" da ficha so aparece com monta ou condicao de fato; "Sinistro
 * (monta não informada)" e "Condição não informada" ficam fora, o sinistro sem
 * monta ja aparece no indicador e no parecer.)
 */
export function gravidadeInformada(g: { nivel?: string | null; rotulo?: string | null } | null | undefined): boolean {
  if (!g || !g.rotulo) return false
  if (String(g.nivel || '').toLowerCase() === 'desconhecido') return false
  return !/n[aã]o informad/i.test(String(g.rotulo))
}

/** Rotulo cabe numa pilula (ate ~14 caracteres)? Acima disso vira texto colorido (Cesar, 21/out/2026). */
export function cabeEmPilula(texto: unknown, max = 14): boolean {
  return String(texto ?? '').trim().length <= max
}

// ---------- Trava de modelo divergente (28/out/2026, caso PCU1D83) ----------
//
// Relatorio de uma SPIN mostrou passagem "possivel" da Superbid cujo modelo na
// fonte era "ONIX 1.4 AT LTZ", com fotos de um Onix. A leiloes-api vai corrigir
// o matching; aqui e a trava de EXIBICAO: passagem possivel/provavel com
// familia de modelo diferente da do veiculo nao vai pra tela. Confirmado
// (placa ou chassi iguais) nunca sai. Em duvida, MANTEM.

const MARCAS_MODELO = new Set([
  'I', 'IMP', 'CHEV', 'CHEVROLET', 'GM', 'VW', 'VOLKSWAGEN', 'FIAT', 'FORD', 'HYUNDAI', 'TOYOTA', 'HONDA',
  'RENAULT', 'NISSAN', 'JEEP', 'PEUGEOT', 'CITROEN', 'MMC', 'MITSUBISHI', 'MBENZ', 'MERCEDES', 'BENZ',
  'MERCEDESBENZ', 'KIA', 'BMW', 'AUDI', 'VOLVO', 'SUZUKI', 'YAMAHA', 'CAOA', 'CHERY', 'JAC', 'LIFAN',
  'BYD', 'GWM', 'RAM', 'DODGE', 'CHRYSLER', 'LAND', 'ROVER', 'LANDROVER', 'PORSCHE', 'SUBARU', 'TROLLER',
  'IVECO', 'SCANIA', 'DAFRA', 'SHINERAY', 'KAWASAKI', 'HARLEY', 'DAVIDSON', 'TRIUMPH', 'DUCATI', 'MINI',
  'SMART', 'JAGUAR', 'LEXUS', 'EFFA', 'HAFEI', 'AGRALE', 'MARCOPOLO', 'VWCAMINHOES',
])
// Palavras que vem antes do nome e nao dizem a familia ("NOVO UNO", "NEW FIESTA").
const PREFIXOS_MODELO = new Set(['NOVO', 'NOVA', 'NEW', 'NUEVO'])
// Motor/versao: 1.8L, 1.4, 2.0T, 16V, 8V.
const RE_MOTOR = /^\d+[.,]\d+[A-Z]*$|^\d+V$/

function tokensModelo(modelo: unknown, marca?: unknown): string[] {
  const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  const extra = new Set(norm(marca).split(/[\s/.-]+/).map((t) => t.replace(/[^A-Z0-9]/g, '')).filter(Boolean))
  // "CHEV/SPIN 1.8L", "I/HYUNDAI HB20S": o que vem antes da ultima barra e marca.
  const s = norm(modelo)
  const corpo = s.includes('/') ? s.slice(s.lastIndexOf('/') + 1) : s
  return corpo
    .split(/\s+/)
    .filter((t) => !RE_MOTOR.test(t))
    .map((t) => t.replace(/[^A-Z0-9]/g, ''))
    .filter((t) => t && !MARCAS_MODELO.has(t) && !extra.has(t))
}

/** Familia do modelo: primeira palavra significativa ("SPIN 1.8 LTZ" -> "SPIN"). null se nao der pra dizer. */
export function familiaModelo(modelo: unknown, marca?: unknown): string | null {
  const t = tokensModelo(modelo, marca).filter((x) => !PREFIXOS_MODELO.has(x))
  return t[0] || null
}

/**
 * A passagem pode ser deste veiculo, pelo modelo? false so quando o nivel e
 * possivel/provavel, os dois modelos existem e as familias divergem (nem
 * iguais, nem uma prefixo da outra como HB20S/HB20, nem a familia de um
 * aparecendo no nome do outro como GRAND SIENA/SIENA).
 */
export function passagemCompativelComVeiculo(
  passagem: { nivel?: string | null; veiculo_na_fonte?: Record<string, any> | null } | null | undefined,
  veiculo: { modelo?: string | null; marca?: string | null } | null | undefined,
): boolean {
  if (!passagem) return true
  if (passagem.nivel !== 'possivel' && passagem.nivel !== 'provavel') return true
  const vf = passagem.veiculo_na_fonte
  const famFonte = familiaModelo(vf?.modelo, vf?.marca)
  const famVeic = familiaModelo(veiculo?.modelo, veiculo?.marca)
  if (!famFonte || !famVeic) return true
  if (famFonte.startsWith(famVeic) || famVeic.startsWith(famFonte)) return true
  if (tokensModelo(vf?.modelo, vf?.marca).includes(famVeic)) return true
  if (tokensModelo(veiculo?.modelo, veiculo?.marca).includes(famFonte)) return true
  return false
}

const NIVEIS_ORDEM = ['confirmado', 'provavel', 'possivel'] as const

/**
 * Aplica a trava de modelo no historico inteiro. Se alguma passagem saiu,
 * refaz o resumo a partir do que sobrou (sem passagem, sem "indicio") e
 * descarta linha_do_tempo/recorrencia da API, que poderiam citar o lote
 * removido (a pagina volta a montar a linha por passagem).
 */
export function historicoCompativelComVeiculo<H extends { passagens?: any[]; resumo?: any; linha_do_tempo?: any; recorrencia?: any }>(
  h: H | null | undefined,
  veiculo: { modelo?: string | null; marca?: string | null } | null | undefined,
): H | null | undefined {
  if (!h || !Array.isArray(h.passagens)) return h
  const passagens = h.passagens.filter((p) => passagemCompativelComVeiculo(p, veiculo))
  if (passagens.length === h.passagens.length) return h
  const conta = (n: string) => passagens.filter((p) => p?.nivel === n).length
  const r = h.resumo || {}
  const resumo = r && typeof r === 'object'
    ? {
        ...r,
        n_confirmado: conta('confirmado'),
        n_provavel: conta('provavel'),
        n_possivel: conta('possivel'),
        nivel_max: NIVEIS_ORDEM.find((n) => conta(n) > 0) ?? null,
        tem_indicio: passagens.length > 0 && !!r.tem_indicio,
        possiveis_ambiguos: passagens.length > 0 ? r.possiveis_ambiguos || 0 : 0,
        fontes_com_passagem: [...new Set(passagens.map((p) => String(p?.fonte || '')).filter(Boolean))],
      }
    : r
  return { ...h, passagens, resumo, linha_do_tempo: null, recorrencia: null }
}
