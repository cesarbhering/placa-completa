/**
 * Cloudflare Turnstile da consulta gratis (home e FIPE por placa).
 *
 * Widget com render explicito e execucao JA NA MONTAGEM (execution 'render'):
 * o desafio roda em segundo plano enquanto a pessoa digita a placa, e o token
 * fica pronto antes do clique. Ate 10/nov/2026 o desafio so comecava no
 * clique, com 4 s de prazo pra carregar script + iframe + desafio; quase
 * metade das consultas reais chegava sem token (turnstile_eventos 'ausente')
 * e o token que chegava depois do prazo era descartado.
 *
 * Token e de uso unico e vale ~300 s: 'refresh-expired: auto' renova o que
 * expira parado na tela, e obterToken() consome o token e reseta o widget na
 * hora, pra a proxima consulta ja ter outro sendo gerado.
 *
 * Nunca trava a consulta pra sempre: sem site key nao faz nada; sem token
 * pronto espera ate TURNSTILE_ESPERA_MS (TURNSTILE_ESPERA_ERRO_MS se o widget
 * ja deu erro; TURNSTILE_ESPERA_INTERACAO_MS quando a Cloudflare mostrou a
 * caixinha e a pessoa precisa clicar) e envia sem
 * token, com o motivo. O modo do servidor (off/log/enforce) decide o resto.
 *
 * Nada de desafio intersticial: o app Android carrega este mesmo site numa
 * WebView, e la um desafio de pagina inteira quebrou o fetch em set/2026. O
 * widget roda num iframe dentro da pagina, que a WebView aguenta.
 */

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
/** Espera maxima no envio quando o token ainda nao ficou pronto. */
export const TURNSTILE_ESPERA_MS = 8000
/** Widget ja deu erro (retry automatico em curso): espera curta, pra nao punir toda consulta. */
export const TURNSTILE_ESPERA_ERRO_MS = 3000
/** Com a caixinha na tela (a Cloudflare pediu interacao): tempo pra pessoa clicar. */
export const TURNSTILE_ESPERA_INTERACAO_MS = 25000
/** Token vale 300 s; acima disso nem tenta usar (o auto-refresh ja deve ter trocado). */
export const TURNSTILE_TOKEN_MAX_MS = 280_000

/** Por que a consulta foi sem token (vai no POST e no turnstile_eventos). */
export type MotivoSemToken = 'timeout' | 'interacao' | 'sem_script' | 'sem_widget' | `erro_${string}`

export interface ResultadoToken {
  token: string | null
  /** So quando token e null. */
  motivo: MotivoSemToken | null
  /** Quanto o envio esperou pelo token (0 = ja estava pronto). */
  esperaMs: number
}

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

/** Codigo de erro do Turnstile so com digitos (nunca texto livre no payload). */
function codigoErro(c: unknown): string {
  const d = String(c ?? '').replace(/\D/g, '').slice(0, 6)
  return d || 'x'
}

/**
 * Estado do token, sem DOM (testavel). O widget chama os on*; o envio chama
 * esperar(); consumir() entrega o token uma vez.
 */
export function criarEstadoToken(agora: () => number = Date.now) {
  let token: string | null = null
  let tokenEm = 0
  let interacao = false
  let erro: string | null = null
  let espera: Array<() => void> = []
  const acordar = () => { const fs = espera; espera = []; for (const f of fs) f() }

  const fresco = () => !!token && agora() - tokenEm < TURNSTILE_TOKEN_MAX_MS

  return {
    onToken(t: string) { token = t; tokenEm = agora(); interacao = false; erro = null; acordar() },
    onExpirado() { token = null; acordar() },
    onErro(c: unknown) { erro = `erro_${codigoErro(c)}`; acordar() },
    onInteracao() { interacao = true; acordar() },
    onInteracaoFim() { interacao = false },
    /** Novo desafio comecou (reset): o token anterior ja foi usado. */
    onReset() { token = null; erro = null; interacao = false },
    get interacao() { return interacao },
    get erro() { return erro },
    /** Entrega o token fresco uma unica vez. */
    consumir(): string | null {
      if (!fresco()) return null
      const t = token
      token = null
      return t
    },
    /**
     * Espera ate haver token fresco ou o prazo acabar. O prazo cresce pra
     * TURNSTILE_ESPERA_INTERACAO_MS se a Cloudflare pedir interacao.
     */
    esperar(dormir: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<void> {
      const inicio = agora()
      return new Promise<void>((resolve) => {
        let feito = false
        const fim = () => { if (!feito) { feito = true; resolve() } }
        const checar = () => {
          if (feito) return
          if (fresco()) return fim()
          const prazo = interacao ? TURNSTILE_ESPERA_INTERACAO_MS : erro ? TURNSTILE_ESPERA_ERRO_MS : TURNSTILE_ESPERA_MS
          const resta = prazo - (agora() - inicio)
          if (resta <= 0) return fim()
          espera.push(checar)
          // Acorda no prazo mesmo sem evento do widget.
          dormir(Math.min(resta, 1000)).then(checar)
        }
        checar()
      })
    },
  }
}

export function useTurnstile() {
  const config = useRuntimeConfig()
  const siteKey = String(config.public?.turnstileSiteKey || '')
  const container = ref<HTMLElement | null>(null)
  const estado = criarEstadoToken()
  let widgetId: string | null = null
  let scriptFalhou = false

  async function montar(): Promise<boolean> {
    if (!import.meta.client || !siteKey || !container.value) return false
    if (widgetId) return true
    let ts: any
    try {
      ts = await carregarScript()
      scriptFalhou = false
    } catch {
      scriptFalhou = true
      return false
    }
    if (!container.value || widgetId) return !!widgetId
    widgetId = ts.render(container.value, {
      sitekey: siteKey,
      // Roda ja na montagem: o token fica pronto enquanto a pessoa digita.
      execution: 'render',
      // So aparece se a Cloudflare pedir interacao.
      appearance: 'interaction-only',
      action: 'consulta',
      language: 'pt-br',
      // Token parado na tela expira em 300 s: renova sozinho.
      'refresh-expired': 'auto',
      retry: 'auto',
      callback: (token: string) => estado.onToken(token),
      'error-callback': (c: unknown) => { estado.onErro(c); return true },
      'expired-callback': () => estado.onExpirado(),
      'timeout-callback': () => estado.onExpirado(),
      'before-interactive-callback': () => estado.onInteracao(),
      'after-interactive-callback': () => estado.onInteracaoFim(),
    })
    return true
  }

  /** Carrega o script e monta o widget, que ja gera o primeiro token (onMounted). Nunca lanca. */
  function preparar() {
    montar().catch(() => {})
  }

  /** Reseta o widget: gera o proximo token em segundo plano. */
  function renovar() {
    const ts = (window as any).turnstile
    if (!widgetId || !ts) return
    estado.onReset()
    try { ts.reset(widgetId) } catch { /* widget ja removido */ }
  }

  /**
   * Token pra uma consulta. Usa o que ja esta pronto; senao espera (ate 8 s,
   * ou 25 s com a caixinha na tela). Consome e ja renova pro proximo envio.
   * Nunca lanca.
   */
  async function obterToken(): Promise<ResultadoToken> {
    if (!import.meta.client || !siteKey) return { token: null, motivo: null, esperaMs: 0 }
    const inicio = Date.now()
    try {
      let token = estado.consumir()
      if (!token) {
        // Script ainda nao montou (rede lenta, clique logo na abertura): tenta de novo agora.
        const montado = await Promise.race([
          montar().catch(() => false),
          new Promise<boolean>((r) => setTimeout(() => r(false), TURNSTILE_ESPERA_MS)),
        ])
        if (!montado || !widgetId) {
          return { token: null, motivo: scriptFalhou ? 'sem_script' : 'sem_widget', esperaMs: Date.now() - inicio }
        }
        await estado.esperar()
        token = estado.consumir()
      }
      const esperaMs = Date.now() - inicio
      if (token) {
        renovar()
        return { token, motivo: null, esperaMs }
      }
      const motivo: MotivoSemToken = estado.interacao ? 'interacao' : (estado.erro as MotivoSemToken | null) || 'timeout'
      return { token: null, motivo, esperaMs }
    } catch {
      return { token: null, motivo: 'timeout', esperaMs: Date.now() - inicio }
    }
  }

  onBeforeUnmount(() => {
    const ts = (window as any).turnstile
    if (widgetId && ts) {
      try { ts.remove(widgetId) } catch { /* nada */ }
    }
    widgetId = null
  })

  return { container, preparar, obterToken, ativo: !!siteKey }
}

/** Campos do POST /api/consulta a partir do resultado (token ou motivo + espera). */
export function camposTurnstile(r: ResultadoToken | null | undefined): Record<string, unknown> {
  if (!r) return {}
  if (r.token) return { turnstileToken: r.token, turnstileEsperaMs: Math.round(r.esperaMs) }
  if (!r.motivo) return {}
  return { turnstileMotivo: r.motivo, turnstileEsperaMs: Math.round(r.esperaMs) }
}
