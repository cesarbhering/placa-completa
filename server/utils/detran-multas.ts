// ---------------------------------------------------------------------------
// Multas e debitos no orgao de transito estadual (SP primeiro, 22/set/2026).
//
// A consulta paga do SENATRAN diz apenas que EXISTE multa (indicadorMultaRenainf).
// Quem pagou quer o VALOR e o detalhe: multas, IPVA, licenciamento (valor e
// vencimento) e o historico de hodometro (pra flagrar km rodado pra tras). As
// restricoes (bloqueio de furto/roubo, tributaria, judicial/Renajud etc.) NAO
// entram aqui: o SENATRAN ja as cobre. Esse detalhe mora no portal do orgao
// estadual, atras de um login gov.br, entao quem vai la e um navegador na nuvem
// com IP BR.
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

const API = 'https://api.browser-use.com/api/v4'

/** 7 dias: multa/licenciamento mudam pouco de semana em semana, mas mudam. */
const CACHE_DIAS = 7
const MAX_TENTATIVAS_POR_PLACA = 2
/** Teto do dia somado ao recall: as duas fontes puxam do mesmo orcamento. */
const TETO_DIARIO_USD = 5
// O browser standalone e cobrado por tempo e o valor exato so fecha depois. Ate
// conciliar, cada ida registra um custo NOMINAL, so pra o teto do dia ter dente
// (a ausencia de custo deixava a busca de multa correr sem limite de gasto).
const CUSTO_NOMINAL_USD = 0.3
const INTERVALO_POLL_MS = 8000
const TIMEOUT_MULTAS_MS = 6 * 60 * 1000

const SERVICO_URL =
  'https://www.detran.sp.gov.br/detransp/pb/servicos/veiculos/consultar_debitos_restricoes?id=carta_de_servico_consultar_debitos_restricoes'

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

function chave(): string | null {
  const k = process.env.NUXT_BROWSER_USE_API_KEY || ''
  return k ? k : null
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
const inicioDoDiaUTC = () =>
  new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').toISOString()
const desdeCacheISO = () => new Date(Date.now() - CACHE_DIAS * 86400000).toISOString()

async function chamar(caminho: string, init: RequestInit, k: string): Promise<any> {
  const r = await fetch(`${API}${caminho}`, {
    ...init,
    headers: { 'X-Browser-Use-API-Key': k, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  if (!r.ok) throw new Error(`browser-use ${caminho} respondeu ${r.status}`)
  return r.json().catch(() => ({}))
}

/**
 * StorageState do gov.br+detran pra reaproveitar a sessao sem relogar. Vem de
 * uma env (JSON) quando existe — no container e o unico jeito — e cai pra um
 * arquivo no host so em dev. Ausente = sem sessao: a busca nao acontece.
 */
async function carregarStorageState(): Promise<any | null> {
  const inline = process.env.NUXT_GOVBR_DETRAN_STATE || ''
  if (inline) {
    try {
      return JSON.parse(inline)
    } catch {
      return null
    }
  }
  const caminho = process.env.NUXT_GOVBR_STATE_PATH || ''
  if (!caminho) return null
  try {
    const { readFileSync } = await import('node:fs')
    return JSON.parse(readFileSync(caminho, 'utf8'))
  } catch {
    return null
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

// --------------------------- navegador (fail-open) --------------------------

/**
 * Dirige o portal DETRAN-SP num navegador da nuvem com IP BR, reaproveitando a
 * sessao gov.br salva. Passos (validados na mao em 22/set): abrir o servico
 * "Consultar Debitos e Restricoes" > "Entrar com gov.br" (SSO puxa a sessao) >
 * fechar tutorial > "Iniciar Servico" > "Veiculos de outras pessoas" > preencher
 * placa e renavam > "Consultar" > raspar a pagina de resultado.
 *
 * Isolado de proposito num modulo que so carrega o playwright quando de fato vai
 * navegar. Devolve o `bruto` raspado + o texto da pagina, ou null.
 */
async function navegarDetranSP(
  cdpUrl: string,
  state: any,
  placa: string,
  renavam: string,
  limiteMs: number,
): Promise<{ bruto: any; texto_pagina: string } | null> {
  // Import dinamico: a rota so puxa o playwright quando realmente vai ao portal.
  // playwright-core (sem browsers locais): a gente conecta num browser remoto.
  const { chromium } = await import('playwright-core')
  const browser = await chromium.connectOverCDP(cdpUrl)
  const t0 = Date.now()
  try {
    const ctx = browser.contexts()[0] || (await browser.newContext())
    // Injeta a sessao salva (cookies do gov.br + detran) antes de navegar.
    if (Array.isArray(state?.cookies) && state.cookies.length) {
      await ctx.addCookies(state.cookies).catch(() => {})
    }
    const p = ctx.pages()[0] || (await ctx.newPage())
    const restante = () => Math.max(5000, limiteMs - (Date.now() - t0))
    const txt = async () =>
      (await p.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ')
    const clicar = async (sels: string[]) => {
      for (const s of sels) {
        const l = p.locator(s).first()
        if ((await l.count().catch(() => 0)) && (await l.isEnabled().catch(() => false))) {
          await l.scrollIntoViewIfNeeded().catch(() => {})
          await l.click().catch(() => {})
          return true
        }
      }
      return false
    }

    await p.goto(SERVICO_URL, { waitUntil: 'domcontentloaded', timeout: Math.min(60000, restante()) })
    await p.waitForTimeout(2500)
    await clicar(['button:has-text("Fechar")', 'button[aria-label="Fechar"]'])
    await clicar(['a:has-text("Entrar com gov.br")', 'button:has-text("Entrar com gov.br")'])
    await p.waitForTimeout(6000)

    // Sessao caiu: o portal jogou pra tela de login do gov.br.
    if (pareceLoginGovbr(await txt())) {
      return { bruto: { status: 'sessao_expirada' }, texto_pagina: 'sessao gov.br expirada' }
    }

    await clicar(['button:has-text("Fechar")', 'button:has-text("Entendi")'])
    await clicar(['button:has-text("Iniciar Serviço")', 'a:has-text("Iniciar Serviço")', 'button:has-text("Iniciar")'])
    await p.waitForTimeout(3500)
    await clicar([
      '*:has-text("Veículos de outras pessoas")',
      'button:has-text("Outro")',
      '*:has-text("veículo de terceiro")',
    ])
    await p.waitForTimeout(3000)

    await p.fill('input[name="placa-input"]', placa).catch(() => {})
    await p.fill('input[name="renavam-input"]', renavam).catch(() => {})
    await clicar([
      'button:has-text("Consultar")',
      'button:has-text("Continuar")',
      'button:has-text("Avançar")',
      'button[type="submit"]',
    ])
    await p.waitForTimeout(9000)
    await clicar(['button:has-text("Fechar")', 'button:has-text("Entendi")', 'button:has-text("OK")'])
    await p.waitForTimeout(4000)

    const corpo = await txt()
    // A sessao pode ter caido so agora (redirect tardio pro login do gov.br).
    // Detectar aqui evita raspar a tela de login como se fosse resultado e,
    // pior, rotula-la como sem_debito.
    if (pareceLoginGovbr(corpo)) {
      return { bruto: { status: 'sessao_expirada' }, texto_pagina: corpo.slice(0, 800) }
    }
    if (pareceCaptcha(corpo)) {
      return { bruto: { status: 'captcha' }, texto_pagina: corpo.slice(0, 800) }
    }

    // Raspa o que a pagina expoe. A extracao estruturada fina roda no browser;
    // o texto integral vai junto pra parsear/conferir o que faltar.
    const scrape = await p
      .evaluate(() => {
        const t = document.body.innerText || ''
        const pega = (re: RegExp) => {
          const m = t.match(re)
          return m ? m[1].trim() : null
        }
        return {
          multas: pega(/Multas?[^R\n]*(R\$\s*[\d.,]+)/i) || pega(/Multas?[:\s]+([^\n]{0,40})/i),
          ipva: pega(/IPVA[^R\n]*(R\$\s*[\d.,]+)/i) || pega(/IPVA[:\s]+([^\n]{0,40})/i),
          licenciamento:
            pega(/Licenciamento[^R\n]*(R\$\s*[\d.,]+)/i) || pega(/Licenciamento[:\s]+([^\n]{0,40})/i),
          licenciamento_venc: pega(/Licenciamento[^\n]*?(\d{2}\/\d{2}\/\d{4})/i),
          texto: t.slice(0, 4000),
        }
      })
      .catch(() => ({ texto: corpo.slice(0, 4000) }))

    return { bruto: { uf: 'SP', ...scrape }, texto_pagina: corpo.slice(0, 800) }
  } finally {
    // close() so desconecta o CDP; o browser da nuvem e parado por quem chamou.
    await browser.close().catch(() => {})
  }
}

/**
 * Busca o detalhe de multas/restricoes da placa. Devolve null sempre que nao
 * houver resposta util: quem chama trata null como "relatorio sem o bloco".
 * Fail-open em todos os ramos.
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

  const k = chave()
  if (!k) return null // env nao configurada: relatorio segue sem o bloco
  const state = await carregarStorageState()
  if (!state) return null // sem sessao gov.br nao da pra consultar
  if (!(await podeGastar(supabase, placa))) return null

  const limite = opts.timeoutMs ?? TIMEOUT_MULTAS_MS
  let browserId: string | null = null
  try {
    const criado = await chamar(
      '/browsers',
      { method: 'POST', body: JSON.stringify({ proxyCountryCode: 'br' }) },
      k,
    )
    browserId = texto(criado?.id) || null
    const cdpUrl = texto(criado?.cdpUrl || criado?.cdp_url || criado?.wsUrl)
    if (!browserId || !cdpUrl) return null

    const navegado = await navegarDetranSP(cdpUrl, state, placa, renavam, limite).catch(() => null)
    const detalhe = navegado ? parseResultadoMultas({ uf: opts.uf ?? 'SP', ...navegado.bruto }) : null

    await registrar(supabase, {
      placa,
      consulta_id: opts.consultaId ?? null,
      uf: opts.uf ?? 'SP',
      status: detalhe?.status ?? 'erro',
      multas_total_centavos: detalhe?.multas_total_centavos ?? null,
      ipva_total_centavos: detalhe?.ipva_total_centavos ?? null,
      licenciamento_centavos: detalhe?.licenciamento_centavos ?? null,
      licenciamento_venc: detalhe?.licenciamento_venc ?? null,
      hodometro: detalhe?.hodometro ?? [],
      hodometro_suspeito: detalhe?.hodometro_suspeito ?? false,
      bruto: navegado?.bruto ?? null,
      run_id: browserId,
      custo_usd: CUSTO_NOMINAL_USD, // estimativa; browser standalone e cobrado por tempo
    })

    return respostaUtilMulta(detalhe) ? detalhe : null
  } catch (e: any) {
    console.warn(`[multas] falhou (browser=${browserId || 'nao criado'}):`, e?.message || 'erro')
    return null
  } finally {
    // SEMPRE para o navegador da nuvem: standalone e cobrado por tempo.
    if (browserId) {
      await chamar(`/browsers/${browserId}`, { method: 'PATCH', body: JSON.stringify({ action: 'stop' }) }, k).catch(
        () => {},
      )
    }
  }
}
