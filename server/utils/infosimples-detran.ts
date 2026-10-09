import { encrypt } from 'aes-bridge'
import { renavamDaResposta, ufDaResposta } from './detran-multas'

// DETRAN estadual via Infosimples (comeca por SP: /detran/sp/debitos). Substitui
// o runner gov.br quebrado no relatorio PAGO. Traz multas, hodometro (vistorias),
// IPVA, licenciamento e restricoes. Uma chamada por pedido (cada uma custa
// ~R$0,28, ATE em erro de parametro), gated por UF SP e com cache no snapshot.
//
// O certificado depende da UF (DETRAN_UFS.cert): hoje SP e SC = e-CNPJ. Mandado criptografado: base64 do .pfx ->
// aes-bridge encrypt (AES-256-GCM) -> url-safe. A senha do pfx idem. O Infosimples
// decripta com a mesma ENC_KEY. Criptografado em runtime a cada chamada.

const BASE = 'https://api.infosimples.com/api/v2/consultas'

/** aes-bridge encrypt + url-safe (+ -> -, / -> _, sem =), como o Infosimples pede. */
export async function encriptarInfosimples(valor: string, encKey: string): Promise<string> {
  const cifrado = await encrypt(valor, encKey)
  return String(cifrado).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Credencial mandada ao Infosimples por UF: certificado (e-CNPJ ou e-CPF) ou
 * login gov.br do Cesar (BA e DF usam a MESMA conta: NUXT_INFOSIMPLES_BA_*),
 * ou 'nenhum' (CE, PA, AM: so placa + renavam).
 */
export type CertInfosimples = 'ecnpj' | 'ecpf' | 'govbr_ba' | 'govbr_df' | 'govbr_ac' | 'nenhum'

/** UF que entra com o login gov.br (CPF+senha), nao com certificado. */
export function usaLoginGovbr(cert: string | null | undefined): boolean {
  return cert === 'govbr_ba' || cert === 'govbr_df' || cert === 'govbr_ac'
}

function infosimplesConfig(cert: CertInfosimples = 'ecnpj') {
  const c = useRuntimeConfig() as any
  // Fallback pro process.env em runtime: o override automatico do Nuxt mapeia
  // infosimplesPkcs12B64 pra NUXT_INFOSIMPLES_PKCS12B64 (sem o _ antes do B64),
  // entao a env NUXT_INFOSIMPLES_PKCS12_B64 so chegava se existisse no BUILD.
  // O e-CPF e lido SO do process.env (NUXT_INFOSIMPLES_ECPF_PKCS12_B64/_PASS).
  const env = process.env
  const pkcs12B64 = cert === 'ecpf'
    ? String(env.NUXT_INFOSIMPLES_ECPF_PKCS12_B64 || '')
    : String(c.infosimplesPkcs12B64 || env.NUXT_INFOSIMPLES_PKCS12_B64 || env.NUXT_INFOSIMPLES_PKCS12B64 || '')
  const pkcs12Pass = cert === 'ecpf'
    ? String(env.NUXT_INFOSIMPLES_ECPF_PKCS12_PASS || '')
    : String(c.infosimplesPkcs12Pass || env.NUXT_INFOSIMPLES_PKCS12_PASS || '')
  return {
    token: String(c.infosimplesToken || env.NUXT_INFOSIMPLES_TOKEN || ''),
    encKey: String(c.infosimplesEncKey || env.NUXT_INFOSIMPLES_ENC_KEY || ''),
    pkcs12B64,
    pkcs12Pass,
  }
}

/**
 * Login gov.br do DETRAN-BA (CPF + senha do Cesar, NAO e certificado). A senha
 * vai em TEXTO PURO: criptografada o gov.br recusa (608) e cada recusa conta
 * como tentativa errada na conta dele. Lidas so do process.env.
 */
function loginBa() {
  return {
    cpf: String(process.env.NUXT_INFOSIMPLES_BA_CPF || '').replace(/\D/g, ''),
    senha: String(process.env.NUXT_INFOSIMPLES_BA_SENHA || ''),
  }
}

/** Credencial da UF presente? Sem ela a UF nao roda (fail-open). */
export function infosimplesConfigurado(cert: CertInfosimples = 'ecnpj'): boolean {
  if (cert === 'nenhum') return !!infosimplesConfig('ecnpj').token
  if (usaLoginGovbr(cert)) {
    const t = infosimplesConfig('ecnpj').token
    const l = loginBa()
    return !!(t && l.cpf && l.senha)
  }
  const c = infosimplesConfig(cert)
  return !!(c.token && c.encKey && c.pkcs12B64 && c.pkcs12Pass)
}

/** UF de registro do veiculo (do SENATRAN) e SP? A chamada so vale pra SP por ora. */
export function ehVeiculoSp(uf: string | null | undefined): boolean {
  return String(uf || '').trim().toUpperCase() === 'SP'
}

/** UFs com DETRAN via Infosimples: endpoint, marca no snapshot e fonte de custo. */
export const DETRAN_UFS = {
  // gate: 'sempre' = todo pedido da UF; 'renainf' = so quando o SENATRAN traz
  // indicadorMultaRenainf=true (decisao do Cesar, 30/set: reduz chamadas). O
  // backfill manual por token ignora o gate.
  SP: { path: 'detran/sp/debitos', cert: 'ecnpj', gate: 'sempre', fonte: 'detran_sp', fonteCusto: 'infosimples_detran_sp' },
  // SC aceitou o e-CNPJ (teste do Lead, 29/set): decisao final do Cesar. O
  // 'ecpf' segue suportado pra UF futura, mas nenhuma usa hoje.
  SC: { path: 'detran/sc/veiculo', cert: 'ecnpj', gate: 'renainf', fonte: 'detran_sc', fonteCusto: 'infosimples_detran_sc' },
  // MG exige o chassi alem de placa+renavam (vem do SENATRAN).
  // BA: login gov.br (CPF+senha), renavam sem placa. R$0,30 por chamada.
  // complemento: o /multas do BA so traz multas; licenciamento e IPVA vem do
  // /licenciamento (mesmo login, so renavam, R$0,30; teste JPQ6371, 09/out).
  BA: { path: 'detran/ba/multas', cert: 'govbr_ba', gate: 'renainf', fonte: 'detran_ba', fonteCusto: 'infosimples_detran_ba',
    complemento: { path: 'detran/ba/licenciamento', fonteCusto: 'infosimples_detran_ba_licenciamento' } },
  // complemento: o /infracoes so traz multas; IPVA e licenciamento vem do
  // /veiculo (e-CNPJ, placa + renavam, R$0,28, ~15 s; teste IWC7G10, 09/out).
  RS: { path: 'detran/rs/infracoes', cert: 'ecnpj', gate: 'renainf', fonte: 'detran_rs', fonteCusto: 'infosimples_detran_rs',
    complemento: { path: 'detran/rs/veiculo', fonteCusto: 'infosimples_detran_rs_veiculo' } },
  MG: { path: 'detran/mg/multas-descritivos', cert: 'ecnpj', gate: 'renainf', fonte: 'detran_mg', fonteCusto: 'infosimples_detran_mg', exigeChassi: true },
  // GO: e-CNPJ, placa+renavam. R$0,28 por chamada (teste do Lead, 30/set).
  GO: { path: 'detran/go/debitos', cert: 'ecnpj', gate: 'renainf', fonte: 'detran_go', fonteCusto: 'infosimples_detran_go' },
  // PR: e-CPF (NAO o e-CNPJ), so renavam (sem placa). R$0,24. A resposta e uma
  // LISTA (data[] = uma multa por item, pagas e em aberto), nao data[0].
  PR: { path: 'detran/pr/multas-descritivos', cert: 'ecpf', gate: 'renainf', fonte: 'detran_pr', fonteCusto: 'infosimples_detran_pr', semPlaca: true, dataLista: true },
  // DF: login gov.br (mesma conta do BA), placa+renavam. R$0,28.
  DF: { path: 'detran/df/debitos', cert: 'govbr_df', gate: 'renainf', fonte: 'detran_df', fonteCusto: 'infosimples_detran_df' },
  // Sem credencial (so placa + renavam). CE R$0,20; PA e AM R$0,24.
  CE: { path: 'detran/ce/multas', cert: 'nenhum', gate: 'renainf', fonte: 'detran_ce', fonteCusto: 'infosimples_detran_ce' },
  PA: { path: 'detran/pa/infracoes', cert: 'nenhum', gate: 'renainf', fonte: 'detran_pa', fonteCusto: 'infosimples_detran_pa' },
  AM: { path: 'detran/am/multas', cert: 'nenhum', gate: 'renainf', fonte: 'detran_am', fonteCusto: 'infosimples_detran_am' },
  // PE: e-CNPJ, placa+renavam+chassi (os tres obrigatorios). R$0,28, LENTO (~40s).
  // ES: e-CNPJ, placa+renavam. R$0,28, LENTO (~46s).
  ES: { path: 'detran/es/veiculo', cert: 'ecnpj', gate: 'renainf', fonte: 'detran_es', fonteCusto: 'infosimples_detran_es' },
  PE: { path: 'detran/pe/extrato-geral', cert: 'ecnpj', gate: 'renainf', fonte: 'detran_pe', fonteCusto: 'infosimples_detran_pe', exigeChassi: true },
  // 06/out (spike): MA (R$0,24, ~2 min) e AC (login gov.br da mesma conta do
  // BA/DF, R$0,28, ~30 s) testados com veiculo real. AL, PI e RR so pela doc
  // da Infosimples (sem renavam pra testar): formato nao reconhecido vira
  // 'indisponivel' e loga so as CHAVES da resposta.
  MA: { path: 'detran/ma/multas', cert: 'nenhum', gate: 'renainf', fonte: 'detran_ma', fonteCusto: 'infosimples_detran_ma' },
  AC: { path: 'detran/ac/veiculo', cert: 'govbr_ac', gate: 'renainf', fonte: 'detran_ac', fonteCusto: 'infosimples_detran_ac' },
  AL: { path: 'detran/al/infracoes', cert: 'nenhum', gate: 'renainf', fonte: 'detran_al', fonteCusto: 'infosimples_detran_al' },
  PI: { path: 'detran/pi/multas', cert: 'nenhum', gate: 'renainf', fonte: 'detran_pi', fonteCusto: 'infosimples_detran_pi' },
  RR: { path: 'detran/rr/debitos', cert: 'nenhum', gate: 'renainf', fonte: 'detran_rr', fonteCusto: 'infosimples_detran_rr' },
} as const
export type UfDetran = keyof typeof DETRAN_UFS

/** UF (do SENATRAN) com consulta DETRAN disponivel? Devolve a UF normalizada ou null. */
export function ufDetranSuportada(uf: string | null | undefined): UfDetran | null {
  const u = String(uf || '').trim().toUpperCase()
  return u in DETRAN_UFS ? (u as UfDetran) : null
}

/** O SENATRAN acusou multa RENAINF? (indicador na raiz ou em `restricoes`) */
export function temMultaRenainf(response: any): boolean {
  const bruto = Array.isArray(response) ? response[0] : response
  return bruto?.indicadorMultaRenainf === true || bruto?.restricoes?.indicadorMultaRenainf === true
}

/** Chassi vindo da resposta paga do SENATRAN (o DETRAN-MG exige). */
export function chassiDaResposta(response: any): string | null {
  const bruto = Array.isArray(response) ? response[0] : response
  const c = String(bruto?.chassi ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return c.length >= 11 ? c : null
}

export interface ResultadoDetran {
  code: number
  codeMessage: string
  preco: number
  data: any | null
  /** json.errors da Infosimples (ex.: 620 "O veículo consultado está protegido..."). */
  erros?: string[]
}

/**
 * O PROPRIETARIO bloqueou a consulta publica do veiculo no DETRAN (achado
 * MES3261, DETRAN-SC: code 620 "O veículo consultado está protegido. Entre em
 * contato com o proprietário do veículo."). Nao e falha do sistema: a resposta
 * nao muda tentando de novo, e cada tentativa e cobrada (R$ 0,28). Vira status
 * final 'protegido', sem retry. Reconhece pelo texto, entao vale pra qualquer
 * UF que responder o mesmo.
 */
export function ehVeiculoProtegido(res: Pick<ResultadoDetran, 'code' | 'codeMessage' | 'erros'>): boolean {
  if (res.code !== 620) return false
  const texto = [res.codeMessage, ...(res.erros || [])].join(' ')
  return /protegid/i.test(texto)
}

/**
 * Consulta o DETRAN de uma UF no Infosimples. Devolve o code, o preco
 * (header.price, pra gravar o custo SEMPRE) e o data[0] cru. A resposta crua
 * inteira NAO e devolvida: no SC ela traz nome de proprietario/condutor (LGPD);
 * quem chama so ve o data[0], que vai direto pro parser de whitelist. Nao lanca:
 * erro de rede vira code=0/data=null (o chamador e fail-open).
 */
/** Infosimples tem ate 300 s; nos esperamos 330 s (roda depois da entrega). */
export const INFOSIMPLES_TIMEOUT_S = 300
export const ABORT_MS = 330_000
/** Codigos que valem 1 nova tentativa: 0 = abort/rede nosso, 605/609 = erro na origem. */
export const CODIGOS_RETRY = new Set([0, 605, 609])
export const ESPERA_RETRY_MS = 20_000

export async function consultarDetranInfosimples(opts: { uf: UfDetran; placa: string; renavam: string; chassi?: string | null; path?: string }): Promise<ResultadoDetran> {
  const cfgUf: any = DETRAN_UFS[opts.uf]
  const certUf: CertInfosimples = cfgUf.cert
  const cfg = infosimplesConfig(usaLoginGovbr(certUf) || certUf === 'nenhum' ? 'ecnpj' : certUf)
  if (!infosimplesConfigurado(certUf)) return { code: 0, codeMessage: `infosimples nao configurado (${certUf})`, preco: 0, data: null }
  try {
    const body = new URLSearchParams({
      token: cfg.token,
      // Tempo que a Infosimples tem pra responder. TEM que ser menor que o
      // nosso abort (ABORT_MS): antes era 600 s aqui e 120 s la, e toda UF que
      // passava de 2 min virava 'indisponivel' (incidente 01-03/out).
      timeout: String(INFOSIMPLES_TIMEOUT_S),
      ignore_site_receipt: '0',
      // Renavam com 11 digitos (o SENATRAN as vezes manda sem os zeros a esquerda).
      renavam: String(opts.renavam).padStart(11, '0'),
    })
    if (certUf === 'govbr_ba') {
      // BA: login gov.br, sem placa, chassi vazio, senha em texto puro.
      const l = loginBa()
      body.set('chassi', '')
      body.set('login_cpf', l.cpf)
      body.set('login_senha', l.senha)
    } else if (certUf === 'govbr_df' || certUf === 'govbr_ac') {
      // DF e AC: placa + renavam + login gov.br (mesma conta do BA), senha em texto puro.
      const l = loginBa()
      body.set('placa', opts.placa)
      body.set('login_cpf', l.cpf)
      body.set('login_senha', l.senha)
    } else if (certUf === 'nenhum') {
      body.set('placa', opts.placa)
    } else {
      const [cert, pass] = await Promise.all([
        encriptarInfosimples(cfg.pkcs12B64, cfg.encKey),
        encriptarInfosimples(cfg.pkcs12Pass, cfg.encKey),
      ])
      body.set('pkcs12_cert', cert)
      body.set('pkcs12_pass', pass)
      if (!cfgUf.semPlaca) body.set('placa', opts.placa)
    }
    if (opts.chassi) body.set('chassi', String(opts.chassi).toUpperCase())
    const res = await fetch(`${BASE}/${opts.path || DETRAN_UFS[opts.uf].path}`, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(ABORT_MS),
    })
    const json: any = await res.json().catch(() => ({}))
    const code = Number(json?.code || res.status || 0)
    let dados: any = null
    if (cfgUf.dataLista) {
      // PR: a lista inteira. 612 = "a consulta nao retornou dados" = nenhuma
      // multa no DETRAN-PR, vira lista vazia (e cobrado igual).
      dados = Array.isArray(json?.data) ? json.data : (code === 612 ? [] : null)
    } else {
      dados = Array.isArray(json?.data) ? (json.data[0] ?? null) : null
    }
    return {
      code: cfgUf.dataLista && code === 612 ? 200 : code,
      codeMessage: String(json?.code_message || ''),
      preco: Number(json?.header?.price || 0),
      data: dados,
      erros: Array.isArray(json?.errors) ? json.errors.map((e: any) => String(e)) : [],
    }
  } catch (e: any) {
    return { code: 0, codeMessage: String(e?.message || e), preco: 0, data: null }
  }
}

/** Atalho do SP (mantido pro backfill/testes). */
export function consultarDetranSp(opts: { placa: string; renavam: string }): Promise<ResultadoDetran> {
  return consultarDetranInfosimples({ uf: 'SP', ...opts })
}

// ---------- Parser (puro, testavel) ----------

// Aceita number (2970.56), string decimal com ponto ("2970.56", como o
// Infosimples manda o multas_total) e formato BR ("R$ 2.970,56"). Tirar todos os
// pontos sem olhar o formato transformava "2970.56" em 297056.
export function moeda(v: any): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  let t = String(v ?? '').replace(/[^\d,.-]/g, '')
  if (!t) return 0
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.') // BR: 2.970,56
  else if (/\.\d{3}(\.|$)/.test(t) && !/\.\d{1,2}$/.test(t)) t = t.replace(/\./g, '') // 2.970 (milhar)
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

// "27/12/2021" -> timestamp pra ordenar. Invalida -> 0.
function tsData(br: string | null | undefined): number {
  const m = String(br || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return 0
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime()
}

function kmNumero(s: any): number | null {
  const m = String(s ?? '').match(/[\d.]+/)
  if (!m) return null
  const n = Number(m[0].replace(/\./g, ''))
  return Number.isFinite(n) ? n : null
}

// "exercicio 2020" -> 2020.
function anoDoExercicio(s: any): number | null {
  const m = String(s ?? '').match(/(\d{4})/)
  return m ? Number(m[1]) : null
}

/**
 * So mostra restricao que de fato consta. O DETRAN manda texto livre, as vezes
 * uma lista separada por virgula que mistura negativa e positiva:
 * "Nada consta" / "Não Consta Bloqueio Judicial - Renajud" -> null;
 * "NADA CONSTA, Consta Bloqueio Judicial - Renajud" -> "Consta Bloqueio Judicial - Renajud".
 */
export function restricaoConsta(v: any): string | null {
  const partes = String(v ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/^(nada|n[aã]o)\s+consta\b/i.test(p))
  return partes.length ? partes.join(', ') : null
}

/** Um exercicio de IPVA em aberto, discriminado (lista igual as multas). */
export interface IpvaItem { ano: number | null; vencimento: string | null; valor_centavos: number }

/**
 * Item de IPVA de qualquer UF -> {ano, vencimento, valor_centavos}. Defensivo
 * (SP manda debitos_ipva[] sem shape documentado): ano de exercicio/ano/classe/
 * descricao ou do vencimento; valor do normalizado/atual/nominal. Sem valor -> null.
 */
export function ipvaItemGenerico(x: any): IpvaItem | null {
  if (!x || typeof x !== 'object') return null
  const venc = [x.normalizado_vencimento, x.data_vencimento, x.vencimento].map((v) => String(v ?? '').match(/\d{2}\/\d{2}\/\d{4}/)?.[0]).find(Boolean) || null
  const ano = [x.exercicio, x.ano, x.classe, x.descricao].map((v) => { const m = String(v ?? '').match(/(19|20)\d{2}/); return m ? Number(m[0]) : null }).find((v) => v != null)
    ?? (venc ? Number(venc.slice(6)) : null)
  const brutos = [x.normalizado_valor_atual, x.valor_atual, x.normalizado_valor, x.valor, x.normalizado_valor_nominal, x.valor_nominal]
  const valor = brutos.map((v) => (typeof v === 'number' ? v : moeda(v))).find((v) => v > 0) || 0
  if (!(valor > 0)) return null
  return { ano, vencimento: venc, valor_centavos: Math.round(valor * 100) }
}

function ordenarIpva<T extends { ano: number | null }>(l: T[]): T[] {
  return l.sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0))
}

export interface DetranMulta {
  auto: string | null
  descricao: string | null
  dataInfracao: string | null
  horaInfracao: string | null
  dataVencimento: string | null
  valor: number
  local: string | null
  municipio: string | null
  orgao: string | null
}

export interface DetranParsed {
  multas: { total: number; mensagem: string | null; itens: DetranMulta[] }
  hodometro: { leituras: { data: string; km: number }[]; suspeitaAdulteracao: boolean }
  ipva: { valor: number; mensagem: string | null; temDebito: boolean; itens: IpvaItem[] }
  licenciamento: { valor: number; mensagem: string | null; ultimoExercicio: number | null; atrasado: boolean; status: string | null }
  restricoes: { financeira: string | null; judiciaria: string | null; administrativa: string | null; tributaria: string | null; furto: string | null }
  temAlgo: boolean
}

/** Algum debito de licenciamento com vencimento ja passado? (item sem data nao prova atraso) */
function debitoLicenciamentoVencido(itens: any, hoje: Date): boolean {
  if (!Array.isArray(itens)) return false
  return itens.some((x: any) => {
    const venc = x?.data_vencimento ?? x?.vencimento ?? x?.normalizado_vencimento
    const t = tsData(venc)
    return t > 0 && t < hoje.getTime()
  })
}

/**
 * Modela o data[0] do Infosimples pro relatorio. Puro (sem rede), pra testar o
 * hodometro (dedupe + ordem + suspeita de adulteracao) e o licenciamento atrasado.
 * `hoje` injetavel pra teste deterministico (aceita Date ou so o ano).
 */
export function parsearDetranSp(data: any, hoje: Date | number = new Date()): DetranParsed {
  const d = data || {}
  const agora = typeof hoje === 'number' ? new Date(hoje, 0, 1) : hoje
  const anoAtual = agora.getFullYear()

  // Multas em aberto.
  const itens: DetranMulta[] = (Array.isArray(d.debitos_multas) ? d.debitos_multas : []).map((m: any) => ({
    auto: m?.auto_infracao ?? null,
    descricao: m?.descricao ?? null,
    dataInfracao: m?.data_infracao ?? null,
    horaInfracao: m?.hora_infracao ?? null,
    dataVencimento: m?.data_vencimento ?? null,
    valor: moeda(m?.valor),
    local: m?.local ?? null,
    municipio: m?.municipio ?? null,
    orgao: m?.orgao_autuador?.nome ?? null,
  }))
  const multasTotal = moeda(d.multas_total) || itens.reduce((s, i) => s + i.valor, 0)

  // Hodometro: dedupe (data+km iguais), ordena por data crescente. Suspeita se
  // uma leitura MAIS NOVA tem km MENOR que uma anterior (odometro nao anda pra tras).
  const vistas = (Array.isArray(d.vistorias) ? d.vistorias : [])
    .map((v: any) => ({ data: String(v?.data || ''), km: kmNumero(v?.km) }))
    .filter((v: any) => v.data && v.km != null) as { data: string; km: number }[]
  const chave = new Set<string>()
  const leituras = vistas
    .filter((v) => { const k = `${v.data}|${v.km}`; if (chave.has(k)) return false; chave.add(k); return true })
    .sort((a, b) => tsData(a.data) - tsData(b.data))
  let suspeitaAdulteracao = false
  for (let i = 1; i < leituras.length; i++) {
    if (leituras[i].km < leituras[i - 1].km) { suspeitaAdulteracao = true; break }
  }

  // IPVA: mostra o que vier (sem estimar). Debito se ha itens ou valor > 0.
  const ipvaValor = moeda(d.ipva)
  const ipvaTemDebito = ipvaValor > 0 || (Array.isArray(d.debitos_ipva) && d.debitos_ipva.length > 0)

  // Licenciamento: o calendario SP vence por final de placa (jul-dez), entao
  // exercicio = ano atual - 1 NAO prova atraso (em jan-jun todo carro em dia
  // esta assim). Atrasado so com debito de licenciamento JA vencido, ou com o
  // ultimo exercicio <= ano atual - 2 (mesmo com debito zerado: pode ter ido pra
  // divida ativa). Mesma regra do SC.
  const ultimoExercicio = anoDoExercicio(d.ultimo_licenciamento)
  const licVencido = debitoLicenciamentoVencido(d.debitos_licenciamento, agora)
  const licAtrasado = ultimoExercicio != null && (licVencido || ultimoExercicio <= anoAtual - 2)

  const restricoes = {
    financeira: restricaoConsta(d.restricao_financeira),
    judiciaria: restricaoConsta(d.restricao_judiciaria),
    administrativa: restricaoConsta(d.restricao_administrativa),
    tributaria: restricaoConsta(d.restricao_tributaria),
    furto: restricaoConsta(d.bloqueio_furto),
  }

  const temAlgo = itens.length > 0 || leituras.length > 0 || ipvaTemDebito || licAtrasado
    || Object.values(restricoes).some(Boolean)

  return {
    multas: { total: multasTotal, mensagem: d.multas_mensagem ?? null, itens },
    hodometro: { leituras, suspeitaAdulteracao },
    ipva: { valor: ipvaValor, mensagem: d.ipva_mensagem ?? null, temDebito: ipvaTemDebito, itens: ordenarIpva((Array.isArray(d.debitos_ipva) ? d.debitos_ipva : []).map(ipvaItemGenerico).filter(Boolean) as IpvaItem[]) },
    licenciamento: {
      valor: moeda(d.licenciamento_valor),
      mensagem: d.licenciamento_mensagem ?? null,
      ultimoExercicio,
      atrasado: licAtrasado,
      status: d.status_licenciamento ?? null,
    },
    restricoes,
    temAlgo,
  }
}

// "04/07/2022" -> "2022-07-04" (a UI do relatorio formata a partir de ISO).
function brParaIso(br: string | null | undefined): string | null {
  const m = String(br || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

/**
 * Mapeia o DETRAN parseado pro MESMO shape que a secao "Multas e débitos" do
 * relatorio ja consome (total + breakdown + hodometro com deteccao de regressao).
 * Assim a UI existente e reusada; os campos extras do Infosimples (itens de multa,
 * licenciamento atrasado, restricoes) vao junto pra os blocos novos.
 */
export function detranParaMultas(parsed: DetranParsed) {
  return {
    status: 'ok' as const,
    fonte: 'detran_sp',
    multas_total_centavos: Math.round(parsed.multas.total * 100),
    licenciamento_centavos: Math.round(parsed.licenciamento.valor * 100),
    ipva_total_centavos: Math.round(parsed.ipva.valor * 100),
    // IPVA discriminado por exercicio (quando o SP manda itens).
    ipva_itens: parsed.ipva.itens,
    hodometro: parsed.hodometro.leituras.map((l) => ({ data: brParaIso(l.data), km: l.km })),
    hodometro_suspeito: parsed.hodometro.suspeitaAdulteracao,
    // Extras do Infosimples (blocos novos na secao):
    multas_itens: parsed.multas.itens,
    // Ano do ultimo licenciamento quando esta atrasado (exercicio < ano atual),
    // mesmo com debito zerado; null quando em dia.
    licenciamento_atrasado_ano: parsed.licenciamento.atrasado ? parsed.licenciamento.ultimoExercicio : null,
    // Ultimo exercicio licenciado (a UI mostra "Último: X" neutro quando nao e o ano atual e nao ha atraso).
    ultimo_licenciamento_ano: parsed.licenciamento.ultimoExercicio,
    restricoes_detran: Object.entries(parsed.restricoes)
      .filter(([, v]) => !!v)
      .map(([tipo, texto]) => ({ tipo, texto })),
  }
}

// ---------- DETRAN-SC (/detran/sc/veiculo) ----------
//
// LGPD: a resposta do SC traz nome_proprietario_atual, nome_proprietario_anterior,
// nome_principal_condutor, ultimo_processo.interessado, nomes (mascarados) no
// texto do SNG e um site_receipt com o comprovante inteiro. O parser e uma
// WHITELIST: monta o bloco so com os campos abaixo, nunca espalha o objeto cru.
// Nada disso chega no snapshot, no cache ou em log.

function dataHoraBr(s: any): { data: string | null; hora: string | null } {
  const m = String(s || '').match(/(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}))?/)
  return { data: m ? m[1] : null, hora: m && m[2] ? m[2] : null }
}

/** "Registro de ... informado por B**** em 29/09/2026 às 16h08min para I**** F****" -> sem os nomes. */
export function limparTextoSng(s: any): string | null {
  let t = String(s ?? '').trim()
  if (!t) return null
  t = t.replace(/\s+para\s+.*$/i, '') // "para <comprador>" (sempre no fim)
  t = t.replace(/\s+por\s+.*?(?=\s+em\s+\d{2}\/\d{2}\/\d{4}|$)/i, '') // "por <agente>"
  t = t.replace(/\s+às\s+\d{1,2}h\d{0,2}(min)?/i, '')
  return t.trim() || null
}

function classeDoDebito(classe: string): 'ipva' | 'licenciamento' | 'seguro' | 'multa' {
  const c = classe.toLowerCase()
  if (/\bipva\b/.test(c)) return 'ipva'
  if (/licenciamento/.test(c)) return 'licenciamento'
  if (/dpvat|seguro|taxa/.test(c)) return 'seguro'
  return 'multa'
}

/**
 * Modela o data[0] do DETRAN-SC no MESMO shape normalizado do SP (a secao
 * "Multas e débitos" do relatorio consome os dois). SC nao traz vistorias/km.
 * `hoje` injetavel pra teste deterministico.
 */
export function parsearDetranSc(data: any, hoje: Date = new Date()) {
  const d = data || {}
  const veic = d.dados_do_veiculo || {}
  const debitos: any[] = Array.isArray(d.debitos?.debitos) ? d.debitos.debitos : []
  const valorDebito = (x: any) => moeda(x?.normalizado_valor_atual ?? x?.valor_atual ?? x?.normalizado_valor_nominal ?? x?.valor_nominal)
  const hojeTs = hoje.getTime()

  const porClasse = { ipva: [] as any[], licenciamento: [] as any[], seguro: [] as any[], multa: [] as any[] }
  for (const x of debitos) porClasse[classeDoDebito(String(x?.classe || ''))].push(x)
  const soma = (l: any[]) => l.reduce((acc, x) => acc + valorDebito(x), 0)

  // Multas em aberto (multas[]), com o vencimento do debito que carrega o auto.
  const multasArr: any[] = Array.isArray(d.multas) ? d.multas : []
  const itens: DetranMulta[] = multasArr.map((m: any) => {
    const { data: dataInfracao, hora } = dataHoraBr(m?.local_data_hora_multa)
    const auto = m?.num_auto ? String(m.num_auto) : null
    const deb = auto ? porClasse.multa.find((x) => String(x?.classe || '').includes(auto)) : null
    return {
      auto,
      descricao: m?.descricao ?? null,
      dataInfracao,
      horaInfracao: hora,
      dataVencimento: deb?.vencimento ?? null,
      valor: moeda(m?.valor_multa),
      local: m?.local_complemento ?? null,
      municipio: null,
      orgao: null,
    }
  })
  const multasTotal = soma(porClasse.multa) || itens.reduce((acc, i) => acc + i.valor, 0)

  // Licenciamento atrasado: so quando ha debito de licenciamento JA vencido (o
  // calendario de SC e por placa; um exercicio anterior sozinho nao prova atraso),
  // ou quando o ultimo licenciado ficou 2+ anos pra tras.
  const licenciadoAno = anoDoExercicio(veic.licenciado)
  const licVencido = porClasse.licenciamento.some((x) => { const t = tsData(x?.vencimento); return t > 0 && t < hojeTs })
  const anoAtual = hoje.getFullYear()
  const licAtrasadoAno = licenciadoAno != null && (licVencido || licenciadoAno <= anoAtual - 2) ? licenciadoAno : null
  const licVenc = porClasse.licenciamento.map((x) => x?.vencimento).filter(Boolean).sort((a: string, b: string) => tsData(a) - tsData(b))[0] || null

  const restricoes: { tipo: string; texto: string }[] = []
  const r = veic.restricoes
  for (const t of (Array.isArray(r) ? r : [r])) { const v = restricaoConsta(t); if (v) restricoes.push({ tipo: 'administrativa', texto: v }) }
  const venda = String(veic.restricao_venda ?? '').trim()
  if (venda && !/^sem\s+(gravame|restri)/i.test(venda) && restricaoConsta(venda)) restricoes.push({ tipo: 'financeira', texto: venda })
  for (const t of (Array.isArray(veic.pendencias_financeiras_sng) ? veic.pendencias_financeiras_sng : [])) {
    const v = limparTextoSng(t); if (v) restricoes.push({ tipo: 'sng', texto: v })
  }
  const situacao = String(veic.situacao ?? '').trim()
  if (situacao && !/em\s+circula/i.test(situacao)) restricoes.push({ tipo: 'situacao', texto: situacao })
  const divida: any[] = Array.isArray(d.divida_ativa) ? d.divida_ativa : []
  if (divida.length) restricoes.push({ tipo: 'divida_ativa', texto: `Consta dívida ativa (${divida.length} ${divida.length === 1 ? 'registro' : 'registros'})` })

  // Infracoes JA notificadas/pagas (historico_infracoes_notificadas) e recursos
  // NAO entram (credenciamento SERPRO, 01/out): so infracao em aberto.

  return {
    status: 'ok' as const,
    fonte: 'detran_sc',
    multas_total_centavos: Math.round(multasTotal * 100),
    licenciamento_centavos: Math.round(soma(porClasse.licenciamento) * 100),
    licenciamento_venc: brParaIso(licVenc),
    ipva_total_centavos: Math.round(soma(porClasse.ipva) * 100),
    // IPVA discriminado: "IPVA (Cota Unica) 2026" -> ano, vencimento, valor.
    ipva_itens: ordenarIpva(porClasse.ipva.map(ipvaItemGenerico).filter(Boolean) as IpvaItem[]),
    hodometro: [] as { data: string | null; km: number }[],
    hodometro_suspeito: false,
    multas_itens: itens,
    licenciamento_atrasado_ano: licAtrasadoAno,
    ultimo_licenciamento_ano: licenciadoAno,
    restricoes_detran: restricoes,
  }
}

// ---------- DETRAN-MG (/detran/mg/multas-descritivos) ----------
//
// Whitelist igual ao SC. NUNCA grava html_url das multas,
// impedimentos_e_restricoes_url nem site_receipt: sao links temporarios do
// storage do Infosimples (e podem carregar dado pessoal).

function anoDe(s: any): number | null {
  const m = String(s ?? '').match(/(19|20)\d{2}/)
  return m ? Number(m[0]) : null
}

/**
 * Modela o data[0] do DETRAN-MG no shape normalizado. MG nao traz valor de IPVA
 * nem de licenciamento (so o ANO pago/licenciado) nem km. ROUBO/FURTO em
 * impedimentos_e_restricoes vira alerta (texto literal do DETRAN-MG, sem afirmar
 * que o carro e roubado).
 */
export function parsearDetranMg(data: any, hoje: Date = new Date()) {
  const d = data || {}
  const anoAtual = hoje.getFullYear()
  const texto = (v: any) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t || null }

  const multasArr: any[] = Array.isArray(d.multas) ? d.multas : []
  const itens: DetranMulta[] = multasArr.map((m: any) => ({
    auto: texto(m?.ait),
    descricao: texto(m?.descricao),
    dataInfracao: texto(m?.data),
    horaInfracao: texto(m?.hora),
    dataVencimento: null,
    valor: typeof m?.normalizado_valor === 'number' ? m.normalizado_valor : moeda(m?.valor),
    local: texto(m?.local),
    municipio: texto(m?.municipio),
    orgao: texto(m?.orgao),
  }))
  const multasTotal = itens.reduce((acc, i) => acc + i.valor, 0)

  // Licenciamento: so o ano ("VEICULO LICENCIADO PARA O ANO 2024" / data 3/4/2024).
  // Sem debito vencido conhecido, atrasado = exercicio <= ano atual - 2.
  const licAno = anoDe(d.situacao_licenciamento) ?? anoDe(d.data_licenciamento)
  const licAtrasadoAno = licAno != null && licAno <= anoAtual - 2 ? licAno : null

  const restricoes: { tipo: string; texto: string }[] = []
  const imped = texto(d.impedimentos_e_restricoes)
  const rouboFurto = !!imped && /roubo|furto/i.test(imped)
  if (imped && !rouboFurto && restricaoConsta(imped)) restricoes.push({ tipo: 'administrativa', texto: imped })
  const recuperado = texto(d.mensagem_veiculo_recuperado)
  if (recuperado) restricoes.push({ tipo: 'recuperado', texto: recuperado })

  const autuacoes: any[] = Array.isArray(d.autuacoes) ? d.autuacoes : []

  return {
    status: 'ok' as const,
    fonte: 'detran_mg',
    multas_total_centavos: Math.round(multasTotal * 100),
    licenciamento_centavos: null as number | null,
    ipva_total_centavos: null as number | null,
    ipva_pago_ano: anoDe(d.ipva_pago),
    hodometro: [] as { data: string | null; km: number }[],
    hodometro_suspeito: false,
    multas_itens: itens,
    licenciamento_atrasado_ano: licAtrasadoAno,
    ultimo_licenciamento_ano: licAno,
    restricoes_detran: restricoes,
    // Destaque vermelho no bloco. Texto fixo, factual, citando a fonte.
    alerta_roubo_furto: rouboFurto ? 'Restrição informada pelo DETRAN-MG: roubo/furto' : null,
    autuacoes_em_andamento: autuacoes.length,
  }
}

// ---------- DETRAN-BA (/detran/ba/multas) ----------
//
// Whitelist: NUNCA grava `proprietario` (nome do dono), os PDFs
// (extrato_infracoes_pdf_url, extrato_infracoes_tramitacao_pdf_url) nem o
// site_receipt. BA nao traz IPVA, licenciamento nem km.

/**
 * Modela o data[0] do DETRAN-BA: infracoes[] casadas com infracoes_detalhes[]
 * (numero_controle = codigo_controle) pra AIT, vencimento e municipio;
 * infracoes_tramitacao[] = em andamento (contagem).
 */
export function parsearDetranBa(data: any) {
  const d = data || {}
  const texto = (v: any) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t || null }
  const detalhes: any[] = Array.isArray(d.infracoes_detalhes) ? d.infracoes_detalhes : []
  const porControle = new Map(detalhes.map((x: any) => [String(x?.codigo_controle ?? ''), x]))

  const infracoes: any[] = Array.isArray(d.infracoes) ? d.infracoes : []
  const itens: DetranMulta[] = infracoes.map((m: any) => {
    const det: any = porControle.get(String(m?.numero_controle ?? '')) || {}
    return {
      auto: texto(det.ait),
      descricao: texto(m?.descricao) || texto(det.descricao),
      dataInfracao: texto(m?.data) || texto(det.data_hora_infracao),
      horaInfracao: null,
      dataVencimento: texto(det.data_vencimento),
      valor: typeof m?.normalizado_valor === 'number' ? m.normalizado_valor : moeda(m?.valor),
      local: texto(m?.local) || texto(det.local),
      municipio: texto(det.municipio),
      orgao: texto(m?.orgao_autuador) || texto(det.orgao_autuador),
    }
  })
  const tramitacao: any[] = Array.isArray(d.infracoes_tramitacao) ? d.infracoes_tramitacao : []

  return {
    status: 'ok' as const,
    fonte: 'detran_ba',
    multas_total_centavos: Math.round(itens.reduce((acc, i) => acc + i.valor, 0) * 100),
    licenciamento_centavos: null as number | null,
    ipva_total_centavos: null as number | null,
    hodometro: [] as { data: string | null; km: number }[],
    hodometro_suspeito: false,
    multas_itens: itens,
    licenciamento_atrasado_ano: null as number | null,
    restricoes_detran: [] as { tipo: string; texto: string }[],
    autuacoes_em_andamento: tramitacao.length,
  }
}

/**
 * Complemento do BA (/detran/ba/licenciamento): taxas de licenciamento e IPVA
 * em aberto. Fonte: `valores_atualizados` (um item por exercicio, valor ja
 * atualizado) e, se faltar, o "Licenciamento atual"/"IPVA atual" de
 * `licenciamento[]`. Multas ficam com o /multas (que traz o auto de cada uma).
 * Whitelist: nunca grava proprietario, html_url nem site_receipt.
 */
export interface ComplementoDetran {
  licenciamento_centavos: number | null
  licenciamento_atrasado_ano: number | null
  licenciamento_exercicios: { ano: number; centavos: number }[]
  ipva_total_centavos: number | null
  /** IPVA sem multa/juros, quando a fonte separa (RS). */
  ipva_original_centavos?: number | null
  /** Multas com juros/correcao, como o DETRAN cobra hoje (BA). */
  multas_atualizado_centavos?: number | null
  /** Total a pagar segundo o proprio DETRAN (BA). Vira o "Para regularizar". */
  total_detran_centavos?: number | null
}

export function parsearLicenciamentoBa(data: any, hoje: Date = new Date()): ComplementoDetran | null {
  const d = data || {}
  const atualizados: any[] = Array.isArray(d.valores_atualizados) ? d.valores_atualizados : []
  const resumo: any[] = Array.isArray(d.licenciamento) ? d.licenciamento : []
  if (!atualizados.length && !resumo.length) return null
  const valor = (x: any) => (typeof x?.normalizado_valor === 'number' ? x.normalizado_valor : moeda(x?.valor))
  const centavos = (v: number) => Math.round(v * 100)

  const exercicios = atualizados
    .filter((x) => /licenciamento/i.test(String(x?.descricao ?? '')) && valor(x) > 0)
    .map((x) => ({ ano: Number(String(x?.ano_referencia ?? '').trim()) || 0, centavos: centavos(valor(x)) }))
    .filter((x) => x.ano > 1900)
    .sort((a, b) => a.ano - b.ano)
  const ipvaAtualizados = atualizados.filter((x) => /ipva/i.test(String(x?.descricao ?? '')) && valor(x) > 0)

  const doResumo = (re: RegExp) => resumo.find((x) => re.test(String(x?.descricao ?? '')))
  let licCent = exercicios.reduce((a, x) => a + x.centavos, 0)
  if (!exercicios.length) {
    const atual = doResumo(/^licenciamento/i)
    licCent = atual ? centavos(valor(atual)) : 0
  }
  let ipvaCent = ipvaAtualizados.reduce((a, x) => a + centavos(valor(x)), 0)
  if (!ipvaAtualizados.length) {
    const ipva = doResumo(/^ipva/i)
    ipvaCent = ipva ? centavos(valor(ipva)) : 0
  }
  // Exercicio anterior ao corrente ainda em aberto = licenciamento atrasado.
  // O relatorio le licenciamento_atrasado_ano como "ultimo exercicio
  // licenciado": e o ano ANTES do primeiro em aberto.
  const atrasados = exercicios.filter((x) => x.ano < hoje.getFullYear())
  // Multas atualizadas (com juros) e o total do proprio DETRAN: o relatorio
  // nao pode somar o valor original e dizer um total menor do que o DETRAN cobra.
  const multasAtualizadas = atualizados.filter((x) => /multa/i.test(String(x?.descricao ?? '')) && valor(x) > 0)
  const totalDetran = atualizados.find((x) => /valor total/i.test(String(x?.descricao ?? '')))
  return {
    licenciamento_centavos: licCent,
    licenciamento_atrasado_ano: atrasados.length ? atrasados[0].ano - 1 : null,
    licenciamento_exercicios: exercicios,
    ipva_total_centavos: ipvaCent,
    multas_atualizado_centavos: multasAtualizadas.length ? multasAtualizadas.reduce((a, x) => a + centavos(valor(x)), 0) : null,
    total_detran_centavos: totalDetran && valor(totalDetran) > 0 ? centavos(valor(totalDetran)) : null,
  }
}

/**
 * Complemento do RS (/detran/rs/veiculo, e-CNPJ, placa + renavam, R$0,28;
 * teste IWC7G10, 09/out): IPVA por exercicio (pendente com multa e juros) e
 * licenciamento (ultimo exercicio e validade). Multas seguem do /infracoes.
 * Whitelist: nunca grava proprietario, nome em restricoes nem site_receipt.
 */
export function parsearVeiculoRs(data: any, hoje: Date = new Date()): ComplementoDetran | null {
  const d = data || {}
  const ipvas: any[] = Array.isArray(d.ipva) ? d.ipva : []
  if (!ipvas.length && d.exercicio_ultimo_licenciamento == null && !d.licenciamento_valido_ate) return null
  const centavos = (v: any) => Math.round((typeof v === 'number' ? v : moeda(v)) * 100)
  const pendentes = ipvas.filter((x) => /pendente|d[ií]vida ativa(?!.*(liquidad|conclu))/i.test(String(x?.situacao ?? '')))
  const atualizado = (x: any) => {
    const deb: any[] = Array.isArray(x?.debitos) ? x.debitos : []
    const comJuros = deb.reduce((a, y) => a + centavos(y?.valor_total_com_desconto ?? y?.valor ?? 0), 0)
    return comJuros > 0 ? comJuros : centavos(x?.valor)
  }
  const ipvaAtual = pendentes.reduce((a, x) => a + atualizado(x), 0)
  const ipvaOriginal = pendentes.reduce((a, x) => a + centavos(x?.valor), 0)

  const validoAte = tsData(d.licenciamento_valido_ate)
  const ultimo = Number(d.exercicio_ultimo_licenciamento) || null
  const vencido = validoAte > 0 && validoAte < hoje.getTime()
  return {
    licenciamento_centavos: vencido ? centavos(d.valor_licenciamento) : 0,
    licenciamento_atrasado_ano: vencido ? ultimo : null,
    licenciamento_exercicios: [],
    ipva_total_centavos: ipvaAtual,
    ipva_original_centavos: ipvaOriginal !== ipvaAtual ? ipvaOriginal : null,
  }
}

/** Parser do complemento por UF. */
function parsearComplemento(uf: UfDetran, data: any): ComplementoDetran | null {
  if (uf === 'BA') return parsearLicenciamentoBa(data)
  if (uf === 'RS') return parsearVeiculoRs(data)
  return null
}

/** Junta o complemento (licenciamento/IPVA) ao bloco de multas da UF. */
export function juntarComplemento(bloco: any, comp: ComplementoDetran | null): any {
  if (!comp) return bloco
  const out: any = {
    ...bloco,
    licenciamento_centavos: comp.licenciamento_centavos,
    licenciamento_atrasado_ano: comp.licenciamento_atrasado_ano,
    licenciamento_exercicios: comp.licenciamento_exercicios,
    ipva_total_centavos: comp.ipva_total_centavos,
    complemento_ok: true,
  }
  if (comp.ipva_original_centavos != null) out.ipva_original_centavos = comp.ipva_original_centavos
  // Atualizado so vale se for MAIOR que o original das multas (senao e outra coisa).
  if (comp.multas_atualizado_centavos != null && comp.multas_atualizado_centavos > (bloco?.multas_total_centavos ?? 0)) {
    out.multas_atualizado_centavos = comp.multas_atualizado_centavos
  }
  if (comp.total_detran_centavos != null) out.total_detran_centavos = comp.total_detran_centavos
  return out
}

// ---------- DETRAN-RS (/detran/rs/infracoes) ----------
//
// Whitelist: NUNCA grava notificacao_autuacao_url, guia_pagamento_url nem
// site_receipt. RS nao traz IPVA, licenciamento nem km nesse endpoint.

/**
 * Em aberto = situacao diferente de "Paga" (vencida, a vencer, em notificacao),
 * exceto a linha sem situacao e sem valor. As pagas sao DESCARTADAS (nem contagem). O vencimento sai do
 * texto "Vencida em DD/MM/AAAA" / "Vence em DD/MM/AAAA".
 */
export function parsearDetranRs(data: any) {
  const d = data || {}
  const texto = (v: any) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t || null }
  const todas: any[] = Array.isArray(d.infracoes) ? d.infracoes : []
  const paga = (x: any) => /^paga$/i.test(String(x?.situacao ?? '').trim())
  // Sem situacao E com valor zero (visto no IWC7G10 real) nao e debito: seria
  // uma "multa em aberto" de R$ 0,00. E descartada.
  const valorDe = (x: any) => (typeof x?.valor_normalizado === 'number' ? x.valor_normalizado : moeda(x?.valor))
  const semNada = (x: any) => !String(x?.situacao ?? '').trim() && !(valorDe(x) > 0)
  const abertas = todas.filter((x) => !paga(x) && !semNada(x))

  const itens: DetranMulta[] = abertas.map((m: any) => ({
    auto: texto(m?.serie),
    descricao: texto(m?.descricao),
    dataInfracao: texto(m?.data),
    horaInfracao: texto(m?.hora),
    dataVencimento: (String(m?.situacao ?? '').match(/(\d{2}\/\d{2}\/\d{4})/) || [])[1] ?? null,
    valor: typeof m?.valor_normalizado === 'number' ? m.valor_normalizado : moeda(m?.valor),
    local: texto(m?.local),
    municipio: null,
    orgao: null,
  }))

  return {
    status: 'ok' as const,
    fonte: 'detran_rs',
    multas_total_centavos: Math.round(itens.reduce((acc, i) => acc + i.valor, 0) * 100),
    licenciamento_centavos: null as number | null,
    ipva_total_centavos: null as number | null,
    hodometro: [] as { data: string | null; km: number }[],
    hodometro_suspeito: false,
    multas_itens: itens,
    licenciamento_atrasado_ano: null as number | null,
    restricoes_detran: [] as { tipo: string; texto: string }[],
  }
}

// ---------- DETRAN-GO (/detran/go/debitos) ----------
//
// Whitelist: NUNCA grava boleto_pdf_url, ait_pdf_url, codigo_barras,
// responsavel_infracao nem site_receipt. GO nao traz km.

/** Grupos de infracao que contam como EM ABERTO (somam no total). */
const GO_ABERTAS = ['vencidas', 'nao_vencida', 'notificada', 'nao_notificada', 'parcelada'] as const

/**
 * Modela o data[0] do DETRAN-GO no shape normalizado.
 * - infracoes: em aberto = vencidas + nao_vencida + notificada + nao_notificada
 *   + parcelada; sob_juice = em recurso (lista a parte, nao soma); sne fica fora.
 * - debitos_veiculo[] (um por exercicio, ano = ano do data_vencimento):
 *   ipva_valor numerico = IPVA em aberto no DETRAN; "DEBITO NA SEFAZ" = IPVA em
 *   aberto na SEFAZ-GO (valor_original_ipva, sem juros), listado por ano.
 *   licenciamento numerico = debito; "PAGO" = exercicio licenciado.
 */
export function parsearDetranGo(data: any, hoje: Date = new Date()) {
  const d = data || {}
  const texto = (v: any) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t || null }
  const inf = d.infracoes && typeof d.infracoes === 'object' ? d.infracoes : {}
  const lista = (k: string): any[] => (Array.isArray(inf[k]) ? inf[k] : [])
  const valorDe = (m: any) => (typeof m?.valor === 'number' ? m.valor : moeda(m?.valor))
  const item = (m: any) => ({
    auto: texto(m?.ait),
    descricao: texto(m?.infracao_descricao),
    dataInfracao: texto(m?.data_infracao),
    horaInfracao: texto(m?.hora_infracao),
    dataVencimento: texto(m?.data_vencimento),
    valor: valorDe(m),
    local: texto(m?.local_infracao),
    municipio: null,
    orgao: texto(m?.orgao_atuador),
  })
  const itens = GO_ABERTAS.flatMap((k) => lista(k)).map(item)
  const emRecurso = lista('sob_juice').map(item)

  // Debitos por exercicio. "----", "PAGO", "ISENTO", "NAO SE APLICA" nao sao valor.
  const debitos: any[] = Array.isArray(d.debitos_veiculo) ? d.debitos_veiculo : []
  const ehValor = (v: any) => /\d/.test(String(v ?? '')) && moeda(v) > 0
  const anoVenc = (x: any) => anoDe(x?.data_vencimento)
  const ipvaDetranItens: IpvaItem[] = []
  let licDebito = 0
  let licVenc: string | null = null
  let licVencido = false
  let ultimoLicAno: number | null = null
  const ipvaSefaz: IpvaItem[] = []
  for (const x of debitos) {
    const ano = anoVenc(x)
    const venc = texto(x?.data_vencimento)
    if (ehValor(x?.ipva_valor)) ipvaDetranItens.push({ ano, vencimento: venc, valor_centavos: Math.round(moeda(x.ipva_valor) * 100) })
    else if (/sefaz/i.test(String(x?.ipva_valor ?? ''))) {
      ipvaSefaz.push({ ano, vencimento: venc, valor_centavos: Math.round(moeda(x?.valor_original_ipva) * 100) })
    }
    if (ehValor(x?.licenciamento)) {
      licDebito += moeda(x.licenciamento)
      if (venc && (!licVenc || tsData(venc) < tsData(licVenc))) licVenc = venc
      const t = tsData(venc)
      if (t > 0 && t < hoje.getTime()) licVencido = true
    } else if (/^pago$/i.test(String(x?.licenciamento ?? '').trim()) && ano != null) {
      ultimoLicAno = ultimoLicAno == null ? ano : Math.max(ultimoLicAno, ano)
    }
  }
  ordenarIpva(ipvaSefaz); ordenarIpva(ipvaDetranItens)
  const ipvaCentavos = [...ipvaDetranItens, ...ipvaSefaz].reduce((a, x) => a + x.valor_centavos, 0)

  const restricoes: { tipo: string; texto: string }[] = []
  const conta = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
  const divida: any[] = Array.isArray(d.divida_ativa) ? d.divida_ativa : []
  if (divida.length) restricoes.push({ tipo: 'divida_ativa', texto: `Consta dívida ativa (${conta(divida.length, 'registro', 'registros')})` })
  const outros: any[] = Array.isArray(d.outros_debitos) ? d.outros_debitos : []
  if (outros.length) restricoes.push({ tipo: 'outros_debitos', texto: `Consta(m) outros débitos no DETRAN-GO (${conta(outros.length, 'registro', 'registros')})` })
  const licNotif: any[] = Array.isArray(d.licenciamento_notificado) ? d.licenciamento_notificado : []
  if (licNotif.length) restricoes.push({ tipo: 'licenciamento_notificado', texto: `Licenciamento notificado pelo DETRAN-GO (${conta(licNotif.length, 'registro', 'registros')})` })

  return {
    status: 'ok' as const,
    fonte: 'detran_go',
    multas_total_centavos: Math.round(itens.reduce((acc, i) => acc + i.valor, 0) * 100),
    licenciamento_centavos: Math.round(licDebito * 100),
    licenciamento_venc: brParaIso(licVenc),
    ipva_total_centavos: ipvaCentavos,
    // IPVA em aberto no DETRAN, por exercicio.
    ipva_itens: ipvaDetranItens,
    // IPVA em aberto na SEFAZ-GO por exercicio (valor original, sem juros).
    ipva_sefaz: ipvaSefaz,
    hodometro: [] as { data: string | null; km: number }[],
    hodometro_suspeito: false,
    multas_itens: itens,
    multas_em_recurso: emRecurso,
    licenciamento_atrasado_ano: licVencido ? ultimoLicAno : null,
    ultimo_licenciamento_ano: ultimoLicAno,
    restricoes_detran: restricoes,
  }
}

// ---------- DETRAN-PR (/detran/pr/multas-descritivos) ----------
//
// data[] = uma multa por item (NAO data[0]). Whitelist: NUNCA grava html_url,
// guia_pagamento_url, codigo_barras, numero_documento_rec nem site_receipt.
// PR nao traz IPVA, licenciamento nem km nesse endpoint.

/** "12h08" -> "12:08" (a UI corta em 5 caracteres e ignora "00:00"). */
function horaHhMm(s: any): string | null {
  const m = String(s ?? '').match(/(\d{1,2})\s*[h:]\s*(\d{2})/i)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

/**
 * Em aberto = tipo diferente de "multa-paga" (soma no total). As pagas sao
 * DESCARTADAS: nao sao exibidas, guardadas nem contadas (credenciamento SERPRO).
 */
export function parsearDetranPr(lista: any) {
  const todas: any[] = Array.isArray(lista) ? lista.filter((x) => x && typeof x === 'object') : []
  const texto = (v: any) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t || null }
  const paga = (x: any) => /paga/i.test(String(x?.tipo ?? ''))
  const abertas = todas.filter((x) => !paga(x))

  const itens: DetranMulta[] = abertas.map((m: any) => ({
    auto: texto(m?.ait) || texto(m?.auto),
    // "60412 - Executar ..." -> sem o codigo do enquadramento na frente.
    descricao: texto(String(m?.descricao ?? '').replace(/^\s*\d+\s*-\s*/, '')),
    dataInfracao: texto(m?.data),
    horaInfracao: horaHhMm(m?.hora),
    dataVencimento: texto(m?.vencimento),
    valor: typeof m?.normalizado_valor === 'number' ? m.normalizado_valor : moeda(m?.valor),
    local: texto(m?.local),
    municipio: null,
    orgao: texto(m?.orgao),
  }))

  return {
    status: 'ok' as const,
    fonte: 'detran_pr',
    multas_total_centavos: Math.round(itens.reduce((acc, i) => acc + i.valor, 0) * 100),
    licenciamento_centavos: null as number | null,
    ipva_total_centavos: null as number | null,
    hodometro: [] as { data: string | null; km: number }[],
    hodometro_suspeito: false,
    multas_itens: itens,
    licenciamento_atrasado_ano: null as number | null,
    restricoes_detran: [] as { tipo: string; texto: string }[],
  }
}

// ---------- DETRAN-DF (/detran/df/debitos) ----------
//
// Whitelist: NUNCA grava responsavel_infracao, codigo_renainf, os dados do
// veiculo (so o ano do ultimo licenciamento e a situacao) nem site_receipt.

/**
 * data[0].debitos: infracoes_veiculo[] (em aberto; valor_corrigido no total),
 * licenciamentos[]/total_licenciamento, ipva[]; DPVAT, utilizacao anual,
 * servicos do DETRAN e parcelamento viram "outros debitos" com o valor.
 */
export function parsearDetranDf(data: any, hoje: Date = new Date()) {
  const d = data || {}
  const deb = d.debitos && typeof d.debitos === 'object' ? d.debitos : {}
  const veic = d.veiculo && typeof d.veiculo === 'object' ? d.veiculo : {}
  const texto = (v: any) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t || null }
  const num = (v: any) => (typeof v === 'number' ? (Number.isFinite(v) ? v : 0) : moeda(v))

  const infr: any[] = Array.isArray(deb.infracoes_veiculo) ? deb.infracoes_veiculo : []
  const itens = infr.map((m: any) => {
    const corrigido = num(m?.valor_corrigido)
    return {
      auto: texto(m?.numero_auto),
      descricao: texto(m?.desc_infracao),
      dataInfracao: texto(m?.data_infracao),
      horaInfracao: horaHhMm(m?.hora_infracao),
      dataVencimento: texto(m?.data_vencimento),
      valor: corrigido > 0 ? corrigido : num(m?.valor),
      local: texto(m?.local_multa),
      municipio: null,
      orgao: texto(m?.orgao_autuador),
    }
  })

  // IPVA por exercicio (shape defensivo: sem exemplo real com IPVA ainda).
  const ipvaItens = ordenarIpva((Array.isArray(deb.ipva) ? deb.ipva : []).map(ipvaItemGenerico).filter(Boolean) as IpvaItem[])

  // Licenciamento: total_licenciamento (ou soma dos itens). Atrasado com
  // debito ja vencido, ou com o ultimo licenciado 2+ anos pra tras.
  const licArr: any[] = Array.isArray(deb.licenciamentos) ? deb.licenciamentos : []
  const licItens = licArr.map(ipvaItemGenerico).filter(Boolean) as IpvaItem[]
  const licTotal = num(deb.total_licenciamento) || licItens.reduce((a, x) => a + x.valor_centavos, 0) / 100
  const licVencs = licItens.map((x) => x.vencimento).filter(Boolean) as string[]
  const licVenc = licVencs.sort((a, b) => tsData(a) - tsData(b))[0] || null
  const licVencido = licVencs.some((v) => { const t = tsData(v); return t > 0 && t < hoje.getTime() })
  const ultimoLicAno = anoDe(veic.ano_ultimo_licenciamento)
  const anoAtual = hoje.getFullYear()
  const licAtrasadoAno = ultimoLicAno != null && (licVencido || ultimoLicAno <= anoAtual - 2) ? ultimoLicAno : null

  const restricoes: { tipo: string; texto: string }[] = []
  const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const outros: [string, any][] = [
    ['DPVAT em aberto', deb.total_dpvat],
    ['Taxa de utilização anual em aberto', deb.total_utilizacao_anual],
    ['Serviços do DETRAN-DF em aberto', deb.total_servicos_detran],
    ['Parcelamento em aberto no DETRAN-DF', deb.total_devido_parcelamento],
  ]
  for (const [rotulo, v] of outros) { const n = num(v); if (n > 0) restricoes.push({ tipo: 'outros_debitos', texto: `${rotulo}: ${brl(n)}` }) }
  const situacao = texto(veic.desc_situacao)
  if (situacao && !/em\s+circula/i.test(situacao)) restricoes.push({ tipo: 'situacao', texto: situacao })

  return {
    status: 'ok' as const,
    fonte: 'detran_df',
    multas_total_centavos: Math.round(itens.reduce((acc, i) => acc + i.valor, 0) * 100),
    licenciamento_centavos: Math.round(licTotal * 100),
    licenciamento_venc: brParaIso(licVenc),
    ipva_total_centavos: ipvaItens.reduce((a, x) => a + x.valor_centavos, 0),
    ipva_itens: ipvaItens,
    hodometro: [] as { data: string | null; km: number }[],
    hodometro_suspeito: false,
    multas_itens: itens,
    licenciamento_atrasado_ano: licAtrasadoAno,
    ultimo_licenciamento_ano: ultimoLicAno,
    restricoes_detran: restricoes,
  }
}

// ---------- Multa generica (CE, PA, AM) ----------
//
// Shape defensivo: PA e AM vieram sem item no teste. Pega o campo pelo nome
// que aparecer (whitelist: so texto/valor, nunca objeto cru, PDF, Pix ou boleto).

const primeiro = (m: any, ks: string[]) => ks.map((k) => m?.[k]).find((v) => v != null && String(v).trim() !== '' && String(v).trim() !== '--')

export function multaGenerica(m: any) {
  const texto = (v: any) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t && t !== '--' ? t : null }
  const dataBruta = String(primeiro(m, ['data_infracao', 'data', 'data_hora_infracao', 'data_hora', 'datahora']) ?? '')
  const { data: dataInfracao, hora } = dataHoraBr(dataBruta)
  const vencBruto = String(primeiro(m, ['data_vencimento', 'vencimento', 'vencimento_penalidade', 'vencimento_boleto']) ?? '')
  const valorBruto = primeiro(m, ['normalizado_valor', 'valor_normalizado', 'normalizado_valor_atual', 'valor_corrigido', 'valor_atual', 'valor', 'normalizado_valor_original', 'valor_original'])
  return {
    auto: texto(primeiro(m, ['ait', 'auto', 'auto_infracao', 'numero_auto', 'numero_ait', 'serie', 'infracao_numero', 'numero_autuacao'])),
    descricao: texto(primeiro(m, ['descricao', 'dados_infracao', 'infracao_descricao', 'desc_infracao', 'descricao_infracao', 'infracao', 'enquadramento'])),
    dataInfracao,
    horaInfracao: horaHhMm(primeiro(m, ['hora_infracao', 'hora'])) || hora,
    dataVencimento: vencBruto.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] ?? null,
    valor: typeof valorBruto === 'number' ? valorBruto : moeda(valorBruto),
    local: texto(primeiro(m, ['local', 'local_infracao', 'local_multa'])),
    municipio: texto(primeiro(m, ['municipio', 'municipio_infracao'])),
    orgao: texto(primeiro(m, ['orgao', 'orgao_autuador', 'orgao_atuador', 'autuador'])),
  }
}

function blocoSoMultas(fonte: string, itens: ReturnType<typeof multaGenerica>[], extra: Record<string, any> = {}) {
  return {
    status: 'ok' as const,
    fonte,
    multas_total_centavos: Math.round(itens.reduce((acc, i) => acc + i.valor, 0) * 100),
    licenciamento_centavos: null as number | null,
    ipva_total_centavos: null as number | null,
    hodometro: [] as { data: string | null; km: number }[],
    hodometro_suspeito: false,
    multas_itens: itens,
    licenciamento_atrasado_ano: null as number | null,
    restricoes_detran: [] as { tipo: string; texto: string }[],
    ...extra,
  }
}

const listaDe = (v: any): any[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [])

/** DETRAN-CE (/detran/ce/multas): total = soma de normalizado_valor (com juros). Sem codigo_pix, boleto nem site_receipt. */
export function parsearDetranCe(data: any) {
  const d = data || {}
  const itens = listaDe(d.multas).map(multaGenerica)
  const judice = listaDe(d.multas_judice).map(multaGenerica)
  return blocoSoMultas('detran_ce', itens, { multas_em_recurso: judice })
}

/** DETRAN-PA (/detran/pa/infracoes): a vencer + vencidas somam; efeito suspensivo = em recurso. */
export function parsearDetranPa(data: any) {
  const d = data || {}
  const itens = [...listaDe(d.infracoes_vencidas), ...listaDe(d.infracoes_a_vencer)].map(multaGenerica)
  const susp = listaDe(d.infracoes_efeito_suspensivo).map(multaGenerica)
  return blocoSoMultas('detran_pa', itens, { multas_em_recurso: susp })
}

/**
 * DETRAN-AM (/detran/am/multas): o total de multas sai de debitos (DETRAN-AM +
 * outras UFs + locais) quando maior que a soma dos itens; IPVA de
 * normalizado_ipva; seguro e taxas viram outros debitos. Nunca grava `dados`
 * (proprietario/veiculo) nem boleto_pdf_url.
 */
export function parsearDetranAm(data: any) {
  const d = data || {}
  const deb = d.debitos && typeof d.debitos === 'object' ? d.debitos : {}
  const n = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : moeda(v))
  const itens = listaDe(d.multas).map(multaGenerica)
  const somaItens = itens.reduce((acc, i) => acc + i.valor, 0)
  const somaDeb = n(deb.normalizado_multas_detran_am) + n(deb.normalizado_multas_outras_ufs) + n(deb.normalizado_multas_locais)
  const ipva = n(deb.normalizado_ipva)
  const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const restricoes: { tipo: string; texto: string }[] = []
  const seguro = n(deb.normalizado_seguro_obrigatorio)
  if (seguro > 0) restricoes.push({ tipo: 'outros_debitos', texto: `Seguro obrigatório em aberto: ${brl(seguro)}` })
  const taxas = n(deb.normalizado_taxas_detran_am)
  if (taxas > 0) restricoes.push({ tipo: 'outros_debitos', texto: `Taxas do DETRAN-AM em aberto: ${brl(taxas)}` })
  return {
    ...blocoSoMultas('detran_am', itens),
    multas_total_centavos: Math.round(Math.max(somaItens, somaDeb) * 100),
    ipva_total_centavos: Math.round(ipva * 100),
    restricoes_detran: restricoes,
  }
}

// ---------- MA, AC, AL, PI, RR (06/out) ----------
//
// MA e AC testados com veiculo real (os dois sem multa); AL, PI e RR so pela
// doc. Formato que o parser nao reconhece devolve null: vira 'indisponivel' e
// so as chaves da resposta vao pro log (completarDetran), nunca valor nem nome.

/** Item "Nenhuma multa em aberto..." (so descricao): nao e multa. */
const ehLinhaDeNadaConsta = (x: any) => {
  if (!x || typeof x !== 'object') return true
  const ks = Object.keys(x).filter((k) => x[k] != null && String(x[k]).trim() !== '')
  return ks.every((k) => k === 'descricao') && /^\s*nenhum/i.test(String(x.descricao || ''))
}
const listagemDe = (v: any): any[] => listaDe(Array.isArray(v) ? v : v?.listagem).filter((x) => !ehLinhaDeNadaConsta(x))
const brlTexto = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * DETRAN-MA (/detran/ma/multas): penalidades = multas em aberto; infracoes_atuacao
 * = autuacoes em andamento; ipva por exercicio; debitos (licenciamento, taxas)
 * como outros debitos. NUNCA le dados_veiculo: informacao_financeira_sng e
 * impedimentos trazem nome de pessoa em texto livre (LGPD).
 */
export function parsearDetranMa(data: any) {
  const d = data || {}
  if (!('penalidades' in d) && !('debitos' in d)) return null
  const itens = listagemDe(d.penalidades).map(multaGenerica)
  const autuacoes = listagemDe(d.infracoes_atuacao).length
  const ipvaItens = ordenarIpva(listagemDe(d.ipva).map(ipvaItemGenerico).filter(Boolean) as IpvaItem[])
  const restricoes: { tipo: string; texto: string }[] = []
  const outros = listagemDe(d.debitos).map((x) => ({ desc: String(x.descricao || 'Débito no DETRAN-MA').replace(/\s+/g, ' ').trim(), v: ipvaItemGenerico(x)?.valor_centavos || 0 })).filter((x) => x.v > 0)
  for (const o of outros) restricoes.push({ tipo: 'outros_debitos', texto: `${o.desc.slice(0, 80)}: ${brlTexto(o.v / 100)}` })
  return {
    ...blocoSoMultas('detran_ma', itens),
    ipva_total_centavos: ipvaItens.reduce((a, x) => a + x.valor_centavos, 0),
    ipva_itens: ipvaItens,
    autuacoes_em_andamento: autuacoes,
    restricoes_detran: restricoes,
  }
}

/**
 * DETRAN-AC (/detran/ac/veiculo, login gov.br): infracoes {vencidas, a_vencer}
 * = multas em aberto; sub_judice = em recurso; notificacao_autuacao = autuacoes
 * em andamento. IPVA e licenciamento por exercicio; restricoes e roubo/furto do
 * cadastro. Sem proprietario no retorno.
 */
export function parsearDetranAc(data: any, hoje: Date = new Date()) {
  const d = data || {}
  if (!('infracoes' in d) && !('ipva' in d) && !('licenciamento' in d)) return null
  const inf = d.infracoes && typeof d.infracoes === 'object' && !Array.isArray(d.infracoes) ? d.infracoes : {}
  const itens = [...listagemDe(inf.vencidas), ...listagemDe(inf.a_vencer), ...listagemDe(inf.parceladas)].map(multaGenerica)
  const recurso = listagemDe(inf.sub_judice).map(multaGenerica)
  const ipvaItens = ordenarIpva(listagemDe(d.ipva).map(ipvaItemGenerico).filter(Boolean) as IpvaItem[])
  const licItens = listagemDe(d.licenciamento).map(ipvaItemGenerico).filter(Boolean) as IpvaItem[]
  const ultimoLicAno = anoDe(d.ano_ultimo_licenciamento)
  const restricoes: { tipo: string; texto: string }[] = []
  for (const r of (Array.isArray(d.restricoes) ? d.restricoes : [])) {
    const t = String(r ?? '').replace(/\s+/g, ' ').trim()
    if (t && !/^nada\s+consta$/i.test(t)) restricoes.push({ tipo: 'restricao', texto: t.slice(0, 120) })
  }
  const roubo = String(d.roubo_furto ?? '').trim()
  return {
    ...blocoSoMultas('detran_ac', itens, { multas_em_recurso: recurso }),
    licenciamento_centavos: licItens.reduce((a, x) => a + x.valor_centavos, 0),
    ipva_total_centavos: ipvaItens.reduce((a, x) => a + x.valor_centavos, 0),
    ipva_itens: ipvaItens,
    ultimo_licenciamento_ano: ultimoLicAno,
    licenciamento_atrasado_ano: ultimoLicAno != null && ultimoLicAno <= hoje.getFullYear() - 2 ? ultimoLicAno : null,
    autuacoes_em_andamento: listagemDe(inf.notificacao_autuacao).length,
    alerta_roubo_furto: roubo && !/nada\s+consta/i.test(roubo) ? 'Restrição informada pelo DETRAN-AC: roubo/furto' : null,
    restricoes_detran: restricoes,
  }
}

/** DETRAN-AL (/detran/al/infracoes): infracoes[] + normalizado_total. So pela doc. */
export function parsearDetranAl(data: any) {
  const d = data || {}
  if (!('infracoes' in d) && !('normalizado_total' in d) && !('total' in d)) return null
  const itens = listagemDe(d.infracoes).map(multaGenerica)
  const soma = itens.reduce((a, i) => a + i.valor, 0)
  const total = typeof d.normalizado_total === 'number' ? d.normalizado_total : moeda(d.total)
  return { ...blocoSoMultas('detran_al', itens), multas_total_centavos: Math.round(Math.max(soma, total || 0) * 100) }
}

/** DETRAN-PI (/detran/pi/multas): multas[] (status, valor_normalizado, vencimento). So pela doc. */
export function parsearDetranPi(data: any) {
  const d = data || {}
  if (!('multas' in d)) return null
  const emAberto = listagemDe(d.multas).filter((m) => !/\bpag[ao]\b|quitad/i.test(String(m.status || '')))
  return blocoSoMultas('detran_pi', emAberto.map(multaGenerica))
}

/** DETRAN-RR (/detran/rr/debitos): infracoes {detalhes_infracoes[], valor_normalizado}. So pela doc. */
export function parsearDetranRr(data: any) {
  const d = data || {}
  if (!('infracoes' in d) && !('debitos' in d)) return null
  const inf = d.infracoes && typeof d.infracoes === 'object' && !Array.isArray(d.infracoes) ? d.infracoes : {}
  const itens = listagemDe(Array.isArray(d.infracoes) ? d.infracoes : inf.detalhes_infracoes).map(multaGenerica)
  const soma = itens.reduce((a, i) => a + i.valor, 0)
  const total = typeof inf.valor_normalizado === 'number' ? inf.valor_normalizado : moeda(inf.valor)
  const roubo = String(d.roubo_furto ?? '').trim()
  return {
    ...blocoSoMultas('detran_rr', itens),
    multas_total_centavos: Math.round(Math.max(soma, total || 0) * 100),
    ultimo_licenciamento_ano: anoDe(d.ano_ultimo_licenciamento),
    alerta_roubo_furto: roubo && !/nada\s+consta/i.test(roubo) ? 'Restrição informada pelo DETRAN-RR: roubo/furto' : null,
  }
}

/** So as CHAVES de uma resposta (sem valores): pro log de formato desconhecido. */
export function estruturaChaves(o: any, prof = 0): any {
  if (prof > 3) return '…'
  if (Array.isArray(o)) return o.length ? [estruturaChaves(o[0], prof + 1)] : []
  if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o).map((k) => [k, estruturaChaves(o[k], prof + 1)]))
  return typeof o
}

// ---------- DETRAN-PE (/detran/pe/extrato-geral) ----------
//
// debitos.{ipva, licenciamento, multas, dpvat, autuacoes_tramitacao} vem como
// texto ("NADA CONSTA" quando limpo). Sem exemplo com debito ainda: lista ou
// objeto vira itens (multaGenerica); texto com valor vira valor; texto sem
// valor vira nota em restricoes. Quando algo nao e "NADA CONSTA", a resposta
// (sem URLs) vai pro log pra ajustar o parser.

const nadaConsta = (v: any) => v == null || /^\s*(nada\s+consta|n[aã]o)?\s*$/i.test(String(v)) || /^\s*nada\s+consta\b/i.test(String(v))

/** Copia sem URLs nem site_receipt (pro log). */
export function semUrls(o: any): any {
  if (Array.isArray(o)) return o.map(semUrls)
  if (o && typeof o === 'object') {
    const r: any = {}
    for (const [k, v] of Object.entries(o)) {
      if (/url|receipt|pdf|boleto|pix|codigo_barras|proprietario|cpf|cnpj|nome|aquisicao|condutor|interessado/i.test(k)) continue
      r[k] = typeof v === 'string' && /^https?:\/\//i.test(v) ? '[url]' : semUrls(v)
    }
    return r
  }
  return o
}

export function parsearDetranPe(data: any, log: (msg: string) => void = (m) => console.warn(m)) {
  const d = data || {}
  const deb = d.debitos && typeof d.debitos === 'object' ? d.debitos : {}
  const texto = (v: any) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t || null }
  const restricoes: { tipo: string; texto: string }[] = []
  let estranho = false

  // Valor de um campo-texto: numero/"R$ 1.234,56" -> reais; senao nota.
  const valorOuNota = (v: any, rotulo: string): number => {
    if (nadaConsta(v)) return 0
    estranho = true
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      const n = /\d/.test(v) ? moeda(v) : 0
      if (n > 0) return n
      const t = texto(v); if (t) restricoes.push({ tipo: 'outros_debitos', texto: `${rotulo}: ${t}` })
      return 0
    }
    if (v && typeof v === 'object') {
      const n = typeof v.normalizado_valor === 'number' ? v.normalizado_valor : moeda(v.valor ?? v.total)
      if (n > 0) return n
    }
    restricoes.push({ tipo: 'outros_debitos', texto: `${rotulo}: consta no DETRAN-PE` })
    return 0
  }

  // Multas: lista/objeto -> itens; texto -> valor ou nota.
  let itens: ReturnType<typeof multaGenerica>[] = []
  let multasTexto = 0
  const m = deb.multas
  if (Array.isArray(m)) { estranho = true; itens = listaDe(m).map(multaGenerica) }
  else if (m && typeof m === 'object') {
    estranho = true
    const lista = listaDe(m.multas ?? m.itens ?? m.infracoes)
    itens = (lista.length ? lista : [m]).map(multaGenerica)
  } else multasTexto = valorOuNota(m, 'Multas')
  const somaItens = itens.reduce((a, i) => a + i.valor, 0)

  const ipva = valorOuNota(deb.ipva, 'IPVA')
  const lic = valorOuNota(deb.licenciamento, 'Licenciamento')
  const dpvat = valorOuNota(deb.dpvat, 'DPVAT')
  const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (dpvat > 0) restricoes.push({ tipo: 'outros_debitos', texto: `DPVAT em aberto: ${brl(dpvat)}` })
  const autu = deb.autuacoes_tramitacao
  const autuacoes = Array.isArray(autu) ? autu.length : (nadaConsta(autu) ? 0 : 1)
  if (autuacoes) estranho = true

  if (!nadaConsta(d.baixa_gravame)) { const t = texto(d.baixa_gravame); if (t) restricoes.push({ tipo: 'financeira', texto: `Gravame: ${t}` }) }
  if (/^\s*sim\s*$/i.test(String(d.restricoes_gerais ?? ''))) restricoes.push({
    // "SIM" reflete o cadastro (ex.: alienacao fiduciaria no SENATRAN do
    // RZJ5F09), nao uma restricao administrativa: texto neutro.
    tipo: 'cadastro', texto: 'Consta restrição no cadastro do DETRAN-PE (pode ser alienação/financiamento; veja as restrições acima)',
  })
  else if (!nadaConsta(d.restricoes_gerais) && !/^\s*n[aã]o\s*$/i.test(String(d.restricoes_gerais))) {
    const t = texto(d.restricoes_gerais); if (t) restricoes.push({ tipo: 'administrativa', texto: t })
  }

  if (estranho) log('[infosimples] DETRAN-PE com debito (ajustar parser): ' + JSON.stringify(semUrls(d)))

  return {
    ...blocoSoMultas('detran_pe', itens),
    multas_total_centavos: Math.round(Math.max(somaItens, multasTexto) * 100),
    ipva_total_centavos: Math.round(ipva * 100),
    licenciamento_centavos: Math.round(lic * 100),
    restricoes_detran: restricoes,
    autuacoes_em_andamento: autuacoes,
  }
}

// ---------- DETRAN-ES (/detran/es/veiculo) ----------
//
// LGPD: a resposta traz `proprietario` e `proprietario_anterior` (NOMES),
// data_aquisicao e site_receipt. Whitelist: nada disso sai daqui, nem pro log
// (semUrls corta). multas/infracoes/debitos/recursos vieram vazios no teste:
// parser defensivo + log sem PII quando vier algo.

export function parsearDetranEs(data: any, hoje: Date = new Date(), log: (msg: string) => void = (m) => console.warn(m)) {
  const d = data || {}
  const texto = (v: any) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t || null }
  const nao = (v: any) => { const t = String(v ?? '').trim(); return !t || /^(n[aã]o|nenhum|nada\s+consta|sem\s+gravame|sem\s+restri)/i.test(t) }

  const multas = listaDe(d.multas)
  const infracoes = listaDe(d.infracoes)
  const debitos = listaDe(d.debitos)
  const recursos = listaDe(d.recursos)
  // multas[] = em aberto. infracoes[] so entra como item se multas[] vier vazio
  // (sem exemplo: evita somar a mesma multa duas vezes).
  const itens = (multas.length ? multas : infracoes).map(multaGenerica)
  const emRecurso = recursos.map(multaGenerica)

  // debitos[]: classifica pelo texto (IPVA, licenciamento, seguro/taxa, resto = multa).
  const rotuloDeb = (x: any) => String(x?.classe ?? x?.descricao ?? x?.tipo ?? x?.debito ?? '')
  const valorDeb = (x: any) => { const v = primeiro(x, ['normalizado_valor', 'normalizado_valor_atual', 'valor_atual', 'valor_total', 'valor']); return typeof v === 'number' ? v : moeda(v) }
  let ipva = 0; let lic = 0; let outros = 0; let multaDeb = 0
  const ipvaItens: IpvaItem[] = []
  let licVencido = false
  for (const x of debitos) {
    const c = classeDoDebito(rotuloDeb(x)); const v = valorDeb(x)
    if (c === 'ipva') { ipva += v; const it = ipvaItemGenerico(x); if (it) ipvaItens.push(it) }
    else if (c === 'licenciamento') {
      lic += v
      const t = tsData(String(primeiro(x, ['data_vencimento', 'vencimento']) ?? ''))
      if (t > 0 && t < hoje.getTime()) licVencido = true
    } else if (c === 'seguro') outros += v
    else multaDeb += v
  }
  const somaItens = itens.reduce((a, i) => a + i.valor, 0)

  const restricoes: { tipo: string; texto: string }[] = []
  const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (outros > 0) restricoes.push({ tipo: 'outros_debitos', texto: `Taxas/seguro em aberto no DETRAN-ES: ${brl(outros)}` })
  if (!nao(d.gravame)) restricoes.push({ tipo: 'financeira', texto: texto(d.gravame)! })
  if (!nao(d.restricoes) && texto(d.restricoes) !== texto(d.gravame)) restricoes.push({ tipo: 'administrativa', texto: texto(d.restricoes)! })
  if (!nao(d.impedimentos)) restricoes.push({ tipo: 'administrativa', texto: texto(d.impedimentos)! })
  if (!nao(d.averbacao_judicial)) restricoes.push({ tipo: 'judiciaria', texto: `Averbação judicial: ${texto(d.averbacao_judicial)}` })
  if (!nao(d.indicativo_clonagem)) restricoes.push({ tipo: 'clonagem', texto: `Indicativo de clonagem no DETRAN-ES: ${texto(d.indicativo_clonagem)}` })
  const situacao = texto(d.situacao)
  if (situacao && !/em\s+circula/i.test(situacao)) restricoes.push({ tipo: 'situacao', texto: situacao })

  const ultimoLicAno = anoDe(d.ano_ultimo_licenciamento)
  const licAtrasadoAno = ultimoLicAno != null && (licVencido || ultimoLicAno <= hoje.getFullYear() - 2) ? ultimoLicAno : null

  if (multas.length || infracoes.length || debitos.length || recursos.length || restricoes.length) {
    log('[infosimples] DETRAN-ES com debito (ajustar parser): ' + JSON.stringify(semUrls({
      multas, infracoes, debitos, recursos, gravame: d.gravame, restricoes: d.restricoes, impedimentos: d.impedimentos,
      averbacao_judicial: d.averbacao_judicial, indicativo_clonagem: d.indicativo_clonagem, situacao: d.situacao,
    })))
  }

  return {
    ...blocoSoMultas('detran_es', itens, { multas_em_recurso: emRecurso }),
    multas_total_centavos: Math.round(Math.max(somaItens, multaDeb) * 100),
    ipva_total_centavos: Math.round(ipva * 100),
    ipva_itens: ordenarIpva(ipvaItens),
    licenciamento_centavos: Math.round(lic * 100),
    licenciamento_atrasado_ano: licAtrasadoAno,
    ultimo_licenciamento_ano: ultimoLicAno,
    restricoes_detran: restricoes,
    autuacoes_em_andamento: multas.length ? infracoes.length : 0,
  }
}

// ---------- Trava do login gov.br (BA e DF, mesma conta) ----------
//
// 608 = "Usuário e/ou senha inválidos": cada tentativa conta como senha errada
// na conta gov.br do Cesar, e repetir pode BLOQUEAR a conta. No primeiro 608
// (BA OU DF, a conta e a mesma) as duas UFs param de chamar neste processo (ate restart/deploy, que e quando alguem
// corrigiu a env) e manda alerta. Sem retry automatico.
let loginBaTravadoEm: string | null = null
export function loginBaTravado(): string | null { return loginBaTravadoEm }
export function destravarLoginBa(): void { loginBaTravadoEm = null }
/** Pro modo testar do backfill: mesma trava + alerta. */
export function travarLoginBaPublico(motivo: string): void { void travarLoginBa(motivo) }

async function travarLoginBa(motivo: string): Promise<void> {
  loginBaTravadoEm = new Date().toISOString()
  console.error('[infosimples] DETRAN BA/DF: login gov.br recusado (608); BA e DF travados ate restart.', motivo)
  try {
    await sendErrorEmail({
      endpoint: '/premium/detran-ba',
      errorMessage: `DETRAN BA/DF: login gov.br recusado (608: ${motivo}). As consultas BA e DF foram TRAVADAS neste container pra nao bloquear a conta gov.br. Confira NUXT_INFOSIMPLES_BA_CPF/SENHA no Coolify e faça redeploy.`,
      paraTambem: ['cesarcbhering@gmail.com'],
    })
  } catch { /* sem e-mail (teste/dev): o log acima fica */ }
}

// ---------- Custo por pedido (pro fin somar no P&L) ----------

/** Grava o custo de UMA chamada (sucesso ou erro). Fail-open: nunca derruba nada. */
export async function registrarCusto(
  supabase: any,
  opts: { pedidoId: string | null; fonte: string; preco: number; code: number },
): Promise<void> {
  try {
    await supabase.from('premium_custos').insert({
      pedido_id: opts.pedidoId, fonte: opts.fonte, preco: opts.preco || 0, code: opts.code ?? null,
    })
  } catch (e: any) {
    console.warn('[infosimples] registrar custo falhou:', e?.message || e)
  }
}

// ---------- Orquestracao pos-entrega ----------

export type ResultadoCompletarDetran =
  | { ok: true; code: number; preco: number; multasCentavos: number; temAlgo: boolean }
  | { ok: false; pulado?: string; code?: number; preco?: number; motivo?: string }

// ---------- Saneador final (credenciamento SERPRO/Credencia, 01/out) ----------
//
// O que a Politica de Privacidade promete: da infracao em aberto do veiculo so
// saem numero do auto, data, hora, local, municipio/UF, orgao autuador, descricao, valor e
// vencimento. Nada do condutor infrator nem do proprietario, nada de pontuacao
// nem de medicao de equipamento (velocidade, etilometro), e infracao ja paga e
// descartada (nem contagem). Os parsers ja montam assim; este filtro e a
// garantia final, por LISTA DE PERMISSAO, no que vai pro snapshot.
export const CAMPOS_MULTA_PERMITIDOS = ['auto', 'descricao', 'dataInfracao', 'horaInfracao', 'local', 'municipio', 'uf', 'orgao', 'valor', 'dataVencimento'] as const

export function sanearMultaItem(m: any): Record<string, any> | null {
  if (!m || typeof m !== 'object') return null
  const out: Record<string, any> = {}
  for (const k of CAMPOS_MULTA_PERMITIDOS) if (m[k] !== undefined) out[k] = m[k]
  return out
}

/** Bloco DETRAN pronto pro snapshot: itens e recursos so com os campos permitidos, sem historico de pagas. */
export function sanearBlocoMultas<T extends Record<string, any>>(bloco: T): T {
  if (!bloco || typeof bloco !== 'object') return bloco
  const b: any = { ...bloco }
  if (Array.isArray(b.multas_itens)) b.multas_itens = b.multas_itens.map(sanearMultaItem).filter(Boolean)
  if (Array.isArray(b.multas_em_recurso)) b.multas_em_recurso = b.multas_em_recurso.map(sanearMultaItem).filter(Boolean)
  delete b.historico_infracoes
  return b
}

/** data[0] do Infosimples -> bloco normalizado da UF (o que vai pro snapshot). */
export function blocoDetranDaUf(uf: UfDetran, data: any) {
  return sanearBlocoMultas(blocoDetranDaUfBruto(uf, data))
}

function blocoDetranDaUfBruto(uf: UfDetran, data: any) {
  if (uf === 'SC') return parsearDetranSc(data)
  if (uf === 'MG') return parsearDetranMg(data)
  if (uf === 'BA') return parsearDetranBa(data)
  if (uf === 'RS') return parsearDetranRs(data)
  if (uf === 'GO') return parsearDetranGo(data)
  if (uf === 'PR') return parsearDetranPr(data)
  if (uf === 'DF') return parsearDetranDf(data)
  if (uf === 'CE') return parsearDetranCe(data)
  if (uf === 'PA') return parsearDetranPa(data)
  if (uf === 'AM') return parsearDetranAm(data)
  if (uf === 'PE') return parsearDetranPe(data)
  if (uf === 'ES') return parsearDetranEs(data)
  if (uf === 'MA') return parsearDetranMa(data)
  if (uf === 'AC') return parsearDetranAc(data)
  if (uf === 'AL') return parsearDetranAl(data)
  if (uf === 'PI') return parsearDetranPi(data)
  if (uf === 'RR') return parsearDetranRr(data)
  return detranParaMultas(parsearDetranSp(data))
}

/**
 * Nucleo awaitable: consulta o DETRAN da UF do veiculo e grava o bloco no
 * snapshot. Gated: SO veiculo registrado numa UF de DETRAN_UFS (UF do SENATRAN);
 * SP sempre, as demais so com multa RENAINF. 1 chamada por pedido (cache:
 * nao chama se o snapshot ja tem o bloco da fonte). O custo (header.price) e
 * gravado em TODA chamada, ate em erro. Usado pelo pos-entrega (fire-and-forget)
 * e pelo backfill admin (em serie).
 */
export async function completarDetran(
  supabase: any,
  pedido: { id: string; placa: string },
  ctx: { response: any; ignorarGate?: boolean; semRetry?: boolean; esperaRetryMs?: number },
): Promise<ResultadoCompletarDetran> {
  const ufBruta = ufDaResposta(ctx.response)
  const uf = ufDetranSuportada(ufBruta)
  if (!uf) return { ok: false, pulado: `uf ${ufBruta || '?'} (so ${Object.keys(DETRAN_UFS).join('/')})` }
  const cfgUf = DETRAN_UFS[uf]
  if (cfgUf.gate === 'renainf' && !ctx.ignorarGate && !temMultaRenainf(ctx.response)) {
    return { ok: false, pulado: `${uf} so com RENAINF` }
  }
  const renavam = renavamDaResposta(ctx.response)
  const chassi = chassiDaResposta(ctx.response)
  // A tela do relatorio pago ESPERA este bloco (ate ~2,5 min) quando o gate
  // vale. Todo caminho que nao vai trazer o bloco grava multas.status =
  // 'indisponivel' (sem `fonte`: o backfill por token sobrescreve depois), pra
  // a tela soltar o relatorio na hora em vez de esperar o limite.
  let indisponivel: string | null = null
  if (!renavam) indisponivel = 'sem renavam'
  else if ((cfgUf as any).exigeChassi && !chassi) indisponivel = 'sem chassi'
  else if (!infosimplesConfigurado(cfgUf.cert)) indisponivel = `infosimples nao configurado (${cfgUf.cert})`
  else if (usaLoginGovbr(cfgUf.cert) && loginBaTravado()) indisponivel = 'login gov.br travado (608)'

  if (indisponivel) {
    // NAO chama (nao custa).
    logIndisponivel(pedido.id, uf, null, indisponivel, 0)
    await marcarIndisponivel(supabase, pedido.id, uf)
    return { ok: false, pulado: indisponivel }
  }
  const snap = await lerSnapshot(supabase, pedido.id)
  if (!snap) return { ok: false, pulado: 'sem snapshot' }
  // `multas.fonte` marca que ja consultamos o Infosimples dessa UF (o
  // snapshot.multas antigo do gov.br nao tem fonte e e sobrescrito).
  // Excecao: bloco preenchido A MANO (preenchido_manual_em) e trocado pelo dado
  // oficial quando a consulta roda.
  const multasAtual = (snap as any).multas
  if (multasAtual?.fonte === cfgUf.fonte && !multasAtual?.preenchido_manual_em) {
    // Bloco de multas ja existe, mas sem o complemento (pedido de antes dele):
    // roda SO o complemento e junta. Multas nao sao consultadas de novo.
    if ((cfgUf as any).complemento && multasAtual.status === 'ok' && !multasAtual.complemento_ok) {
      const comp = await buscarComplemento(supabase, pedido.id, uf, { placa: pedido.placa, renavam: renavam! })
      if (!comp) return { ok: false, pulado: 'complemento indisponivel' }
      const atual = (await lerSnapshot(supabase, pedido.id)) || snap
      const novo = juntarComplemento((atual as any).multas, comp)
      const { error } = await supabase.from('pedidos_premium').update({ relatorio_snapshot: { ...atual, multas: novo } }).eq('id', pedido.id)
      if (error) return { ok: false, motivo: 'update: ' + error.message }
      return { ok: true, code: 200, preco: 0, multasCentavos: novo.multas_total_centavos ?? 0, temAlgo: true }
    }
    return { ok: false, pulado: `ja tem ${cfgUf.fonte}` }
  }

  const params = { uf, placa: pedido.placa, renavam: renavam!, chassi: (cfgUf as any).exigeChassi ? chassi : null }
  const t0 = Date.now()
  let res = await consultarDetranInfosimples(params)
  // Custo SEMPRE (ate em erro de parametro o Infosimples cobra).
  await registrarCusto(supabase, { pedidoId: pedido.id, fonte: cfgUf.fonteCusto, preco: res.preco, code: res.code })
  if (usaLoginGovbr(cfgUf.cert) && res.code === 608) await travarLoginBa(res.codeMessage)
  // Proprietario bloqueou a consulta: status final, sem retry (cobra a cada vez).
  // Grava com `fonte`, entao backfill e reprocesso pulam este pedido depois.
  if (ehVeiculoProtegido(res)) {
    console.warn(`[detran] protegido uf=${uf} code=620 ms=${Date.now() - t0} pedido=${String(pedido.id).slice(0, 8)}`)
    await marcarProtegido(supabase, pedido.id, uf, cfgUf.fonte)
    return { ok: false, code: res.code, preco: res.preco, motivo: 'protegido pelo proprietario' }
  }
  // 1 nova tentativa pra timeout/rede (0) e erro na origem (605/609).
  if (CODIGOS_RETRY.has(res.code) && !ctx.semRetry) {
    console.warn(`[detran] retry uf=${uf} code=${res.code} ms=${Date.now() - t0} pedido=${String(pedido.id).slice(0, 8)}`)
    await esperarMs(ctx.esperaRetryMs ?? ESPERA_RETRY_MS)
    res = await consultarDetranInfosimples(params)
    await registrarCusto(supabase, { pedidoId: pedido.id, fonte: cfgUf.fonteCusto, preco: res.preco, code: res.code })
  }

  if (res.code !== 200 || !res.data) {
    logIndisponivel(pedido.id, uf, res.code, res.codeMessage || 'sem data', Date.now() - t0)
    await marcarIndisponivel(supabase, pedido.id, uf)
    return { ok: false, code: res.code, preco: res.preco, motivo: res.codeMessage || 'sem data' }
  }
  let multas: any = blocoDetranDaUf(uf, res.data)
  if (multas && (cfgUf as any).complemento) {
    multas = juntarComplemento(multas, await buscarComplemento(supabase, pedido.id, uf, { placa: pedido.placa, renavam: renavam! }))
  }
  if (!multas) {
    // Formato que o parser nao reconhece (UF integrada so pela doc): nada de
    // valor inventado. Loga so a estrutura (chaves), sem valores nem nomes.
    console.warn(`[detran] formato-desconhecido uf=${uf} pedido=${String(pedido.id).slice(0, 8)} chaves=${JSON.stringify(estruturaChaves(res.data)).slice(0, 1500)}`)
    await marcarIndisponivel(supabase, pedido.id, uf)
    return { ok: false, code: res.code, preco: res.preco, motivo: 'formato desconhecido' }
  }
  const temAlgo = multas.multas_itens.length > 0 || multas.hodometro.length > 0 || multas.restricoes_detran.length > 0
    || !!multas.alerta_roubo_furto
    || (multas.ipva_total_centavos ?? 0) > 0 || (multas.licenciamento_centavos ?? 0) > 0 || multas.licenciamento_atrasado_ano != null
  // Grava no MESMO campo que a secao "Multas e débitos" consome (reuso da UI).
  // Rele o snapshot ANTES de gravar: a chamada pode levar ate 2 min e o recall
  // pode ter gravado no meio; espalhar o snapshot velho apagaria o recall.
  const atual = (await lerSnapshot(supabase, pedido.id)) || snap
  // Bloco preenchido a mao com MAIS multas que o oficial: fica o manual (so
  // troca se o oficial vier igual ou mais completo).
  const manual = (atual as any).multas
  if (manual?.preenchido_manual_em && (manual.multas_itens?.length || 0) > multas.multas_itens.length) {
    return { ok: false, code: res.code, preco: res.preco, motivo: 'manual mais completo, mantido' }
  }
  const { error } = await supabase
    .from('pedidos_premium')
    .update({ relatorio_snapshot: { ...atual, multas } })
    .eq('id', pedido.id)
  if (error) return { ok: false, code: res.code, preco: res.preco, motivo: 'update: ' + error.message }
  return { ok: true, code: res.code, preco: res.preco, multasCentavos: multas.multas_total_centavos, temAlgo }
}

const esperarMs = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Chamada do complemento da UF (hoje so BA: licenciamento e IPVA). Grava o
 * custo sempre. Fail-open: qualquer erro devolve null e o bloco de multas
 * segue como estava.
 */
async function buscarComplemento(
  supabase: any,
  pedidoId: string,
  uf: UfDetran,
  params: { placa: string; renavam: string },
): Promise<ComplementoDetran | null> {
  const comp: any = (DETRAN_UFS[uf] as any).complemento
  if (!comp) return null
  if (usaLoginGovbr(DETRAN_UFS[uf].cert) && loginBaTravado()) return null
  try {
    const res = await consultarDetranInfosimples({ uf, placa: params.placa, renavam: params.renavam, path: comp.path })
    await registrarCusto(supabase, { pedidoId, fonte: comp.fonteCusto, preco: res.preco, code: res.code })
    if (usaLoginGovbr(DETRAN_UFS[uf].cert) && res.code === 608) { await travarLoginBa(res.codeMessage); return null }
    if (res.code !== 200 || !res.data) {
      logIndisponivel(pedidoId, `${uf}-complemento`, res.code, res.codeMessage || 'sem data', 0)
      return null
    }
    return parsearComplemento(uf, res.data)
  } catch (e: any) {
    console.warn('[infosimples] complemento falhou:', e?.message || e)
    return null
  }
}

/** Log sem PII de UF indisponivel: so UF, codigo, motivo, tempo e o comeco do id. */
export function logIndisponivel(pedidoId: string, uf: string, code: number | null, motivo: string, ms: number): void {
  const m = String(motivo || '').replace(/[A-Z]{3}\d[A-Z0-9]\d{2}/g, '<placa>').replace(/\d{9,}/g, '<num>').slice(0, 160)
  console.warn(`[detran] indisponivel uf=${uf} code=${code ?? '-'} ms=${ms} motivo=${m} pedido=${String(pedidoId).slice(0, 8)}`)
}

async function lerSnapshot(supabase: any, pedidoId: string): Promise<Record<string, any> | null> {
  const { data } = await supabase
    .from('pedidos_premium')
    .select('relatorio_snapshot')
    .eq('id', pedidoId)
    .maybeSingle()
  const snap = data?.relatorio_snapshot
  return snap && typeof snap === 'object' ? snap : null
}

/** multas = {status:'indisponivel'} no snapshot. Nunca pisa num bloco pronto. Fail-open. */
export async function marcarIndisponivel(supabase: any, pedidoId: string, uf: string): Promise<void> {
  try {
    const snap = await lerSnapshot(supabase, pedidoId)
    if (!snap) return
    const atual = (snap as any).multas
    if (atual && (atual.status === 'ok' || atual.status === 'sem_debito')) return
    await supabase
      .from('pedidos_premium')
      .update({ relatorio_snapshot: { ...snap, multas: { status: 'indisponivel', uf } } })
      .eq('id', pedidoId)
  } catch (e: any) {
    console.warn('[infosimples] marcar indisponivel falhou:', e?.message || e)
  }
}

/** Bloco final multas = {status:'protegido'}: proprietario bloqueou a consulta. Nunca pisa num bloco pronto. */
export function blocoProtegido(uf: string, fonte: string) {
  return { status: 'protegido', uf, fonte }
}
export async function marcarProtegido(supabase: any, pedidoId: string, uf: string, fonte: string): Promise<void> {
  try {
    const snap = await lerSnapshot(supabase, pedidoId)
    if (!snap) return
    const atual = (snap as any).multas
    if (atual && (atual.status === 'ok' || atual.status === 'sem_debito')) return
    await supabase
      .from('pedidos_premium')
      .update({ relatorio_snapshot: { ...snap, multas: blocoProtegido(uf, fonte) } })
      .eq('id', pedidoId)
  } catch (e: any) {
    console.warn('[infosimples] marcar protegido falhou:', e?.message || e)
  }
}

/**
 * Pos-entrega: dispara completarDetran sem segurar a entrega. Fail-open:
 * timeout/erro nao derruba o relatorio, so nao grava o bloco.
 */
export function completarDetranDepois(
  supabase: any,
  pedido: { id: string; placa: string },
  ctx: { consultaId: string | null; response: any },
): void {
  void completarDetran(supabase, pedido, ctx).catch(async (e: any) => {
    console.warn('[infosimples] completar detran falhou:', e?.message || e)
    // A tela espera o bloco: solta ela com "indisponivel" em vez do limite.
    const uf = ufDetranSuportada(ufDaResposta(ctx.response))
    if (uf) await marcarIndisponivel(supabase, pedido.id, uf)
  })
}
