/**
 * Recuperacao de compras do Google Play que o app nao viu terminar.
 *
 * Por que existe: a Play pode devolver "pendente" pro app (Pix/boleto da loja).
 * O servidor conclui sozinho pela notificacao (RTDN) e consome a compra, mas o
 * app nunca recebe o token de entrega: nada em "Suas consultas", nenhum
 * e-mail. Aconteceu com as duas primeiras vendas do app (out/2026).
 *
 * Como: o app guarda nativamente cada compra iniciada e expoe a lista pela
 * ponte abaixo. Aqui, no modo app, a gente pergunta ao servidor por cada uma
 * (/api/premium/google-play/pedido) e, quando o pedido existe, poe em "Suas
 * consultas", avisa a pessoa e manda o app esquecer a compra.
 *
 * Contrato da ponte (camada nativa, combinado com o app):
 *   window.AndroidBillingBridge.listPurchases(): string
 *     JSON de [{ purchaseToken, orderId, productId, placa, savedAt }]
 *     (savedAt em ms desde a epoca; ISO tambem e aceito)
 *   window.AndroidBillingBridge.removePurchase(purchaseToken: string): void
 *     idempotente; token desconhecido nao e erro.
 * Versao antiga do app sem a ponte: tudo aqui vira no-op, em silencio.
 *
 * Eventos que o app dispara em window (CustomEvent), atalhos do polling:
 *   'pc-play-compra-pendente'  detail { placa, purchaseToken, orderId }
 *     -> cria/liga o item "Processando" e comeca a perguntar ja.
 *   'pc-play-relatorio-pronto' detail { token_entrega, placa, purchaseToken }
 *     -> conclui na hora (Suas consultas + removePurchase + aviso).
 * Nada depende deles: sem evento, o polling chega no mesmo lugar.
 */
import type { ConsultaLocal } from './useConsultaHistory'

export interface CompraGuardada {
  purchaseToken: string
  orderId?: string | null
  productId?: string | null
  placa?: string | null
  savedAt?: number | string | null
}

export interface PonteBillingAndroid {
  listPurchases: () => string
  removePurchase: (purchaseToken: string) => void
}

declare global {
  interface Window {
    AndroidBillingBridge?: Partial<PonteBillingAndroid>
  }
}

/** Status do item provisorio em "Suas consultas" enquanto a Play nao confirma. */
export const STATUS_PROCESSANDO_PLAY = 'processando_play'
/** Prefixo do token provisorio (nao e token de entrega: nao abre relatorio). */
export const PREFIXO_PROVISORIO = 'play:'
/** Compra que o servidor nao conhece depois disto e lixo do app: esquece. */
export const DESCONHECIDA_ESQUECE_MS = 24 * 60 * 60 * 1000

export type RespostaPedidoPlay =
  | { tipo: 'pronto'; token: string; status: string; placa: string | null }
  | { tipo: 'pendente' }
  | { tipo: 'cancelada' }
  | { tipo: 'desconhecida' }
  | { tipo: 'erro' }

// ---------------------------------------------------------------- ponte

export function ponteBilling(): PonteBillingAndroid | null {
  if (typeof window === 'undefined') return null
  const p = window.AndroidBillingBridge
  return p && typeof p.listPurchases === 'function' && typeof p.removePurchase === 'function'
    ? (p as PonteBillingAndroid)
    : null
}

/** Le a lista do app. Qualquer coisa torta vira lista vazia. */
export function lerComprasGuardadas(ponte: PonteBillingAndroid | null = ponteBilling()): CompraGuardada[] {
  if (!ponte) return []
  try {
    const arr = JSON.parse(String(ponte.listPurchases() || '[]'))
    return Array.isArray(arr) ? arr.filter((c) => c && typeof c.purchaseToken === 'string' && c.purchaseToken) : []
  } catch {
    return []
  }
}

export function esquecerCompra(purchaseToken: string, ponte: PonteBillingAndroid | null = ponteBilling()) {
  try { ponte?.removePurchase(purchaseToken) } catch { /* app antigo ou ponte instavel: tenta de novo na proxima */ }
}

export function placaLimpa(v: unknown): string {
  return String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
}

export function savedAtMs(v: CompraGuardada['savedAt']): number {
  if (typeof v === 'number') return v
  const n = Date.parse(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

/** Compra mais recente que o app guardou pra esta placa. */
export function compraDaPlaca(placa: string, ponte: PonteBillingAndroid | null = ponteBilling()): CompraGuardada | null {
  const p = placaLimpa(placa)
  const daPlaca = lerComprasGuardadas(ponte).filter((c) => placaLimpa(c.placa) === p)
  daPlaca.sort((a, b) => savedAtMs(b.savedAt) - savedAtMs(a.savedAt))
  return daPlaca[0] || null
}

// ---------------------------------------------------------------- servidor

/**
 * Pergunta ao servidor pelo pedido da compra. Com e-mail vai por POST, que de
 * quebra grava o e-mail no pedido criado pela notificacao da Play (sem e-mail)
 * e dispara a entrega; o servidor nunca troca um e-mail ja gravado.
 */
export async function consultarPedidoPlay(purchaseToken: string, email?: string | null): Promise<RespostaPedidoPlay> {
  try {
    const em = emailValido(email) ? String(email).trim() : ''
    const r: any = em
      ? await $fetch('/api/premium/google-play/pedido', { method: 'POST', body: { purchaseToken, email: em } })
      : await $fetch('/api/premium/google-play/pedido', { query: { purchaseToken } })
    if (r?.token_entrega) return { tipo: 'pronto', token: r.token_entrega, status: String(r.status || 'pago'), placa: r.placa ?? null }
    if (r?.pendente) return { tipo: 'pendente' }
    return { tipo: 'erro' }
  } catch (e: any) {
    const s = e?.statusCode ?? e?.response?.status
    if (s === 404) return { tipo: 'desconhecida' }
    if (s === 410) return { tipo: 'cancelada' }
    return { tipo: 'erro' }
  }
}

export function emailValido(v: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim())
}

// ---------------------------------------------------------------- historico

export const ehProvisorio = (it: Pick<ConsultaLocal, 'token'>) => it.token.startsWith(PREFIXO_PROVISORIO)

/** O item provisorio de "Suas consultas" que corresponde a esta compra. */
export function provisorioDaCompra(itens: ConsultaLocal[], c: CompraGuardada): ConsultaLocal | null {
  const ids = [c.orderId, c.purchaseToken].filter(Boolean).map((x) => PREFIXO_PROVISORIO + x)
  return itens.find((it) => ids.includes(it.token))
    || itens.find((it) => ehProvisorio(it) && it.status === STATUS_PROCESSANDO_PLAY && it.placa === placaLimpa(c.placa))
    || null
}

export interface HistoricoDeps {
  ler: () => ConsultaLocal[]
  add: (e: { token: string; placa: string; veiculo?: string | null; status?: string }) => void
  updateStatus: (token: string, status: string) => void
  remove: (token: string) => void
}

/** Poe o pedido real em "Suas consultas", trocando o provisorio se houver. */
export function registrarPronto(h: HistoricoDeps, c: CompraGuardada, r: { token: string; status: string; placa: string | null }) {
  const itens = h.ler()
  const prov = provisorioDaCompra(itens, c)
  const placa = placaLimpa(r.placa || c.placa || prov?.placa)
  const ja = itens.find((it) => it.token === r.token)
  if (ja) h.updateStatus(r.token, r.status)
  else h.add({ token: r.token, placa, veiculo: prov?.veiculo ?? null, status: r.status })
  if (prov && prov.token !== r.token) h.remove(prov.token)
}

// ---------------------------------------------------------------- eventos do app

export const EVENTO_PENDENTE = 'pc-play-compra-pendente'
export const EVENTO_PRONTO = 'pc-play-relatorio-pronto'

export interface DetalhePendente { placa?: string | null; purchaseToken?: string | null; orderId?: string | null }
export interface DetalhePronto { token_entrega?: string | null; placa?: string | null; purchaseToken?: string | null }

/**
 * Compra pendente avisada pelo app: garante o item "Processando" em Suas
 * consultas (sem duplicar o que o checkout ja criou pra mesma placa).
 */
export function aoCompraPendente(h: HistoricoDeps, d: DetalhePendente): string | null {
  const placa = placaLimpa(d?.placa)
  if (!d?.purchaseToken && !d?.orderId && placa.length < 7) return null
  const c: CompraGuardada = { purchaseToken: String(d.purchaseToken || ''), orderId: d.orderId ?? null, placa }
  const ja = provisorioDaCompra(h.ler(), c)
  if (ja) return ja.token
  const token = PREFIXO_PROVISORIO + (d.orderId || d.purchaseToken || `${placa}-${Date.now()}`)
  h.add({ token, placa, status: STATUS_PROCESSANDO_PLAY })
  return token
}

/** Relatorio pronto avisado pelo app: mesmo efeito de um 200 do /pedido. */
export function aoRelatorioPronto(h: HistoricoDeps, d: DetalhePronto, ponte: PonteBillingAndroid | null): { token: string; placa: string } | null {
  const token = String(d?.token_entrega || '')
  if (!token) return null
  const c: CompraGuardada = { purchaseToken: String(d.purchaseToken || ''), placa: d.placa ?? null }
  const ja = h.ler().find((it) => it.token === token)
  registrarPronto(h, c, { token, status: ja?.status && ja.status !== STATUS_PROCESSANDO_PLAY ? ja.status : 'pago', placa: d.placa ?? null })
  if (d.purchaseToken) esquecerCompra(d.purchaseToken, ponte)
  return { token, placa: placaLimpa(d.placa) }
}

// ---------------------------------------------------------------- rodada

export interface DepsRecuperacao {
  ponte: PonteBillingAndroid | null
  consultar: (purchaseToken: string, email?: string | null) => Promise<RespostaPedidoPlay>
  historico: HistoricoDeps
  email?: string | null
  agora?: number
}

export interface ResultadoRodada {
  prontos: { token: string; placa: string }[]
  pendentes: number
}

/**
 * Uma passada por todas as compras que o app guardou. Pura o bastante pra
 * testar: ponte, servidor e historico chegam de fora.
 */
export async function rodarRecuperacao(d: DepsRecuperacao): Promise<ResultadoRodada> {
  const agora = d.agora ?? Date.now()
  const out: ResultadoRodada = { prontos: [], pendentes: 0 }
  for (const c of lerComprasGuardadas(d.ponte)) {
    const r = await d.consultar(c.purchaseToken, d.email)
    if (r.tipo === 'pronto') {
      registrarPronto(d.historico, c, r)
      esquecerCompra(c.purchaseToken, d.ponte)
      out.prontos.push({ token: r.token, placa: placaLimpa(r.placa || c.placa) })
    } else if (r.tipo === 'cancelada') {
      // A Play recusou de vez: o provisorio nao vai virar relatorio.
      const prov = provisorioDaCompra(d.historico.ler(), c)
      if (prov) d.historico.remove(prov.token)
      esquecerCompra(c.purchaseToken, d.ponte)
    } else if (r.tipo === 'desconhecida') {
      const salvo = savedAtMs(c.savedAt)
      // A RTDN/o app podem demorar pra registrar: so desiste depois de 24 h.
      if (salvo && agora - salvo > DESCONHECIDA_ESQUECE_MS) esquecerCompra(c.purchaseToken, d.ponte)
      else out.pendentes++
    } else {
      out.pendentes++
    }
  }
  return out
}

/**
 * Intervalo entre perguntas enquanto ha pendencia. Comeca no ritmo pedido
 * (base) e espaca com o tempo: Pix da Play costuma cair em minutos, boleto em
 * dias, e o rate limit da rota e por IP (120/h).
 */
export function proximoIntervalo(baseMs: number, desdeMs: number): number {
  if (desdeMs < 2 * 60_000) return baseMs
  if (desdeMs < 10 * 60_000) return Math.max(baseMs, 20_000)
  return 60_000
}

// ---------------------------------------------------------------- composable

let timer: ReturnType<typeof setTimeout> | null = null
let rodando = false
let pendenteDesde = 0
let ouvindo = false

export function useRecuperacaoPlay() {
  /** Relatorio que ficou pronto fora da tela de compra: vira o aviso. */
  const aviso = useState<{ token: string; placa: string } | null>('pc-play-aviso', () => null)
  /** Checkout aberto no app: ele cuida da propria compra, sem aviso por cima. */
  const checkoutAberto = useState<boolean>('pc-play-checkout-aberto', () => false)
  /** Ultima compra pendente que o app anunciou (o checkout usa o comprovante). */
  const ultimoPendente = useState<DetalhePendente | null>('pc-play-ultimo-pendente', () => null)
  const historico = useConsultaHistory()
  const hist: HistoricoDeps = {
    ler: () => { historico.sync(); return historico.itens.value },
    add: historico.add,
    updateStatus: historico.updateStatus,
    remove: historico.remove,
  }

  function deps(): DepsRecuperacao {
    return { ponte: ponteBilling(), consultar: consultarPedidoPlay, historico: hist, email: emailGuardado() }
  }

  function onPendente(ev: Event) {
    const d = ((ev as CustomEvent).detail || {}) as DetalhePendente
    ultimoPendente.value = { placa: placaLimpa(d.placa), purchaseToken: d.purchaseToken || null, orderId: d.orderId || null }
    // Com o checkout aberto, quem cria o item e espera e ele.
    if (checkoutAberto.value) return
    aoCompraPendente(hist, d)
    agendar(true)
  }

  function onPronto(ev: Event) {
    const d = ((ev as CustomEvent).detail || {}) as DetalhePronto
    const r = aoRelatorioPronto(hist, d, ponteBilling())
    if (r && ultimoPendente.value && (ultimoPendente.value.purchaseToken === d.purchaseToken || ultimoPendente.value.placa === r.placa)) ultimoPendente.value = null
    if (r && !checkoutAberto.value) aviso.value = r
  }

  async function verificar(): Promise<ResultadoRodada | null> {
    if (!ponteBilling() || rodando) return null
    rodando = true
    try {
      const r = await rodarRecuperacao(deps())
      if (r.prontos.length && !checkoutAberto.value) aviso.value = r.prontos[0]
      agendar(r.pendentes > 0)
      return r
    } finally {
      rodando = false
    }
  }

  function agendar(haPendencia: boolean) {
    if (timer) { clearTimeout(timer); timer = null }
    if (!haPendencia) { pendenteDesde = 0; return }
    if (!pendenteDesde) pendenteDesde = Date.now()
    timer = setTimeout(() => {
      timer = null
      // Com o checkout aberto quem pergunta e ele (e e ele que abre o relatorio).
      if (checkoutAberto.value || document.visibilityState === 'hidden') agendar(true)
      else verificar()
    }, proximoIntervalo(10_000, Date.now() - pendenteDesde))
  }

  /** Liga a recuperacao: chamar no onMounted de quem vive em toda rota. */
  function iniciar() {
    if (typeof window === 'undefined') return
    if (!ouvindo) {
      ouvindo = true
      window.addEventListener(EVENTO_PENDENTE, onPendente)
      window.addEventListener(EVENTO_PRONTO, onPronto)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !checkoutAberto.value) verificar()
      })
    }
    if (!ponteBilling()) return
    if (!checkoutAberto.value) verificar()
  }

  return { aviso, checkoutAberto, ultimoPendente, verificar, iniciar, disponivel: () => !!ponteBilling() }
}

/** E-mail que a pessoa ja digitou neste aparelho (checkout do app ou consulta gratis). */
export function emailGuardado(): string | null {
  try {
    const e = localStorage.getItem('pc_email') || localStorage.getItem('pwa_email')
    return emailValido(e) ? String(e).trim() : null
  } catch {
    return null
  }
}
