/**
 * Cloudflare Turnstile da consulta gratis (home e FIPE por placa).
 *
 * Widget invisivel/gerenciado com render explicito: o script so carrega nas
 * telas que chamam POST /api/consulta, o widget e montado num container da
 * propria tela e o execute roda logo antes do envio. Token e de uso unico
 * (~300 s), entao o widget e resetado depois de cada consulta.
 *
 * Nunca trava a consulta: sem site key nao faz nada; se o script nao carrega,
 * o widget erra ou passa de ~4 s, devolve null e a consulta vai sem token. O
 * modo do servidor (off/log/enforce) decide o que fazer com isso.
 *
 * Nada de desafio intersticial: o app Android carrega este mesmo site numa
 * WebView (Capacitor), e la um desafio de pagina inteira quebrou o fetch em
 * set/2026. O widget roda num iframe dentro da pagina, que a WebView aguenta.
 */

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const TIMEOUT_MS = 4000

let scriptPromise: Promise<any> | null = null

function carregarScript(): Promise<any> {
  const w = window as any
  if (w.turnstile) return Promise.resolve(w.turnstile)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_URL
    s.async = true
    s.defer = true
    s.onload = () => (w.turnstile ? resolve(w.turnstile) : reject(new Error('turnstile ausente')))
    s.onerror = () => reject(new Error('turnstile nao carregou'))
    document.head.appendChild(s)
  }).catch((e) => {
    // Deixa tentar de novo na proxima consulta (rede oscilando no celular).
    scriptPromise = null
    throw e
  })
  return scriptPromise
}

export function useTurnstile() {
  const config = useRuntimeConfig()
  const siteKey = String(config.public?.turnstileSiteKey || '')
  const container = ref<HTMLElement | null>(null)
  let widgetId: string | null = null
  let pendente: ((t: string | null) => void) | null = null

  function resolverPendente(token: string | null) {
    const r = pendente
    pendente = null
    r?.(token)
  }

  async function montar(): Promise<boolean> {
    if (!import.meta.client || !siteKey || !container.value) return false
    if (widgetId) return true
    const ts = await carregarScript()
    if (!container.value || widgetId) return !!widgetId
    widgetId = ts.render(container.value, {
      sitekey: siteKey,
      // So roda no execute(), logo antes do envio.
      execution: 'execute',
      // So aparece se a Cloudflare pedir interacao.
      appearance: 'interaction-only',
      action: 'consulta',
      language: 'pt-br',
      'refresh-expired': 'manual',
      callback: (token: string) => resolverPendente(token),
      'error-callback': () => { resolverPendente(null); return true },
      'expired-callback': () => resolverPendente(null),
      'timeout-callback': () => resolverPendente(null),
    })
    return true
  }

  /** Pre-carrega o script e monta o widget (chamar no onMounted). Nunca lanca. */
  function preparar() {
    montar().catch(() => {})
  }

  /** Token novo pra uma consulta, ou null (sem site key, erro ou >4 s). Nunca lanca. */
  async function obterToken(): Promise<string | null> {
    if (!import.meta.client || !siteKey) return null
    const ts = (window as any).turnstile
    const inicio = Date.now()
    try {
      const montado = await Promise.race([
        montar(),
        new Promise<boolean>((r) => setTimeout(() => r(false), TIMEOUT_MS)),
      ])
      if (!montado || !widgetId) return null
      const restante = Math.max(500, TIMEOUT_MS - (Date.now() - inicio))
      const api = ts || (window as any).turnstile
      return await new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => resolverPendente(null), restante)
        pendente = (t) => { clearTimeout(timer); resolve(t) }
        try {
          api.execute(widgetId)
        } catch {
          resolverPendente(null)
        }
      })
    } catch {
      return null
    }
  }

  /** Token e de uso unico: reseta depois de cada envio. */
  function resetar() {
    const ts = (window as any).turnstile
    if (!widgetId || !ts) return
    try { ts.reset(widgetId) } catch { /* widget ja removido */ }
  }

  onBeforeUnmount(() => {
    resolverPendente(null)
    const ts = (window as any).turnstile
    if (widgetId && ts) {
      try { ts.remove(widgetId) } catch { /* nada */ }
    }
    widgetId = null
  })

  return { container, preparar, obterToken, resetar, ativo: !!siteKey }
}
