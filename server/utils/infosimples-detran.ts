import { encrypt } from 'aes-bridge'
import { renavamDaResposta, ufDaResposta } from './detran-multas'

// DETRAN estadual via Infosimples (comeca por SP: /detran/sp/debitos). Substitui
// o runner gov.br quebrado no relatorio PAGO. Traz multas, hodometro (vistorias),
// IPVA, licenciamento e restricoes. Uma chamada por pedido (cada uma custa
// ~R$0,28, ATE em erro de parametro), gated por UF SP e com cache no snapshot.
//
// O certificado e SEMPRE o e-CNPJ, mandado criptografado: base64 do .pfx ->
// aes-bridge encrypt (AES-256-GCM) -> url-safe. A senha do pfx idem. O Infosimples
// decripta com a mesma ENC_KEY. Criptografado em runtime a cada chamada.

const BASE = 'https://api.infosimples.com/api/v2/consultas'

/** aes-bridge encrypt + url-safe (+ -> -, / -> _, sem =), como o Infosimples pede. */
export async function encriptarInfosimples(valor: string, encKey: string): Promise<string> {
  const cifrado = await encrypt(valor, encKey)
  return String(cifrado).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function infosimplesConfig() {
  const c = useRuntimeConfig() as any
  return {
    token: String(c.infosimplesToken || ''),
    encKey: String(c.infosimplesEncKey || ''),
    pkcs12B64: String(c.infosimplesPkcs12B64 || ''),
    pkcs12Pass: String(c.infosimplesPkcs12Pass || ''),
  }
}

export function infosimplesConfigurado(): boolean {
  const c = infosimplesConfig()
  return !!(c.token && c.encKey && c.pkcs12B64 && c.pkcs12Pass)
}

/** UF de registro do veiculo (do SENATRAN) e SP? A chamada so vale pra SP por ora. */
export function ehVeiculoSp(uf: string | null | undefined): boolean {
  return String(uf || '').trim().toUpperCase() === 'SP'
}

export interface ResultadoDetran {
  code: number
  codeMessage: string
  preco: number
  data: any | null
  raw: any
}

/**
 * Consulta o DETRAN-SP (debitos). Devolve o code, o preco (header.price, pra
 * gravar o custo SEMPRE) e o data[0] cru. Nao lanca: erro de rede vira
 * code=0/data=null (o chamador e fail-open). Timeout do proprio Infosimples: 600s;
 * aqui poe um AbortController um pouco maior de rede.
 */
export async function consultarDetranSp(opts: { placa: string; renavam: string }): Promise<ResultadoDetran> {
  const cfg = infosimplesConfig()
  if (!infosimplesConfigurado()) return { code: 0, codeMessage: 'infosimples nao configurado', preco: 0, data: null, raw: null }
  try {
    const [cert, pass] = await Promise.all([
      encriptarInfosimples(cfg.pkcs12B64, cfg.encKey),
      encriptarInfosimples(cfg.pkcs12Pass, cfg.encKey),
    ])
    const body = new URLSearchParams({
      token: cfg.token,
      timeout: '600',
      ignore_site_receipt: '0',
      pkcs12_cert: cert,
      pkcs12_pass: pass,
      placa: opts.placa,
      renavam: opts.renavam,
    })
    const res = await fetch(`${BASE}/detran/sp/debitos`, {
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
      raw: json,
    }
  } catch (e: any) {
    return { code: 0, codeMessage: String(e?.message || e), preco: 0, data: null, raw: null }
  }
}

// ---------- Parser (puro, testavel) ----------

function moeda(v: any): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
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

/** So mostra restricao que de fato consta (ignora "Nada consta"/vazio). */
function restricaoConsta(v: any): string | null {
  const s = String(v ?? '').trim()
  if (!s || /^nada\s+consta$/i.test(s)) return null
  return s
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

/**
 * Modela o data[0] do Infosimples pro relatorio. Puro (sem rede), pra testar o
 * hodometro (dedupe + ordem + suspeita de adulteracao) e o licenciamento atrasado.
 * anoAtual injetavel pra teste deterministico.
 */
export function parsearDetranSp(data: any, anoAtual: number = new Date().getFullYear()): DetranParsed {
  const d = data || {}

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

  // Licenciamento: atrasado quando o ultimo exercicio e anterior ao ano atual,
  // MESMO com debito zerado (pode ter ido pra divida ativa).
  const ultimoExercicio = anoDoExercicio(d.ultimo_licenciamento)
  const licAtrasado = ultimoExercicio != null && ultimoExercicio < anoAtual

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
    restricoes_detran: Object.entries(parsed.restricoes)
      .filter(([, v]) => !!v)
      .map(([tipo, texto]) => ({ tipo, texto })),
  }
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

/**
 * Nucleo awaitable: consulta o DETRAN-SP e grava o bloco no snapshot. Gated: SO
 * veiculo registrado em SP (UF do SENATRAN), SEMPRE (nao depende de flag de
 * multa). 1 chamada por pedido (cache: nao chama se o snapshot ja tem o bloco
 * do Infosimples). O custo (header.price) e gravado em TODA chamada, ate em erro.
 * Usado pelo pos-entrega (fire-and-forget) e pelo backfill admin (em serie).
 */
export async function completarDetran(
  supabase: any,
  pedido: { id: string; placa: string },
  ctx: { response: any },
): Promise<ResultadoCompletarDetran> {
  const uf = ufDaResposta(ctx.response)
  if (!ehVeiculoSp(uf)) return { ok: false, pulado: `uf ${uf || '?'} (so SP)` }
  const renavam = renavamDaResposta(ctx.response)
  if (!renavam) return { ok: false, pulado: 'sem renavam' }
  if (!infosimplesConfigurado()) return { ok: false, pulado: 'infosimples nao configurado' }

  const { data } = await supabase
    .from('pedidos_premium')
    .select('relatorio_snapshot')
    .eq('id', pedido.id)
    .maybeSingle()
  const snap = data?.relatorio_snapshot
  if (!snap || typeof snap !== 'object') return { ok: false, pulado: 'sem snapshot' }
  // `multas.fonte==='detran_sp'` marca que ja consultamos o Infosimples (o
  // snapshot.multas antigo do gov.br nao tem fonte e e sobrescrito).
  if ((snap as any).multas?.fonte === 'detran_sp') return { ok: false, pulado: 'ja tem detran_sp' }

  const res = await consultarDetranSp({ placa: pedido.placa, renavam })
  // Custo SEMPRE (ate em erro de parametro o Infosimples cobra).
  await registrarCusto(supabase, { pedidoId: pedido.id, fonte: 'infosimples_detran_sp', preco: res.preco, code: res.code })

  if (res.code !== 200 || !res.data) {
    return { ok: false, code: res.code, preco: res.preco, motivo: res.codeMessage || 'sem data' }
  }
  const parsed = parsearDetranSp(res.data)
  const multas = detranParaMultas(parsed)
  // Grava no MESMO campo que a secao "Multas e débitos" consome (reuso da UI).
  const { error } = await supabase
    .from('pedidos_premium')
    .update({ relatorio_snapshot: { ...snap, multas } })
    .eq('id', pedido.id)
  if (error) return { ok: false, code: res.code, preco: res.preco, motivo: 'update: ' + error.message }
  return { ok: true, code: res.code, preco: res.preco, multasCentavos: multas.multas_total_centavos, temAlgo: parsed.temAlgo }
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
