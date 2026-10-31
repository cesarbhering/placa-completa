import { OPENAI_CAPI_URL, montarLote, motivoParaNaoEnviar, origemChatgptNoPedido, toqueChatgptDaConsulta, type ConsultaOrigem, type PedidoCapi } from '../utils/openai-capi'

// Worker do order_created da OpenAI Ads (Conversions API). Roda separado do
// fluxo de pagamento: a confirmacao (webhook Woovi/AbacatePay/Stripe, polling)
// so grava pago_em/status como sempre; aqui, a cada 2 minutos, os pedidos
// pagos e ainda nao enviados viram eventos. Assim um erro da OpenAI nunca
// trava confirmacao nem entrega (lembra o incidente do checkout de 20-21/set).
// Retry idempotente: mesmo id (token do pedido) ate dar 2xx; a OpenAI deduplica
// por pixel + evento + id. Sem key ou sem Pixel ID: no-op. A key nunca vai pra log.

const INTERVALO_MS = 2 * 60 * 1000
const LOTE = 50

let rodando = false
// Piso de data: so vendas pagas a partir de quando o envio comeca (sem
// backfill de quem nao veio de anuncio). NUXT_OPENAI_ADS_DESDE (ISO) fixa o
// piso e sobrevive a restart; sem ele, vale a 1a vez que key e Pixel ID
// apareceram neste processo.
let pisoDoProcesso: string | null = null

export function pisoDeEnvio(env: string | undefined, pisoProcesso: string): string {
  const t = Date.parse(String(env || ''))
  return Number.isFinite(t) ? new Date(t).toISOString() : pisoProcesso
}

export async function rodar() {
  if (rodando) return
  rodando = true
  try {
    const cfg = useRuntimeConfig()
    const key = String(cfg.openaiAdsCapiKey || '').trim()
    const pid = String(cfg.openaiAdsPixelId || cfg.public.openaiAdsPixelId || '').trim()
    if (!key || !pid) return
    const protegido = !!cfg.public.gated
    const supabase = usePremiumSupabase()
    if (!pisoDoProcesso) pisoDoProcesso = new Date().toISOString()
    const piso = pisoDeEnvio(process.env.NUXT_OPENAI_ADS_DESDE, pisoDoProcesso)
    const seteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const desde = piso > seteDias ? piso : seteDias
    const { data, error } = await supabase
      .from('pedidos_premium')
      .select('token_entrega,status,valor_centavos,plano,email,pago_em,ambiente,ip_address,google_play_order_id,oppref,obref,utm_source,placa')
      .eq('status', 'entregue')
      // 'nao_enviado' generico e da versao anterior (antes do motivo especifico
      // e do primeiro clique pela consulta): reavalia uma vez dentro dos 7 dias.
      // Caso TST1A23. Depois de reavaliado ele ganha o motivo certo e nao volta.
      .or('openai_capi_em.is.null,openai_capi_erro.eq.nao_enviado')
      .gt('valor_centavos', 0)
      .gte('pago_em', desde)
      .order('pago_em', { ascending: true })
      .limit(LOTE)
    if (error || !data?.length) return

    const agora = Date.now()
    const pedidos = data as PedidoCapi[]
    await anexarToqueDaConsulta(supabase, pedidos)
    const enviar: PedidoCapi[] = []
    const pularPorMotivo = new Map<string, string[]>()
    for (const p of pedidos) {
      const motivo = motivoParaNaoEnviar(p, { agora, protegido })
      if (motivo) pularPorMotivo.set(motivo, [...(pularPorMotivo.get(motivo) || []), p.token_entrega])
      else enviar.push(p)
    }
    // Pedido que nunca vai ser enviado e marcado pra nao voltar, com o motivo
    // (sem_origem_chatgpt, app, teste, velho...): os relatorios de venda leem.
    for (const [motivo, tokens] of pularPorMotivo) {
      await supabase.from('pedidos_premium').update({ openai_capi_em: new Date().toISOString(), openai_capi_erro: motivo }).in('token_entrega', tokens)
    }
    if (!enviar.length) return

    const corpo = montarLote(enviar, protegido)
    let status = 0
    let resposta = ''
    try {
      const r = await fetch(`${OPENAI_CAPI_URL}?pid=${encodeURIComponent(pid)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(15000),
      })
      status = r.status
      resposta = (await r.text()).slice(0, 300)
    } catch (e: any) {
      resposta = String(e?.name || 'erro_rede')
    }
    const tokens = enviar.map((p) => p.token_entrega)
    if (status >= 200 && status < 300) {
      await supabase.from('pedidos_premium').update({
        openai_capi_em: new Date().toISOString(),
        openai_capi_erro: protegido ? `validate_only ${status}` : null,
      }).in('token_entrega', tokens)
      console.info(`[openai-capi] ${tokens.length} evento(s) ${protegido ? 'validados' : 'enviados'} (${status})`)
    } else {
      // Fica sem openai_capi_em: volta no proximo ciclo com o MESMO id.
      await supabase.from('pedidos_premium').update({ openai_capi_erro: `${status || 'rede'} ${resposta}`.slice(0, 300) }).in('token_entrega', tokens)
      console.warn(`[openai-capi] falhou (${status || 'rede'}), ${tokens.length} evento(s) voltam no proximo ciclo`)
    }
  } catch (e: any) {
    console.warn('[openai-capi] ciclo falhou:', e?.message)
  } finally {
    rodando = false
  }
}

/**
 * Pedido sem oppref/utm do ChatGPT: procura o clique na consulta gratis da
 * mesma placa (7 dias antes do pagamento) e anexa como toque_chatgpt. Uma
 * consulta so pro lote. Falha aqui so deixa sem o toque (nunca trava o envio).
 */
export async function anexarToqueDaConsulta(supabase: any, pedidos: PedidoCapi[]) {
  const sem = pedidos.filter((p) => !origemChatgptNoPedido(p) && p.placa && p.pago_em && !p.google_play_order_id)
  if (!sem.length) return
  // Placa da consulta vem como foi digitada: manda maiuscula e minuscula.
  const placas = [...new Set(sem.flatMap((p) => [String(p.placa).toUpperCase(), String(p.placa).toLowerCase()]))]
  const maisAntigo = Math.min(...sem.map((p) => Date.parse(String(p.pago_em))))
  try {
    const { data } = await supabase.from('consultas')
      .select('placa,created_at,oppref,obref,utm_source')
      .in('placa', placas)
      .gte('created_at', new Date(maisAntigo - 7 * 24 * 60 * 60 * 1000).toISOString())
      .or('oppref.not.is.null,utm_source.ilike.chatgpt_ads')
      .limit(500)
    const consultas = (data || []) as ConsultaOrigem[]
    for (const p of sem) p.toque_chatgpt = toqueChatgptDaConsulta(consultas, p.placa, p.pago_em)
  } catch { /* sem toque: segue como venda sem origem */ }
}

export default defineNitroPlugin(() => {
  if (process.env.VITEST) return
  setTimeout(() => { void rodar() }, 30_000)
  setInterval(() => { void rodar() }, INTERVALO_MS)
})
