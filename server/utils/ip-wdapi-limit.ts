// Teto de 5/IP/hora pra chamadas que custam credito wdapi (API paga),
// COMBINANDO as duas rotas que batem nela: /api/consulta (grava 1 row por
// request em `consultas`, ver comentario la — conta TODA request, nao so
// cache-miss) e /api/premium/preview (grava em `wdapi_preview_calls`, tabela
// leve so pra isso). Sem a soma, um bot que revezasse entre as duas rotas
// dobrava o orcamento efetivo pra 30/hora.
import { getHourlyLimit } from './rate-limit-whitelist'
import { inicioDaContagem, emVooPara, reservar, SEM_RESERVA, type Liberar } from './reserva-teto'

// 5/IP/hora (Cesar, 30/set; era 15). Somando /api/consulta + preview de placa
// fora do cache. Pagar zera o contador (janelaInicio pos-compra). Whitelist
// 'ip:<ip>' pode subir (VPS da sonda = 30).
export const IP_WDAPI_HOURLY_LIMIT = 5

/**
 * Teto por IP da requisicao cujo DESTINATARIO esta liberado sem teto na
 * rate_limit_whitelist. A entrada do destinatario tira o teto por destinatario,
 * nunca o do IP: quem digita um e-mail liberado nao prova que e dono dele. O
 * teto por IP so sobe pra este valor (e fica no da entrada 'ip:<ip>' se ela
 * for maior).
 */
export const TETO_IP_DESTINATARIO_LIBERADO = 20

/** Mensagem unica do 429 de consulta gratis (pagina, app/PWA e checkout). Sem travessao. */
export function mensagemLimiteGratis(teto: number, minutos: number): string {
  return `Você chegou ao limite de ${teto} consultas grátis por hora. Tente novamente em ~${minutos} min. Se comprar um relatório, o limite volta a zerar na hora.`
}

// Reset apos compra: se o IP (ou o destinatario) tem um pedido premium PAGO
// na ultima hora, a janela de contagem comeca no pagamento -- quem pagou nao
// fica preso atras das consultas gratis de antes. Mesma logica que ja existia
// em consulta.post.ts, extraida pra ser compartilhada com o preview.
async function calcularJanelaInicio(
  ip: string,
  ipCheckable: boolean,
  recipientValue?: string | null,
): Promise<string> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  try {
    const orParts: string[] = []
    if (ipCheckable) orParts.push(`ip_address.eq.${ip}`)
    if (recipientValue) orParts.push(`email.eq.${recipientValue}`)
    if (!orParts.length) return oneHourAgo
    const premium = usePremiumSupabase()
    const { data: pago } = await premium
      .from('pedidos_premium')
      .select('pago_em')
      .not('pago_em', 'is', null)
      .or(orParts.join(','))
      .gte('pago_em', oneHourAgo)
      .order('pago_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    return pago?.pago_em ? new Date(pago.pago_em).toISOString() : oneHourAgo
  } catch {
    // premium nao configurado ou lookup falhou: sem reset, segue a janela padrao.
    return oneHourAgo
  }
}

/**
 * Teto wdapi do IP: max(5, whitelist). A whitelist de IP e gravada como
 * 'ip:<ip>' (ex.: 'ip:62.169.22.218' = VPS, 30/h, PR #387) e o teto so olhava
 * o IP cru, entao nunca casava e a sonda da VPS batia em 15/h. Olha as duas
 * chaves (a crua por compatibilidade) e fica com a maior.
 */
export async function tetoIpWdapi(ip: string): Promise<number> {
  const [prefixado, cru] = await Promise.all([getHourlyLimit(`ip:${ip}`), getHourlyLimit(ip)])
  return Math.max(IP_WDAPI_HOURLY_LIMIT, prefixado, cru)
}

export interface LimiteWdapiResultado {
  ok: boolean
  teto?: number
  minutesUntilReset?: number
  /**
   * So quando ok: libera a vaga em voo desta requisicao (ver reserva-teto.ts).
   * Chamar quando a linha que conta estiver gravada, ou com `false` quando a
   * requisicao terminar sem gravar linha. Sempre presente e nunca lanca.
   */
  liberar: Liberar
}

/** Chave da reserva em voo do teto por IP (consulta gratis + preview somados). */
export function chaveReservaIp(ip: string): string {
  return `ip|${ip}`
}

/**
 * Confere o teto combinado (consultas + wdapi_preview_calls) pro IP. Nao
 * lanca: devolve { ok:false, teto, minutesUntilReset } pro chamador decidir
 * a mensagem/log (cada rota loga o bloqueio com seus proprios campos de
 * contexto — placa, recipient etc).
 *
 * Vale pra chamadas simultaneas: quem passou e ainda nao gravou a linha fica
 * reservado em memoria e entra na conta de quem vem junto. Quando ok, o
 * chamador TEM que chamar `liberar` no fim (linha gravada ou nao).
 */
export async function checarLimiteIpWdapi(
  supabase: any,
  ip: string,
  opts: {
    recipientValue?: string | null
    homolog?: boolean
    janelaInicio?: string
    /** Piso do teto nesta requisicao (ex.: destinatario liberado sem teto = 20). So sobe, nunca reduz. */
    tetoMinimo?: number
  } = {},
): Promise<LimiteWdapiResultado> {
  const ipCheckable = !!ip && ip !== 'unknown'
  if (!ipCheckable || opts.homolog) return { ok: true, liberar: SEM_RESERVA }

  const teto = Math.max(await tetoIpWdapi(ip), opts.tetoMinimo ?? 0)
  if (teto === Infinity) return { ok: true, liberar: SEM_RESERVA }

  // Chamador pode ja ter calculado a janela (consulta.post.ts calcula pro
  // check de destinatario tambem, e reusa aqui pra nao duplicar a query do
  // reset pos-pagamento); quem nao tem (preview.post.ts) deixa calcular.
  const janelaInicio = opts.janelaInicio ?? await calcularJanelaInicio(ip, ipCheckable, opts.recipientValue)

  // Marca o inicio ANTES de mandar as contagens: reserva liberada depois deste
  // ponto ainda conta (a contagem pode nao ter visto a linha dela).
  const chave = chaveReservaIp(ip)
  let inicio: number | null = null
  try { inicio = inicioDaContagem() } catch { inicio = null }

  const [consultasRes, previewRes] = await Promise.all([
    supabase
      .from('consultas')
      .select('created_at', { count: 'exact' })
      .eq('ip_address', ip)
      .gte('created_at', janelaInicio)
      .order('created_at', { ascending: true })
      .limit(1),
    supabase
      .from('wdapi_preview_calls')
      .select('created_at', { count: 'exact' })
      .eq('ip_address', ip)
      .gte('created_at', janelaInicio)
      .order('created_at', { ascending: true })
      .limit(1),
  ])

  // Daqui ate o return nao ha await: decisao + reserva sao um passo so, entao
  // requisicoes simultaneas passam uma de cada vez por aqui. Falha aberta: erro
  // na reserva = segue como antes dela existir.
  let emVoo = 0
  try { if (inicio !== null) emVoo = emVooPara(chave, inicio) } catch { emVoo = 0 }
  const total = (consultasRes.count ?? 0) + (previewRes.count ?? 0) + emVoo
  if (total < teto) {
    let liberar: Liberar = SEM_RESERVA
    try { if (inicio !== null) liberar = reservar(chave) } catch { liberar = SEM_RESERVA }
    return { ok: true, liberar }
  }

  const oldest = [consultasRes.data?.[0]?.created_at, previewRes.data?.[0]?.created_at]
    .filter(Boolean)
    .sort()[0]
  let minutesUntilReset = 60
  if (oldest) {
    const minutesElapsed = Math.floor((Date.now() - new Date(oldest).getTime()) / 60000)
    minutesUntilReset = Math.max(1, 60 - minutesElapsed)
  }
  return { ok: false, teto, minutesUntilReset, liberar: SEM_RESERVA }
}

// Marca uma chamada de /api/premium/preview pro teto combinado. Best-effort:
// falha de gravacao nao pode derrubar o preview (fail-open, mesma filosofia
// do resto do rate limit — nunca trava quem esta comprando por causa de log).
// Devolve true quando a linha foi gravada (quem chama usa pra liberar a vaga
// em voo); nunca lanca. O preview nao espera por isto.
export async function registrarChamadaPreviewWdapi(supabase: any, ip: string): Promise<boolean> {
  if (!ip || ip === 'unknown') return false
  try {
    const { error } = await supabase
      .from('wdapi_preview_calls')
      .insert({ ip_address: ip })
    if (error) console.warn('[wdapi_preview_calls] insert falhou:', error.message)
    return !error
  } catch (e: any) {
    console.warn('[wdapi_preview_calls] insert falhou:', e?.message)
    return false
  }
}
