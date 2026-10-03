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
  return saida
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
