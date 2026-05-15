export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  const init = () => {
    (function (c: any, l: Document, a: string, r: string, i: string, t?: any, y?: any) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) }
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y)
    })(window, document, 'clarity', 'script', 'wrhtezvm37')
  }

  // Defer past the critical render path so Clarity's script load doesn't
  // contend with vite-pwa's SW registration / OneSignal during initial mount.
  const ric: any = (window as any).requestIdleCallback
  if (typeof ric === 'function') {
    ric(init, { timeout: 4000 })
  } else {
    setTimeout(init, 2500)
  }
})
