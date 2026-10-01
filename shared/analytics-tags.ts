// Onde as tags de ads/analytics (GA4 + Google Ads, Bing UET, Clarity, Meta,
// OneSignal) podem rodar. Incidente 01/out: pedidos de teste abertos no
// homolog dispararam "purchase" pras tags REAIS (Bing/GA4), porque o homolog
// carregava as mesmas tags da producao.
//
// Duas camadas, de proposito:
// 1) BUILD/CONTAINER gated (homolog/staging): nenhum script de ads/analytics
//    entra no HTML (decisao por container, segura com o cache SWR por rota).
// 2) HOST no navegador: no container de producao o HTML e o mesmo pra todos os
//    hosts (o cache SWR e por PATH, nao por host; decidir por host no SSR
//    serviria pagina sem tag pro dominio principal). Entao o snippet inline so
//    ativa se location.hostname for de producao. IP/localhost/dominio interno
//    batendo no container de prod nao manda nada.
//
// Hosts de producao: o principal, o www, os dominios irmaos com theming
// (olhonamoto/olhonocaminhao, mesma propriedade GA4 via site_hostname) e o
// app (app.placacompleta.com.br: usuarios reais do app, servido pelo container
// de prod).
export const HOSTS_ANALYTICS: readonly string[] = [
  'placacompleta.com.br', 'www.placacompleta.com.br',
  'olhonamoto.com.br', 'www.olhonamoto.com.br',
  'olhonocaminhao.com.br', 'www.olhonocaminhao.com.br',
  'app.placacompleta.com.br',
]

/** O host (do navegador) pode mandar dado pras tags? */
export function analyticsPermitidoNoHost(hostname: string | null | undefined): boolean {
  return HOSTS_ANALYTICS.includes(String(hostname || '').trim().toLowerCase().replace(/\.$/, ''))
}

/** Ads/analytics ligados no navegador: container nao gated E host de producao. */
export function analyticsAtivo(gated: unknown, hostname: string | null | undefined): boolean {
  return gated !== true && analyticsPermitidoNoHost(hostname)
}

/** Condicao JS inline (roda no navegador) equivalente a analyticsPermitidoNoHost. */
const GUARD_JS = `${JSON.stringify(HOSTS_ANALYTICS)}.indexOf(location.hostname)>=0`

const GTAG_CONFIG = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-24H7QSPX4G',{site_hostname:location.hostname});gtag('config','AW-18330779331');`
const UET = `(function(w,d,t,r,u){var f,n,i;w[u]=w[u]||[],f=function(){var o={ti:"97265456",enableAutoSpaTracking:true};o.q=w[u],w[u]=new UET(o),w[u].push("pageLoad")};n=d.createElement(t),n.src=r,n.async=1,n.onload=n.onreadystatechange=function(){var s=this.readyState;s&&s!=="loaded"&&s!=="complete"||(f(),n.onload=n.onreadystatechange=null)},i=d.getElementsByTagName(t)[0],i.parentNode.insertBefore(n,i)})(window,document,"script","https://bat.bing.com/bat.js","uetq");`

/**
 * Scripts do <head> (nuxt.config). Desligado (DISABLE_ANALYTICS) ou gated
 * (homolog/staging): nenhum. Senao: gtag.js + config do GA4/Ads e o UET do
 * Bing, os dois so ativos em host de producao (sem `gtag`/`uetq` definidos
 * fora disso, todo track() vira no-op).
 */
export function scriptsDeAnalytics(opts: { desligado: boolean; gated: boolean }): Record<string, any>[] {
  if (opts.desligado || opts.gated) return []
  return [
    { defer: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-24H7QSPX4G' },
    // site_hostname: mesma propriedade GA4 atende placacompleta + olhonamoto +
    // olhonocaminhao; segmenta por dominio sem duplicar propriedade.
    { defer: true, innerHTML: `if(${GUARD_JS}){${GTAG_CONFIG}}` },
    // Bing/Microsoft Ads UET (tag 97265456); enableAutoSpaTracking cobre as
    // trocas de rota do Nuxt.
    { innerHTML: `if(${GUARD_JS}){${UET}}` },
  ]
}
