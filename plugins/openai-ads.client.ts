import { analyticsAtivo } from '~/shared/analytics-tags'
import { aposCarregar } from '~/shared/apos-carregar'

// Pixel da OpenAI Ads (ChatGPT). So mede: captura o oppref da URL de entrada
// (cookie __oppref) e cria o cookie __obref, que a consulta e o checkout levam
// pro servidor (shared/origem-trafego.ts). A conversao de compra (order_created)
// sai pelos DOIS lados com o mesmo event_id (o token do pedido), e a OpenAI
// deduplica: servidor (server/plugins/openai-capi.ts) e navegador, na pagina do
// relatorio entregue (trackOrderCreatedOpenAI em composables/useAnalytics.ts).
// O painel so contou conversao depois do evento do navegador (24/out/2026).
// Sem Pixel ID ou em homolog/staging: nada.
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return
  const cfg = useRuntimeConfig().public
  const pixelId = String(cfg.openaiAdsPixelId || '').trim()
  if (!pixelId || !analyticsAtivo(cfg.gated)) return

  const w = window as any
  if (!w.oaiq) {
    const q: any = function (...args: any[]) { q.q.push(args) }
    q.q = []
    w.oaiq = q
  }
  w.oaiq('init', { pixelId })

  // Script depois do load, como o Clarity (shared/apos-carregar.ts). A fila
  // acima guarda o init ate o SDK chegar.
  aposCarregar(() => {
    const js = document.createElement('script')
    js.async = true
    js.src = 'https://bzrcdn.openai.com/sdk/oaiq.min.js'
    const f = document.getElementsByTagName('script')[0]
    f?.parentNode?.insertBefore(js, f)
  })
})
