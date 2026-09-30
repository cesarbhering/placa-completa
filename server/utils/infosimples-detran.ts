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

/** Certificado mandado ao Infosimples por UF. Hoje todas usam e-CNPJ; e-CPF fica suportado. */
export type CertInfosimples = 'ecnpj' | 'ecpf' | 'govbr_ba'

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
  if (cert === 'govbr_ba') {
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
  BA: { path: 'detran/ba/multas', cert: 'govbr_ba', gate: 'renainf', fonte: 'detran_ba', fonteCusto: 'infosimples_detran_ba' },
  RS: { path: 'detran/rs/infracoes', cert: 'ecnpj', gate: 'renainf', fonte: 'detran_rs', fonteCusto: 'infosimples_detran_rs' },
  MG: { path: 'detran/mg/multas-descritivos', cert: 'ecnpj', gate: 'renainf', fonte: 'detran_mg', fonteCusto: 'infosimples_detran_mg', exigeChassi: true },
  // GO: e-CNPJ, placa+renavam. R$0,28 por chamada (teste do Lead, 30/set).
  GO: { path: 'detran/go/debitos', cert: 'ecnpj', gate: 'renainf', fonte: 'detran_go', fonteCusto: 'infosimples_detran_go' },
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
}

/**
 * Consulta o DETRAN de uma UF no Infosimples. Devolve o code, o preco
 * (header.price, pra gravar o custo SEMPRE) e o data[0] cru. A resposta crua
 * inteira NAO e devolvida: no SC ela traz nome de proprietario/condutor (LGPD);
 * quem chama so ve o data[0], que vai direto pro parser de whitelist. Nao lanca:
 * erro de rede vira code=0/data=null (o chamador e fail-open).
 */
export async function consultarDetranInfosimples(opts: { uf: UfDetran; placa: string; renavam: string; chassi?: string | null }): Promise<ResultadoDetran> {
  const cfgUf: any = DETRAN_UFS[opts.uf]
  const certUf: CertInfosimples = cfgUf.cert
  const cfg = infosimplesConfig(certUf === 'govbr_ba' ? 'ecnpj' : certUf)
  if (!infosimplesConfigurado(certUf)) return { code: 0, codeMessage: `infosimples nao configurado (${certUf})`, preco: 0, data: null }
  try {
    const body = new URLSearchParams({
      token: cfg.token,
      timeout: '600',
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
    } else {
      const [cert, pass] = await Promise.all([
        encriptarInfosimples(cfg.pkcs12B64, cfg.encKey),
        encriptarInfosimples(cfg.pkcs12Pass, cfg.encKey),
      ])
      body.set('pkcs12_cert', cert)
      body.set('pkcs12_pass', pass)
      body.set('placa', opts.placa)
    }
    if (opts.chassi) body.set('chassi', String(opts.chassi).toUpperCase())
    const res = await fetch(`${BASE}/${DETRAN_UFS[opts.uf].path}`, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(120000),
    })
    const json: any = await res.json().catch(() => ({}))
    return {
      code: Number(json?.code || res.status || 0),
      codeMessage: String(json?.code_message || ''),
      preco: Number(json?.header?.price || 0),
      data: Array.isArray(json?.data) ? (json.data[0] ?? null) : null,
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
  ipva: { valor: number; mensagem: string | null; temDebito: boolean }
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
    ipva: { valor: ipvaValor, mensagem: d.ipva_mensagem ?? null, temDebito: ipvaTemDebito },
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

  const hist: any[] = Array.isArray(d.historico_infracoes_notificadas) ? d.historico_infracoes_notificadas : []
  const recursos: any[] = Array.isArray(d.recursos_infracoes) ? d.recursos_infracoes : []

  return {
    status: 'ok' as const,
    fonte: 'detran_sc',
    multas_total_centavos: Math.round(multasTotal * 100),
    licenciamento_centavos: Math.round(soma(porClasse.licenciamento) * 100),
    licenciamento_venc: brParaIso(licVenc),
    ipva_total_centavos: Math.round(soma(porClasse.ipva) * 100),
    hodometro: [] as { data: string | null; km: number }[],
    hodometro_suspeito: false,
    multas_itens: itens,
    licenciamento_atrasado_ano: licAtrasadoAno,
    ultimo_licenciamento_ano: licenciadoAno,
    restricoes_detran: restricoes,
    // Historico (secundario): infracoes ja notificadas (a maioria paga) e recursos.
    historico_infracoes: {
      total: hist.length,
      pagas: hist.filter((h) => /paga/i.test(String(h?.status || ''))).length,
      recursos: recursos.length,
    },
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

// ---------- DETRAN-RS (/detran/rs/infracoes) ----------
//
// Whitelist: NUNCA grava notificacao_autuacao_url, guia_pagamento_url nem
// site_receipt. RS nao traz IPVA, licenciamento nem km nesse endpoint.

/**
 * Em aberto = situacao diferente de "Paga" (vencida, a vencer, em notificacao),
 * exceto a linha sem situacao e sem valor. As pagas so entram na contagem do historico. O vencimento sai do
 * texto "Vencida em DD/MM/AAAA" / "Vence em DD/MM/AAAA".
 */
export function parsearDetranRs(data: any) {
  const d = data || {}
  const texto = (v: any) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t || null }
  const todas: any[] = Array.isArray(d.infracoes) ? d.infracoes : []
  const paga = (x: any) => /^paga$/i.test(String(x?.situacao ?? '').trim())
  // Sem situacao E com valor zero (visto no IWC7G10 real) nao e debito: seria
  // uma "multa em aberto" de R$ 0,00. Fica so na contagem do historico.
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
    // Historico (secundario): total notificado e quantas ja pagas.
    historico_infracoes: { total: todas.length, pagas: todas.filter(paga).length, recursos: 0 },
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
    pontos: m?.pontos != null && Number.isFinite(Number(m.pontos)) ? Number(m.pontos) : null,
    grupo: texto(m?.grupo_infracao),
    situacao: texto(m?.situacao),
  })
  const itens = GO_ABERTAS.flatMap((k) => lista(k)).map(item)
  const emRecurso = lista('sob_juice').map(item)

  // Debitos por exercicio. "----", "PAGO", "ISENTO", "NAO SE APLICA" nao sao valor.
  const debitos: any[] = Array.isArray(d.debitos_veiculo) ? d.debitos_veiculo : []
  const ehValor = (v: any) => /\d/.test(String(v ?? '')) && moeda(v) > 0
  const anoVenc = (x: any) => anoDe(x?.data_vencimento)
  let ipvaDetran = 0
  let licDebito = 0
  let licVenc: string | null = null
  let licVencido = false
  let ultimoLicAno: number | null = null
  const ipvaSefaz: { ano: number | null; valor_centavos: number }[] = []
  for (const x of debitos) {
    const ano = anoVenc(x)
    if (ehValor(x?.ipva_valor)) ipvaDetran += moeda(x.ipva_valor)
    else if (/sefaz/i.test(String(x?.ipva_valor ?? ''))) {
      ipvaSefaz.push({ ano, valor_centavos: Math.round(moeda(x?.valor_original_ipva) * 100) })
    }
    if (ehValor(x?.licenciamento)) {
      licDebito += moeda(x.licenciamento)
      const venc = texto(x?.data_vencimento)
      if (venc && (!licVenc || tsData(venc) < tsData(licVenc))) licVenc = venc
      const t = tsData(venc)
      if (t > 0 && t < hoje.getTime()) licVencido = true
    } else if (/^pago$/i.test(String(x?.licenciamento ?? '').trim()) && ano != null) {
      ultimoLicAno = ultimoLicAno == null ? ano : Math.max(ultimoLicAno, ano)
    }
  }
  ipvaSefaz.sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0))
  const ipvaCentavos = Math.round(ipvaDetran * 100) + ipvaSefaz.reduce((a, x) => a + x.valor_centavos, 0)

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

// ---------- Trava do login gov.br (BA) ----------
//
// 608 = "Usuário e/ou senha inválidos": cada tentativa conta como senha errada
// na conta gov.br do Cesar, e repetir pode BLOQUEAR a conta. No primeiro 608 o
// BA para de chamar neste processo (ate restart/deploy, que e quando alguem
// corrigiu a env) e manda alerta. Sem retry automatico.
let loginBaTravadoEm: string | null = null
export function loginBaTravado(): string | null { return loginBaTravadoEm }
export function destravarLoginBa(): void { loginBaTravadoEm = null }
/** Pro modo testar do backfill: mesma trava + alerta. */
export function travarLoginBaPublico(motivo: string): void { void travarLoginBa(motivo) }

async function travarLoginBa(motivo: string): Promise<void> {
  loginBaTravadoEm = new Date().toISOString()
  console.error('[infosimples] DETRAN-BA: login gov.br recusado (608); BA travado ate restart.', motivo)
  try {
    await sendErrorEmail({
      endpoint: '/premium/detran-ba',
      errorMessage: `DETRAN-BA: login gov.br recusado (608: ${motivo}). As consultas BA foram TRAVADAS neste container pra nao bloquear a conta gov.br. Confira NUXT_INFOSIMPLES_BA_CPF/SENHA no Coolify e faça redeploy.`,
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

/** data[0] do Infosimples -> bloco normalizado da UF (o que vai pro snapshot). */
export function blocoDetranDaUf(uf: UfDetran, data: any) {
  if (uf === 'SC') return parsearDetranSc(data)
  if (uf === 'MG') return parsearDetranMg(data)
  if (uf === 'BA') return parsearDetranBa(data)
  if (uf === 'RS') return parsearDetranRs(data)
  if (uf === 'GO') return parsearDetranGo(data)
  return detranParaMultas(parsearDetranSp(data))
}

/**
 * Nucleo awaitable: consulta o DETRAN da UF do veiculo e grava o bloco no
 * snapshot. Gated: SO veiculo registrado numa UF suportada (UF do SENATRAN:
 * SP, SC, MG), SEMPRE (nao depende de flag de multa). 1 chamada por pedido (cache:
 * nao chama se o snapshot ja tem o bloco da fonte). O custo (header.price) e
 * gravado em TODA chamada, ate em erro. Usado pelo pos-entrega (fire-and-forget)
 * e pelo backfill admin (em serie).
 */
export async function completarDetran(
  supabase: any,
  pedido: { id: string; placa: string },
  ctx: { response: any; ignorarGate?: boolean },
): Promise<ResultadoCompletarDetran> {
  const ufBruta = ufDaResposta(ctx.response)
  const uf = ufDetranSuportada(ufBruta)
  if (!uf) return { ok: false, pulado: `uf ${ufBruta || '?'} (so ${Object.keys(DETRAN_UFS).join('/')})` }
  const cfgUf = DETRAN_UFS[uf]
  if (cfgUf.gate === 'renainf' && !ctx.ignorarGate && !temMultaRenainf(ctx.response)) {
    return { ok: false, pulado: `${uf} so com RENAINF` }
  }
  const renavam = renavamDaResposta(ctx.response)
  if (!renavam) return { ok: false, pulado: 'sem renavam' }
  const chassi = chassiDaResposta(ctx.response)
  if ((cfgUf as any).exigeChassi && !chassi) return { ok: false, pulado: 'sem chassi' }
  if (!infosimplesConfigurado(cfgUf.cert)) return { ok: false, pulado: `infosimples nao configurado (${cfgUf.cert})` }
  if (cfgUf.cert === 'govbr_ba' && loginBaTravado()) return { ok: false, pulado: 'login BA travado (608)' }

  const { data } = await supabase
    .from('pedidos_premium')
    .select('relatorio_snapshot')
    .eq('id', pedido.id)
    .maybeSingle()
  const snap = data?.relatorio_snapshot
  if (!snap || typeof snap !== 'object') return { ok: false, pulado: 'sem snapshot' }
  // `multas.fonte` marca que ja consultamos o Infosimples dessa UF (o
  // snapshot.multas antigo do gov.br nao tem fonte e e sobrescrito).
  // Excecao: bloco preenchido A MANO (preenchido_manual_em) e trocado pelo dado
  // oficial quando a consulta roda.
  const multasAtual = (snap as any).multas
  if (multasAtual?.fonte === cfgUf.fonte && !multasAtual?.preenchido_manual_em) return { ok: false, pulado: `ja tem ${cfgUf.fonte}` }

  const res = await consultarDetranInfosimples({ uf, placa: pedido.placa, renavam, chassi: (cfgUf as any).exigeChassi ? chassi : null })
  // Custo SEMPRE (ate em erro de parametro o Infosimples cobra).
  await registrarCusto(supabase, { pedidoId: pedido.id, fonte: cfgUf.fonteCusto, preco: res.preco, code: res.code })
  if (cfgUf.cert === 'govbr_ba' && res.code === 608) await travarLoginBa(res.codeMessage)

  if (res.code !== 200 || !res.data) {
    return { ok: false, code: res.code, preco: res.preco, motivo: res.codeMessage || 'sem data' }
  }
  const multas: any = blocoDetranDaUf(uf, res.data)
  const temAlgo = multas.multas_itens.length > 0 || multas.hodometro.length > 0 || multas.restricoes_detran.length > 0
    || !!multas.alerta_roubo_furto
    || (multas.ipva_total_centavos ?? 0) > 0 || (multas.licenciamento_centavos ?? 0) > 0 || multas.licenciamento_atrasado_ano != null
  // Grava no MESMO campo que a secao "Multas e débitos" consome (reuso da UI).
  const { error } = await supabase
    .from('pedidos_premium')
    .update({ relatorio_snapshot: { ...snap, multas } })
    .eq('id', pedido.id)
  if (error) return { ok: false, code: res.code, preco: res.preco, motivo: 'update: ' + error.message }
  return { ok: true, code: res.code, preco: res.preco, multasCentavos: multas.multas_total_centavos, temAlgo }
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
  void completarDetran(supabase, pedido, ctx).catch((e: any) => {
    console.warn('[infosimples] completar detran falhou:', e?.message || e)
  })
}
