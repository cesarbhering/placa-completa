// Teto de 5/IP/hora pra chamadas que custam credito wdapi (API paga),
// COMBINANDO as duas rotas que batem nela: /api/consulta (grava 1 row por
// request em `consultas`, ver comentario la — conta TODA request, nao so
// cache-miss) e /api/premium/preview (grava em `wdapi_preview_calls`, tabela
// leve so pra isso). Sem a soma, um bot que revezasse entre as duas rotas
// dobrava o orcamento efetivo pra 30/hora.
import { getHourlyLimit } from './rate-limit-whitelist'

// 5/IP/hora (Cesar, 30/set; era 15). Somando /api/consulta + preview de placa
// fora do cache. Pagar zera o contador (janelaInicio pos-compra). Whitelist
// 'ip:<ip>' pode subir (VPS da sonda = 30).
export const IP_WDAPI_HOURLY_LIMIT = 5

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
}

/**
 * Confere o teto combinado (consultas + wdapi_preview_calls) pro IP. Nao
 * lanca: devolve { ok:false, teto, minutesUntilReset } pro chamador decidir
 * a mensagem/log (cada rota loga o bloqueio com seus proprios campos de
 * contexto — placa, recipient etc).
 */
export async function checarLimiteIpWdapi(
  supabase: any,
  ip: string,
  opts: { recipientValue?: string | null; homolog?: boolean; janelaInicio?: string } = {},
): Promise<LimiteWdapiResultado> {
  const ipCheckable = !!ip && ip !== 'unknown'
  if (!ipCheckable || opts.homolog) return { ok: true }

  const teto = await tetoIpWdapi(ip)
  if (teto === Infinity) return { ok: true }

  // Chamador pode ja ter calculado a janela (consulta.post.ts calcula pro
  // check de destinatario tambem, e reusa aqui pra nao duplicar a query do
  // reset pos-pagamento); quem nao tem (preview.post.ts) deixa calcular.
  const janelaInicio = opts.janelaInicio ?? await calcularJanelaInicio(ip, ipCheckable, opts.recipientValue)

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

  const total = (consultasRes.count ?? 0) + (previewRes.count ?? 0)
  if (total < teto) return { ok: true }

  const oldest = [consultasRes.data?.[0]?.created_at, previewRes.data?.[0]?.created_at]
    .filter(Boolean)
    .sort()[0]
  let minutesUntilReset = 60
  if (oldest) {
    const minutesElapsed = Math.floor((Date.now() - new Date(oldest).getTime()) / 60000)
    minutesUntilReset = Math.max(1, 60 - minutesElapsed)
  }
  return { ok: false, teto, minutesUntilReset }
}

// Marca uma chamada de /api/premium/preview pro teto combinado. Best-effort:
// falha de gravacao nao pode derrubar o preview (fail-open, mesma filosofia
// do resto do rate limit — nunca trava quem esta comprando por causa de log).
export async function registrarChamadaPreviewWdapi(supabase: any, ip: string) {
  if (!ip || ip === 'unknown') return
  supabase
    .from('wdapi_preview_calls')
    .insert({ ip_address: ip })
    .then(({ error }: any) => {
      if (error) console.warn('[wdapi_preview_calls] insert falhou:', error.message)
    })
}
