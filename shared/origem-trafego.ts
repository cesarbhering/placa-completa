// Origem de trafego (marcas de anuncio) que viaja do client pro servidor.
//
// O plugin track-origin grava isto em sessionStorage assim que a pessoa cai no
// site; a consulta gratis e o checkout pago leem daqui. Ficar em shared/ evita
// a terceira copia do mesmo saneamento: a lista de campos e os limites de
// tamanho passam a existir num lugar so.

export interface OrigemTrafego {
  gclid: string | null
  msclkid: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  /** OpenAI Ads (ChatGPT): id de atribuicao do clique, vem na URL (?oppref=). */
  oppref: string | null
  /** OpenAI Ads: cookie __obref do pixel (referencia do navegador). */
  obref: string | null
  /**
   * true quando a marca de anuncio NAO veio na URL desta visita: foi lembrada
   * de um clique em anuncio nos ultimos 30 dias (localStorage). Separa "clicou
   * no anuncio agora" de "voltou depois por conta propria".
   */
  origem_retorno: boolean
}

/** Campos lidos da URL, na ordem em que aparecem na tabela. */
export const CAMPOS_ORIGEM = ['gclid', 'msclkid', 'utm_source', 'utm_medium', 'utm_campaign', 'oppref'] as const

const LIMITES: Record<(typeof CAMPOS_ORIGEM)[number], number> = {
  gclid: 200,
  msclkid: 200,
  utm_source: 100,
  utm_medium: 100,
  utm_campaign: 150,
  oppref: 1000,
}

/**
 * oppref e obref vao pra OpenAI SEM alteracao (regra da API): nunca truncar.
 * Grande demais ou com caractere estranho vira null.
 */
function opaco(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s && s.length <= 1000 && /^[\x21-\x7e]+$/.test(s) ? s : null
}

/**
 * Normaliza o que veio do client num objeto pronto pro insert: so os campos
 * conhecidos, so string, cada um no seu limite. Qualquer outra coisa vira null,
 * entao um payload adulterado nao entra no banco.
 */
export function sanearOrigem(bruto: unknown): OrigemTrafego {
  const o = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  const saida = {} as OrigemTrafego
  for (const campo of CAMPOS_ORIGEM) {
    if (campo === 'oppref') continue
    const v = o[campo]
    saida[campo] = typeof v === 'string' && v.trim() ? v.slice(0, LIMITES[campo]) : null
  }
  saida.oppref = opaco(o.oppref)
  saida.obref = opaco(o.obref)
  // So vale com marca de anuncio junto: sozinho nao diz nada.
  const temMarca = CAMPOS_ORIGEM.some((c) => saida[c] !== null)
  saida.origem_retorno = temMarca && (o.origem_retorno === true || o.origem_retorno === '1' || o.origem_retorno === 'true')
  return saida
}

// ---------- oppref do cookie __oppref (SDK oaiq, 30 dias) ----------
// Quem clicou no anuncio do ChatGPT num dia e voltou depois por outro caminho
// (ChatGPT organico, direto) chegava no checkout sem oppref na sessao: a
// OpenAI contava a venda e nos nao. O SDK oaiq grava o clique no cookie
// __oppref (Max-Age 30 dias, sem HttpOnly, Path=/, dominio do site), que vai
// no request do checkout. Prioridade: oppref da sessao (link) > cookie, e o
// do cookie so vale com clique de ate 30 dias (hora dentro do token).
// O oppref e id de clique, nao dado pessoal; nenhum outro cookie e gravado.

export const COOKIE_OPPREF = '__oppref'

export type OpprefOrigem = 'link' | 'cookie'

/**
 * oppref final do pedido e de onde veio. 'link' = veio na origem da sessao
 * (URL desta visita ou clique lembrado, ver origem_retorno); 'cookie' = so o
 * cookie __oppref tinha. Sem nenhum dos dois: null/null.
 */
export function opprefDoPedido(
  origem: Pick<OrigemTrafego, 'oppref'>,
  cookie: unknown,
  agora = Date.now(),
): { oppref: string | null; oppref_origem: OpprefOrigem | null } {
  if (origem.oppref) return { oppref: origem.oppref, oppref_origem: 'link' }
  const doCookie = opaco(cookie)
  // Janela de atribuicao da OpenAI: clique ate 30 dias (regra do Cesar 27/out).
  // O oppref e um token Fernet com a hora do clique; mais velho que 30 dias nao
  // vale. Sem hora legivel, vale a validade do proprio cookie (30 dias no SDK).
  const clique = doCookie ? horaDoOppref(doCookie) : null
  if (!doCookie || (clique !== null && agora - clique > OPPREF_JANELA_MS)) return { oppref: null, oppref_origem: null }
  return { oppref: doCookie, oppref_origem: 'cookie' }
}

export const OPPREF_JANELA_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Hora do clique (ms) gravada no oppref. O oppref da OpenAI e um token Fernet
 * (base64url, comeca com "gAAAAA"): byte 0x80 + 8 bytes big-endian com os
 * segundos da emissao. Formato desconhecido: null.
 */
export function horaDoOppref(oppref: string): number | null {
  if (!/^gAAAAA[A-Za-z0-9_-]{6}/.test(oppref)) return null
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  // 12 caracteres base64 = 9 bytes (versao + timestamp).
  const bytes: number[] = []
  for (let i = 0; i < 12; i += 4) {
    const n = oppref.slice(i, i + 4).split('').reduce((acc, c) => acc * 64 + alfabeto.indexOf(c), 0)
    bytes.push((n >> 16) & 255, (n >> 8) & 255, n & 255)
  }
  if (bytes[0] !== 0x80) return null
  let seg = 0
  for (let i = 1; i <= 8; i++) seg = seg * 256 + bytes[i]
  return Number.isFinite(seg) && seg > 0 ? seg * 1000 : null
}

// ---------- Origem de anuncio lembrada por 30 dias ----------
// sessionStorage morre com a aba: quem clicou no anuncio e voltou dias depois
// (digitando o endereco, pelo Google organico etc.) comprava sem origem e a
// venda nao era atribuida ao anuncio. Agora o clique em anuncio tambem vai pro
// localStorage com a data; numa sessao nova SEM marca na URL, a origem lembrada
// volta com origem_retorno = '1'. Vale 30 dias contados do clique (nao renova
// por visita). Um clique novo em anuncio substitui o anterior (ultimo clique).

export const CHAVE_ORIGEM_30D = 'pc_origin_30d'
export const ORIGEM_LEMBRADA_MS = 30 * 24 * 60 * 60 * 1000

type Armazenamento = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** E clique de anuncio (id de clique ou utm de midia paga)? utm de e-mail/social nao conta. */
export function ehOrigemDeAnuncio(o: Record<string, string> | undefined | null): boolean {
  if (!o) return false
  if (o.gclid || o.msclkid || o.oppref) return true
  return /^(cpc|ppc|paid|paidsearch|paid_search)$/i.test(o.utm_medium || '')
}

/** Guarda a origem de um clique em anuncio por 30 dias. Outra origem e ignorada. */
export function lembrarOrigem(ls: Armazenamento, origem: Record<string, string>, agora = Date.now()): void {
  if (!ehOrigemDeAnuncio(origem)) return
  ls.setItem(CHAVE_ORIGEM_30D, JSON.stringify({ origem, em: agora }))
}

/**
 * Origem lembrada (sem marcar retorno), ou undefined se nao houver, estiver
 * corrompida ou passou de 30 dias (nesses casos apaga).
 */
export function origemLembrada(ls: Armazenamento, agora = Date.now()): Record<string, string> | undefined {
  const raw = ls.getItem(CHAVE_ORIGEM_30D)
  if (!raw) return undefined
  try {
    const { origem, em } = JSON.parse(raw)
    if (typeof em === 'number' && agora - em >= 0 && agora - em <= ORIGEM_LEMBRADA_MS && ehOrigemDeAnuncio(origem)) {
      const limpa: Record<string, string> = {}
      for (const c of CAMPOS_ORIGEM) if (typeof origem[c] === 'string' && origem[c]) limpa[c] = origem[c]
      return limpa
    }
  } catch {
    // corrompido: cai no apagar
  }
  ls.removeItem(CHAVE_ORIGEM_30D)
  return undefined
}

/** Cookie __obref do pixel da OpenAI, se existir. Client-side. */
export function obrefDoCookie(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)__obref=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : null
  } catch {
    return null
  }
}

/** Le a origem guardada pelo plugin track-origin. Client-side. */
export function origemDaSessao(): Record<string, string> | undefined {
  let origem: Record<string, string> | undefined
  try {
    const raw = sessionStorage.getItem('pc_origin')
    origem = raw ? JSON.parse(raw) : undefined
  } catch {
    origem = undefined
  }
  // obref e lido na HORA (o pixel cria o cookie depois que carrega, e ele dura
  // 365 dias): vai junto da consulta e do checkout pelo mesmo caminho do gclid.
  const obref = typeof document !== 'undefined' ? obrefDoCookie() : null
  return obref ? { ...(origem || {}), obref } : origem
}

// ---------- Pagina de entrada e referrer (plano SEO 02/out, item #13) ----------
// Sem isto nao da pra separar organico de direto nas vendas. Capturado no
// PRIMEIRO acesso da sessao (plugin track-origin) e enviado junto da consulta
// gratis; vai pra consultas.referrer e consultas.landing_path. Do referrer so
// o host (sem path nem query, que podem trazer termo de busca ou id de
// terceiro); da entrada so o path.

export interface EntradaSessao { referrer: string | null; landing_path: string | null }

const NOSSOS_HOSTS = /(^|\.)placacompleta\.com\.br$|(^|\.)olhona(moto|caminhao)\.com\.br$/i

export function referrerLimpo(ref: unknown): string | null {
  if (typeof ref !== 'string' || !ref) return null
  let u: URL
  try { u = new URL(ref) } catch { return null }
  if (!/^https?:$/.test(u.protocol)) return null
  if (NOSSOS_HOSTS.test(u.hostname)) return null
  // So o host: o path de alguns referrers carrega id de conversa/sessao.
  return `${u.protocol}//${u.hostname}`.slice(0, 300)
}

export function pathLimpo(p: unknown): string | null {
  if (typeof p !== 'string' || !p.startsWith('/')) return null
  return p.split('?')[0].split('#')[0].slice(0, 200) || null
}

export function sanearEntrada(bruto: unknown): EntradaSessao {
  const o = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  return { referrer: referrerLimpo(o.referrer), landing_path: pathLimpo(o.landing_path) }
}

/** Le a entrada guardada pelo plugin track-origin. Client-side. */
export function entradaDaSessao(): EntradaSessao | undefined {
  try {
    const raw = sessionStorage.getItem('pc_entrada')
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}
