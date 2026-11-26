// Presence on the site for the office TV ("Agora no site"): how many tabs are
// open right now and on which page.
//
// Only two things leave the browser: a random id for the tab and the page
// reduced to its route pattern. The reduction below is the same on both
// sides: the client plugin (plugins/presenca.client.ts) runs it before
// sending, and the server (server/api/presenca) runs it again on whatever
// arrives, so a hand-made request cannot store anything else.
//
// - No query string and no hash, ever.
// - A dynamic segment becomes its parameter name: /placa/ABC1D23 is
//   "/placa/:placa", /premium/<token> is "/premium/:token". The value is
//   dropped, never stored, never compared.
// - A path that is not one of the routes below becomes "outra".
// - "checkout" is the one key that is not a path: the checkout overlay is
//   open over the page (it has no route of its own).
//
// The output is always one of the strings of ROTAS_PRESENCA, "checkout" or
// "outra": nothing typed by the visitor can come out of here.

/**
 * Route patterns of the site's pages: pages/ plus /placa/:placa
 * (app/router.options.ts). Static routes come before dynamic ones of the same
 * depth, so /carro-de-leilao/como-saber is not taken for a model slug.
 * English pages (/en/...) count under the same pattern as the Portuguese one.
 */
export const ROTAS_PRESENCA = [
  '/',
  '/placa/:placa',
  '/premium',
  '/premium/:token',
  '/feedback/:token',
  '/blog',
  '/blog/:slug',
  '/blog/tag/:tag',
  '/carro-de-leilao',
  '/carro-de-leilao/como-saber',
  '/carro-de-leilao/:slug',
  '/como-consultar-placa',
  '/como-saber-se-o-carro-e-roubado',
  '/consulta-gratis',
  '/consulta-leilao-veiculo',
  '/consulta-placa',
  '/consulta-veicular-completa',
  '/consultar-placa',
  '/consultar-placa-de-:tipo',
  '/consultar-placa/:estado',
  '/consultar-placa/capital/:slug',
  '/consultar',
  '/consultar/:tema',
  '/contato',
  '/estudos',
  '/historico-veicular',
  '/laudo-cautelar',
  '/o-que-e',
  '/o-que-e/:slug',
  '/para-empresas',
  '/parceiro',
  '/parceiro/entrar',
  '/politica-de-privacidade',
  '/seguro/carro-eletrico',
  '/seguro/carro-eletrico/:estado',
  '/sobre',
  '/tabela-fipe',
  '/tabela-fipe/:slug',
  '/tabela-fipe-por-placa',
  '/termos-de-uso',
] as const

export const PAGINA_CHECKOUT = 'checkout'
export const PAGINA_OUTRA = 'outra'

export type RotaPresenca = (typeof ROTAS_PRESENCA)[number]
export type PaginaPresenca = RotaPresenca | typeof PAGINA_CHECKOUT | typeof PAGINA_OUTRA

/** While the tab is visible, it says where it is this often. */
export const PRESENCA_INTERVALO_MS = 30_000
/** Client side: two sends are never closer than this (a burst of route changes becomes one send). */
export const PRESENCA_MIN_ENVIO_MS = 10_000

// No route of ours is longer than this or deeper than 3 segments.
const TAMANHO_MAXIMO = 300
const SEGMENTOS_MAXIMOS = 4

type Segmento = { fixo: string } | { prefixo: string }
const MOLDES: { rota: RotaPresenca; segmentos: Segmento[] }[] = ROTAS_PRESENCA.map((rota) => ({
  rota,
  segmentos: rota.split('/').filter(Boolean).map((s): Segmento => {
    const i = s.indexOf(':')
    return i === -1 ? { fixo: s } : { prefixo: s.slice(0, i) }
  }),
}))

/** A dynamic segment takes any non-empty value after its fixed prefix (usually none). */
function casa(segmento: Segmento, valor: string): boolean {
  return 'fixo' in segmento ? segmento.fixo === valor : valor.length > segmento.prefixo.length && valor.startsWith(segmento.prefixo)
}

/** Path (or route pattern) -> route pattern, or "outra". */
export function normalizarCaminho(bruto: unknown): RotaPresenca | typeof PAGINA_OUTRA {
  if (typeof bruto !== 'string' || bruto.length > TAMANHO_MAXIMO) return PAGINA_OUTRA
  const fim = bruto.search(/[?#]/)
  const caminho = (fim === -1 ? bruto : bruto.slice(0, fim)).toLowerCase()
  if (!caminho.startsWith('/')) return PAGINA_OUTRA
  let partes = caminho.split('/').filter(Boolean)
  if (partes[0] === 'en') partes = partes.slice(1)
  if (partes.length > SEGMENTOS_MAXIMOS) return PAGINA_OUTRA
  const molde = MOLDES.find((m) => m.segmentos.length === partes.length && m.segmentos.every((s, i) => casa(s, partes[i])))
  return molde ? molde.rota : PAGINA_OUTRA
}

/** What the server accepts as the page of a tab: "checkout", or a path normalized again. */
export function paginaPresenca(bruto: unknown): PaginaPresenca {
  return bruto === PAGINA_CHECKOUT ? PAGINA_CHECKOUT : normalizarCaminho(bruto)
}

const ID_VALIDO = /^[A-Za-z0-9_-]{16,64}$/

/** The tab id is random (32 hex characters from the client); anything else is ignored. */
export function idPresencaValido(v: unknown): v is string {
  return typeof v === 'string' && ID_VALIDO.test(v)
}

/** A new random tab id: 16 random bytes in hex. */
export function novoIdPresenca(): string {
  const bytes = new Uint8Array(16)
  try {
    globalThis.crypto.getRandomValues(bytes)
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

type Temporizador = ReturnType<typeof setTimeout>

/**
 * The client's schedule, apart from the browser so it can be tested.
 * `cutucar` (route change, tab visible again, first send): send now, or as
 * soon as PRESENCA_MIN_ENVIO_MS since the last send allows; the page is read
 * when the send happens, so a burst of changes sends the last one. After each
 * send the next one comes PRESENCA_INTERVALO_MS later, while the tab stays
 * visible. `parar` (tab hidden or closed): no more sends until the next
 * `cutucar`; the server forgets the tab on its own after a while.
 */
export function criarEmissorPresenca(deps: {
  id: string
  pagina: () => PaginaPresenca
  enviar: (corpo: string) => void
  visivel: () => boolean
  agora?: () => number
  agendar?: (f: () => void, ms: number) => Temporizador
  cancelar?: (t: Temporizador) => void
}) {
  const agora = deps.agora ?? Date.now
  const agendar = deps.agendar ?? ((f, ms) => setTimeout(f, ms))
  const cancelar = deps.cancelar ?? ((t) => clearTimeout(t))
  let ultimo = -Infinity
  let timer: Temporizador | null = null

  // Every step is inside try/catch: presence never throws into the page. A
  // send that fails does not schedule the next one; the next route change or
  // the tab coming back tries again.
  const parar = () => {
    try {
      if (timer !== null) cancelar(timer)
    } catch { /* nothing to undo */ }
    timer = null
  }
  const disparar = () => {
    timer = null
    try {
      if (!deps.visivel()) return
      ultimo = agora()
      deps.enviar(JSON.stringify({ id: deps.id, pagina: deps.pagina() }))
      timer = agendar(disparar, PRESENCA_INTERVALO_MS)
    } catch { /* presence never breaks a page */ }
  }
  const cutucar = () => {
    try {
      if (!deps.visivel()) return
      parar()
      timer = agendar(disparar, Math.max(0, ultimo + PRESENCA_MIN_ENVIO_MS - agora()))
    } catch { /* idem */ }
  }
  return { cutucar, parar }
}
