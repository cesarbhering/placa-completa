import { analyticsAtivo } from '~/shared/analytics-tags'
/**
 * Pixel da Meta, para remarketing.
 *
 * Carrega SO quando ha um id configurado (NUXT_PUBLIC_META_PIXEL_ID). Sem id,
 * este plugin nao faz nada e nenhuma requisicao sai do navegador: e assim que
 * ele fica pronto no codigo antes de a conta existir, sem virar tag fantasma.
 *
 * Consentimento: segue a mesma regra do gtag do site, que hoje e carregar em
 * producao e nao carregar quando DISABLE_ANALYTICS esta ligado. Se um dia
 * entrar banner de consentimento, o ponto de bloqueio e este arquivo, um so.
 *
 * O que o pixel NAO recebe: placa, chassi, e-mail, telefone, token de pedido.
 * Remarketing precisa saber em que etapa a pessoa parou, nao quem ela e nem
 * qual veiculo ela consultou.
 */
export default defineNuxtPlugin(() => {
  const id = String(useRuntimeConfig().public.metaPixelId || '').trim()
  if (!id || !/^\d{10,20}$/.test(id)) return
  // Homolog/staging (gated): nenhum pixel (shared/analytics-tags.ts).
  if (!analyticsAtivo(useRuntimeConfig().public.gated)) return

  const w = window as any
  if (w.fbq) return

  /* eslint-disable */
  const n: any = (w.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
  })
  if (!w._fbq) w._fbq = n
  n.push = n
  n.loaded = true
  n.version = '2.0'
  n.queue = []
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(s)
  /* eslint-enable */

  w.fbq('init', id)
  w.fbq('track', 'PageView')
})
