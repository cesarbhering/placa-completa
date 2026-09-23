// ---------------------------------------------------------------------------
// Multas e debitos no orgao de transito estadual (SP primeiro, 22/set/2026).
//
// A consulta paga do SENATRAN diz apenas que EXISTE multa (indicadorMultaRenainf).
// Quem pagou quer o VALOR e o detalhe: multas, IPVA, licenciamento (valor e
// vencimento) e o historico de hodometro (pra flagrar km rodado pra tras). As
// restricoes (bloqueio de furto/roubo, tributaria, judicial/Renajud etc.) NAO
// entram aqui: o SENATRAN ja as cobre. Esse detalhe mora no portal do orgao
// estadual, atras de um login gov.br. Quem navega la e um runner deterministico
// (browser-harness) num navegador na nuvem com IP BR e sessao no profile gov-br;
// como o container Nuxt nao roda o harness, a consulta passa por um WORKER HTTP
// no host da VPS (ver buscarMultasDetalhe / NUXT_DETRAN_WORKER_URL).
//
// Mesmos freios do recall, porque cada consulta custa dinheiro:
//   cache de 7 dias por placa, no maximo 2 tentativas por placa na janela, e um
//   teto de gasto por dia SOMADO ao recall (US$ 5).
// Tudo fail-open: sem chave, sem sessao, fora do ar ou pagina estranha, o
// relatorio sai como sempre saiu, sem o bloco. Nenhum caminho aqui pode derrubar
// uma entrega ja paga.
//
// A fonte nunca aparece pro cliente como "de onde tiramos": no relatorio e
// "multas registradas no orgao de transito do estado".
// ---------------------------------------------------------------------------

/** 7 dias: multa/licenciamento mudam pouco de semana em semana, mas mudam. */
const CACHE_DIAS = 7
const MAX_TENTATIVAS_POR_PLACA = 2
/** Teto do dia somado ao recall: as duas fontes puxam do mesmo orcamento. */
const TETO_DIARIO_USD = 5
// Cada consulta ao worker roda um navegador na nuvem (~US$0,02-0,05, dominado
// pelo proxy residencial). Registramos um custo NOMINAL pra o teto do dia ter
// dente (a ausencia de custo deixava a busca correr sem limite de gasto).
const CUSTO_NOMINAL_USD = 0.05
// buscarMultasDetalhe so roda em segundo plano (completarMultasDepois,
// fire-and-forget DEPOIS da entrega) e no backfill admin — NUNCA no caminho
// sincrono do checkout. Entao o timeout pode ser generoso: warm ~66-85s, mas um
// cold-start (daemon + relogin) pode passar de 150s. 240s cobre o pior caso do
// worker (start do daemon + RUN_TIMEOUT_S=220 do runner) com folga, pra o
// resultado gravar no cache e a pagina pegar no polling em vez de se perder.
const TIMEOUT_MULTAS_MS = 240 * 1000

export type StatusMulta = 'ok' | 'sem_debito' | 'sessao_expirada' | 'captcha' | 'erro'

export interface HodometroLeitura {
  data: string // ISO (YYYY-MM-DD)
  km: number
}

export interface MultasDetalhe {
  status: StatusMulta
  uf: string | null
  multas_total_centavos: number | null
  ipva_total_centavos: number | null
  licenciamento_centavos: number | null
  licenciamento_venc: string | null // ISO (YYYY-MM-DD)
  hodometro: HodometroLeitura[]
  hodometro_suspeito: boolean
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v)
}

/**
 * O indicador de multa e a UF vem soltos no topo da resposta paga do SENATRAN,
 * ao lado dos outros indicadores. A resposta as vezes chega achatada num array
 * de um elemento (mesmo caso ja tratado no snapshot). Por seguranca tambem
 * aceitamos o indicador no caminho aninhado `restricoes`.
 *
 * So dispara pra SP: e o unico orgao estadual que a busca ja sabe navegar.
 */
export function temMultaSP(response: any): boolean {
  const bruto = Array.isArray(response) ? response[0] : response
  if (!bruto || typeof bruto !== 'object') return false
  const temMulta =
    bruto.indicadorMultaRenainf === true || bruto?.restricoes?.indicadorMultaRenainf === true
  const uf = texto(bruto.ufJurisdicao).toUpperCase()
  return temMulta && uf === 'SP'
}

/** UF de jurisdicao do veiculo, se houver. */
export function ufDaResposta(response: any): string | null {
  const bruto = Array.isArray(response) ? response[0] : response
  const uf = texto(bruto?.ufJurisdicao).toUpperCase()
  return uf || null
}

/** Renavam vindo da resposta paga (o DETRAN pede placa + renavam). */
export function renavamDaResposta(response: any): string | null {
  const bruto = Array.isArray(response) ? response[0] : response
  const r = texto(bruto?.renavam).replace(/[^0-9]/g, '')
  return r || null
}

/**
 * "R$ 141,61" -> 14161. Texto que indica ausencia de debito ("Nao ha debito",
 * "Nada consta", "Isento", vazio) -> 0. Sem numero reconhecivel -> null, pra
 * quem chama diferenciar "sem debito" de "nao consegui ler".
 */
export function parseMoedaBR(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v)
  const s = texto(v)
  if (!s) return 0
  if (/n[aã]o\s*h[aá]|nada\s*consta|isent|sem\s*d[eé]bito|quitad|em\s*dia/i.test(s)) return 0
  const m = s.match(/-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|-?\d+(?:,\d{2})?/)
  if (!m) return null
  const limpo = m[0].replace(/\./g, '').replace(',', '.')
  const n = Number(limpo)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

/** Aceita "29/06/2017" ou "2017-06-29" (com hora opcional) -> "2017-06-29". */
export function normalizarData(v: unknown): string | null {
  const s = texto(v)
  if (!s) return null
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  return null
}

/**
 * Ordena as leituras por data e marca suspeita quando alguma quilometragem e
 * MENOR que a de uma leitura cronologicamente anterior: hodometro so anda pra
 * frente, entao km pra tras e sinal de adulteracao. Leituras sem data ou km
 * valido caem fora antes da comparacao.
 */
export function avaliarHodometro(
  leituras: unknown,
): { hodometro: HodometroLeitura[]; hodometro_suspeito: boolean } {
  const lista = Array.isArray(leituras) ? leituras : []
  const limpas: HodometroLeitura[] = lista
    .map((l: any) => ({ data: normalizarData(l?.data), km: Number(l?.km) }))
    .filter((l): l is HodometroLeitura => !!l.data && Number.isFinite(l.km) && l.km >= 0)
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))

  let suspeito = false
  for (let i = 1; i < limpas.length; i++) {
    if (limpas[i]!.km < limpas[i - 1]!.km) suspeito = true
  }
  return { hodometro: limpas, hodometro_suspeito: suspeito }
}

/**
 * Converte a captura estruturada da pagina (o `bruto` que o navegador raspa)
 * no detalhe normalizado que entra no snapshot. Tolerante a campos faltando:
 * o que nao vier vira null/lista vazia, nunca quebra.
 *
 * Restricoes NAO entram aqui: o SENATRAN ja cobre bloqueio/roubo/renajud etc.,
 * entao o servico de multas so traz multas, IPVA, licenciamento e hodometro.
 */
/** Tela de login do gov.br (a sessao caiu e o portal pediu CPF de novo). */
export function pareceLoginGovbr(texto: string): boolean {
  return /identifique-se no gov\.br|digite seu cpf|sso\.acesso\.gov\.br|entrar com gov\.br|acesse sua conta gov\.br/i.test(
    texto,
  )
}

/** Desafio de captcha na frente do resultado. */
export function pareceCaptcha(texto: string): boolean {
  return /não sou um robô|nao sou um robo|hcaptcha|recaptcha|resolva o desafio/i.test(texto)
}

/** Marcas de que ESTAMOS de fato na pagina de debitos e restricoes do veiculo. */
export function pareceResultadoDetran(texto: string): boolean {
  return /d[eé]bitos e restri|licenciamento|hod[oô]metro|multas?\b|ipva|restri[cç][oõ]es/i.test(texto)
}

// NOTA: o motor atual recebe JSON estruturado do runner (ver mapearRespostaRunner),
// entao parseResultadoMultas nao roda no fluxo. Fica como parser de texto de
// referencia, coberto por teste, caso volte a existir uma captura por texto.
export function parseResultadoMultas(bruto: any): MultasDetalhe {
  const b = bruto && typeof bruto === 'object' ? bruto : {}
  const { hodometro, hodometro_suspeito } = avaliarHodometro(b.hodometro)

  // Cada valor so e lido quando o campo VEIO na captura. Campo ausente = null
  // (nao 0): sem isso, "pagina sem dado nenhum" pareceria "tudo zerado" e o
  // veiculo seria dado como sem debito por engano.
  const presente = (...vs: any[]) => vs.some((v) => v != null)
  const multas = presente(b.multas_pix_centavos, b.multas, b.multas_texto)
    ? parseMoedaBR(b.multas_pix_centavos ?? b.multas ?? b.multas_texto)
    : null
  const ipva = presente(b.ipva_total_centavos, b.ipva)
    ? parseMoedaBR(b.ipva_total_centavos ?? b.ipva)
    : null
  const licenciamento = presente(b.licenciamento_centavos, b.licenciamento, b.licenciamento_texto)
    ? parseMoedaBR(b.licenciamento_centavos ?? b.licenciamento ?? b.licenciamento_texto)
    : null

  const pagina = texto(b.texto)
  // Debito EM ABERTO de verdade (valor > 0).
  const temDebitoAtivo = (multas ?? 0) > 0 || (ipva ?? 0) > 0 || (licenciamento ?? 0) > 0
  // Confirmacao de que lemos a pagina de resultado (algum valor veio, ou o
  // texto tem as marcas da pagina de debitos).
  const naPaginaDeResultado =
    multas != null || ipva != null || licenciamento != null || pareceResultadoDetran(pagina)

  // Status: prioridade pra o que o navegador ja concluiu; senao, so afirma
  // sem_debito quando de fato confirmamos a pagina de resultado. NUNCA dizer
  // "sem debito" quando na verdade caimos no login ou numa pagina desconhecida:
  // isso viraria "veiculo sem multa" pra quem pagou, que e pior que nao mostrar
  // nada. Na duvida, 'erro' -> fail-open (relatorio sem o bloco).
  let status: StatusMulta
  const explicito = texto(b.status)
  if (explicito && ['ok', 'sem_debito', 'sessao_expirada', 'captcha', 'erro'].includes(explicito)) {
    status = explicito as StatusMulta
  } else if (pareceLoginGovbr(pagina)) {
    status = 'sessao_expirada'
  } else if (pareceCaptcha(pagina)) {
    status = 'captcha'
  } else if (temDebitoAtivo) {
    status = 'ok'
  } else if (naPaginaDeResultado) {
    status = 'sem_debito'
  } else {
    status = 'erro'
  }

  return {
    status,
    uf: texto(b.uf).toUpperCase() || 'SP',
    multas_total_centavos: multas,
    ipva_total_centavos: ipva,
    licenciamento_centavos: licenciamento,
    licenciamento_venc: normalizarData(b.licenciamento_venc),
    hodometro,
    hodometro_suspeito,
  }
}

/** Monta o detalhe a partir de UMA linha da tabela multas_consultas (cache). */
export function detalheDaLinha(row: any): MultasDetalhe | null {
  if (!row || typeof row !== 'object') return null
  const { hodometro, hodometro_suspeito } = avaliarHodometro(row.hodometro)
  return {
    status: (row.status as StatusMulta) || 'ok',
    uf: row.uf ?? 'SP',
    multas_total_centavos: row.multas_total_centavos ?? null,
    ipva_total_centavos: row.ipva_total_centavos ?? null,
    licenciamento_centavos: row.licenciamento_centavos ?? null,
    licenciamento_venc: row.licenciamento_venc ?? null,
    hodometro,
    hodometro_suspeito: row.hodometro_suspeito ?? hodometro_suspeito,
  }
}

/** Status que vale guardar como resposta boa: o resto pode ser tentado de novo. */
export function respostaUtilMulta(d: MultasDetalhe | null): boolean {
  return !!d && (d.status === 'ok' || d.status === 'sem_debito')
}

// ------------------------------- infra -------------------------------------

const inicioDoDiaUTC = () =>
  new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').toISOString()
const desdeCacheISO = () => new Date(Date.now() - CACHE_DIAS * 86400000).toISOString()

/**
 * Worker deterministico no HOST da VPS: recebe {placa, renavam}, roda o
 * browser-harness + runner do DETRAN-SP (sessao gov.br no profile, auto-login),
 * e devolve o JSON estruturado. O container Nuxt nao roda o harness, entao a
 * consulta passa por essa ponte HTTP. Sem a env configurada, o relatorio segue
 * sem o bloco (fail-open).
 */
function workerConfig(): { url: string; secret: string } | null {
  const url = process.env.NUXT_DETRAN_WORKER_URL || ''
  if (!url) return null
  return { url: url.replace(/\/+$/, ''), secret: process.env.NUXT_DETRAN_WORKER_SECRET || '' }
}

function intOuNull(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

/**
 * Mapeia a resposta do runner (JSON entre <<<JSON>>>) pro MultasDetalhe.
 * Fail-open: falha do runner (ok:false), veiculo nao localizado (encontrado:false)
 * ou status desconhecido viram null -> relatorio sem o bloco. `com_debito` do
 * runner vira `ok`; o hodometro e reordenado/checado pelo mesmo avaliarHodometro
 * do cache, pra a flag de adulteracao ser consistente nos dois caminhos.
 */
export function mapearRespostaRunner(json: any, uf = 'SP'): MultasDetalhe | null {
  if (!json || typeof json !== 'object') return null
  if (json.ok === false) return null
  if (json.encontrado === false) return null
  const status: StatusMulta | null =
    json.status === 'com_debito' ? 'ok' : json.status === 'sem_debito' ? 'sem_debito' : null
  if (!status) return null
  const { hodometro, hodometro_suspeito } = avaliarHodometro(json.hodometro)
  return {
    status,
    uf: String(json.uf || uf || 'SP').toUpperCase(),
    multas_total_centavos: intOuNull(json.multas_total_centavos),
    ipva_total_centavos: intOuNull(json.ipva_total_centavos),
    licenciamento_centavos: intOuNull(json.licenciamento_centavos),
    licenciamento_venc: normalizarData(json.licenciamento_venc),
    hodometro,
    hodometro_suspeito,
  }
}

/** Linha de cache valida, ou null. Erro de banco nao bloqueia a busca. */
async function doCache(supabase: any, placa: string): Promise<MultasDetalhe | null> {
  try {
    const { data } = await supabase
      .from('multas_consultas')
      .select(
        'status,uf,multas_total_centavos,ipva_total_centavos,licenciamento_centavos,licenciamento_venc,hodometro,hodometro_suspeito',
      )
      .eq('placa', placa)
      .in('status', ['ok', 'sem_debito'])
      .gte('criado_em', desdeCacheISO())
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return null
    return detalheDaLinha(data)
  } catch {
    return null
  }
}

/**
 * Freios de gasto. O teto do dia soma ESTA tabela com a de recall — as duas
 * puxam do mesmo orcamento de navegador na nuvem. Falha de leitura NAO libera a
 * consulta: sem saber quanto ja foi gasto, o certo e nao gastar mais.
 */
async function podeGastar(supabase: any, placa: string): Promise<boolean> {
  try {
    const desde = inicioDoDiaUTC()
    const [multasHoje, recallHoje] = await Promise.all([
      supabase.from('multas_consultas').select('custo_usd').gte('criado_em', desde),
      supabase.from('recall_consultas').select('custo_usd').gte('criado_em', desde),
    ])
    const soma = (rows: any) =>
      (rows?.data || []).reduce((s: number, r: any) => s + (Number(r.custo_usd) || 0), 0)
    const gastoHoje = soma(multasHoje) + soma(recallHoje)
    if (gastoHoje >= TETO_DIARIO_USD) {
      console.warn(`[multas] teto diario atingido (US$ ${gastoHoje.toFixed(2)}), pulando`)
      return false
    }
    const { data: daPlaca } = await supabase
      .from('multas_consultas')
      .select('id')
      .eq('placa', placa)
      .gte('criado_em', desdeCacheISO())
    if ((daPlaca || []).length >= MAX_TENTATIVAS_POR_PLACA) return false
    return true
  } catch {
    return false
  }
}

async function registrar(supabase: any, linha: Record<string, any>): Promise<void> {
  try {
    await supabase.from('multas_consultas').insert(linha)
  } catch (e: any) {
    console.warn('[multas] insert falhou:', e?.message || e)
  }
}

// --------------------------- motor (fail-open) ------------------------------

/**
 * Busca o detalhe de multas da placa pelo worker deterministico. Devolve null
 * sempre que nao houver resposta util: quem chama trata null como "relatorio sem
 * o bloco". Fail-open em todos os ramos (worker fora do ar, timeout, JSON
 * estranho: relatorio sai como sempre saiu). Mantem os freios: cache 7d, teto de
 * gasto do dia somado ao recall e no maximo 2 tentativas por placa.
 */
export async function buscarMultasDetalhe(
  supabase: any,
  opts: { placa: string; renavam: string; uf?: string | null; consultaId?: string | null; timeoutMs?: number },
): Promise<MultasDetalhe | null> {
  const placa = String(opts.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const renavam = String(opts.renavam || '').replace(/[^0-9]/g, '')
  if (!placa || !renavam) return null

  const cache = await doCache(supabase, placa)
  if (cache) return cache

  const cfg = workerConfig()
  if (!cfg) return null // worker nao configurado: relatorio segue sem o bloco
  if (!(await podeGastar(supabase, placa))) return null

  const limite = opts.timeoutMs ?? TIMEOUT_MULTAS_MS
  const uf = opts.uf ?? 'SP'

  // Uma unica chamada HTTP pro worker no host. Erro/timeout viram resp=null e o
  // fluxo segue registrando a tentativa (pra os freios contarem) e devolvendo null.
  let resp: any = null
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), limite)
    try {
      const r = await fetch(`${cfg.url}/consultar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.secret ? { 'x-worker-secret': cfg.secret } : {}),
        },
        body: JSON.stringify({ placa, renavam, uf }),
        signal: ctrl.signal,
      })
      if (r.ok) resp = await r.json().catch(() => null)
      else console.warn(`[multas] worker respondeu ${r.status}`)
    } finally {
      clearTimeout(timer)
    }
  } catch (e: any) {
    console.warn('[multas] worker falhou:', e?.message || 'erro')
    resp = null
  }

  const detalhe = mapearRespostaRunner(resp, uf)

  await registrar(supabase, {
    placa,
    consulta_id: opts.consultaId ?? null,
    uf,
    status: detalhe?.status ?? (typeof resp?.status === 'string' ? resp.status : 'erro'),
    multas_total_centavos: detalhe?.multas_total_centavos ?? null,
    ipva_total_centavos: detalhe?.ipva_total_centavos ?? null,
    licenciamento_centavos: detalhe?.licenciamento_centavos ?? null,
    licenciamento_venc: detalhe?.licenciamento_venc ?? null,
    hodometro: detalhe?.hodometro ?? [],
    hodometro_suspeito: detalhe?.hodometro_suspeito ?? false,
    bruto: resp ?? null,
    run_id: typeof resp?.url === 'string' ? resp.url.slice(0, 300) : null,
    custo_usd: CUSTO_NOMINAL_USD,
  })

  return respostaUtilMulta(detalhe) ? detalhe : null
}
