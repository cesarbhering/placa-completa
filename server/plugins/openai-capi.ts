import { OPENAI_CAPI_URL, montarLote, motivoParaNaoEnviar, type PedidoCapi } from '../utils/openai-capi'

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

async function rodar() {
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
      .select('token_entrega,status,valor_centavos,plano,email,pago_em,ambiente,ip_address,google_play_order_id,oppref,obref,utm_source')
      .eq('status', 'entregue')
      .is('openai_capi_em', null)
      .gt('valor_centavos', 0)
      .gte('pago_em', desde)
      .order('pago_em', { ascending: true })
      .limit(LOTE)
    if (error || !data?.length) return

    const agora = Date.now()
    const enviar: PedidoCapi[] = []
    const pular: string[] = []
    for (const p of data as PedidoCapi[]) {
      if (motivoParaNaoEnviar(p, { agora, protegido })) pular.push(p.token_entrega)
      else enviar.push(p)
    }
    // Pedido que nunca vai ser enviado (teste, app...) e marcado pra nao voltar.
    if (pular.length) {
      await supabase.from('pedidos_premium').update({ openai_capi_em: new Date().toISOString(), openai_capi_erro: 'nao_enviado' }).in('token_entrega', pular)
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

export default defineNitroPlugin(() => {
  if (process.env.VITEST) return
  setTimeout(() => { void rodar() }, 30_000)
  setInterval(() => { void rodar() }, INTERVALO_MS)
})
