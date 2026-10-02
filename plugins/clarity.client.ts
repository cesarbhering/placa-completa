import { analyticsAtivo } from '~/shared/analytics-tags'
import { aposCarregar } from '~/shared/apos-carregar'
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return
  // Homolog/staging (gated): nenhuma tag (shared/analytics-tags.ts).
  if (!analyticsAtivo(useRuntimeConfig().public.gated)) return

  const init = () => {
    (function (c: any, l: Document, a: string, r: string, i: string, t?: any, y?: any) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) }
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y)
    })(window, document, 'clarity', 'script', 'wrhtezvm37')
  }

  // Logo depois do load (sem esperar requestIdleCallback, que o Safari do iOS
  // nao tem). Ver shared/apos-carregar.ts.
  aposCarregar(init)
})
