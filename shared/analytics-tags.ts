// Onde as tags de ads/analytics (GA4 + Google Ads, Bing UET, Clarity, Meta,
// OneSignal) rodam. Incidente 01/out: pedidos de teste abertos no homolog
// dispararam "purchase" pras tags REAIS (Bing/GA4), porque o homolog carregava
// as mesmas tags da producao.
//
// Regra (decisao do Lead, 01/out): desliga SO quando o container e gated
// (homolog/staging). Nada por host: olhonamoto/olhonocaminhao/app sao trafego
// real e precisam das tags. A decisao e por container (build), o que tambem e
// seguro com o cache SWR por rota.

/** Ads/analytics ligados? So fora de homolog/staging. */
export function analyticsAtivo(gated: unknown): boolean {
  return gated !== true
}

const GTAG_CONFIG = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-24H7QSPX4G',{site_hostname:location.hostname});gtag('config','AW-18330779331');`
const UET = `(function(w,d,t,r,u){var f,n,i;w[u]=w[u]||[],f=function(){var o={ti:"97265456",enableAutoSpaTracking:true};o.q=w[u],w[u]=new UET(o),w[u].push("pageLoad")};n=d.createElement(t),n.src=r,n.async=1,n.onload=n.onreadystatechange=function(){var s=this.readyState;s&&s!=="loaded"&&s!=="complete"||(f(),n.onload=n.onreadystatechange=null)},i=d.getElementsByTagName(t)[0],i.parentNode.insertBefore(n,i)})(window,document,"script","https://bat.bing.com/bat.js","uetq");`

/**
 * Scripts do <head> (nuxt.config). Desligado (DISABLE_ANALYTICS) ou gated
 * (homolog/staging): nenhum. Senao: exatamente os de sempre (gtag.js + config
 * GA4/Ads + UET do Bing).
 */
export function scriptsDeAnalytics(opts: { desligado: boolean; gated: boolean }): Record<string, any>[] {
  if (opts.desligado || opts.gated) return []
  return [
    { defer: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-24H7QSPX4G' },
    // site_hostname: mesma propriedade GA4 atende placacompleta + olhonamoto +
    // olhonocaminhao; segmenta por dominio sem duplicar propriedade.
    { defer: true, innerHTML: GTAG_CONFIG },
    // Bing/Microsoft Ads UET (tag 97265456); enableAutoSpaTracking cobre as
    // trocas de rota do Nuxt.
    { innerHTML: UET },
  ]
}
